import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const migrations = [
  '012_basic_chat.sql',
  '013_basic_profile_phone_unique.sql',
  '014_basic_profile_on_signup.sql',
  '019_private_profile_connections.sql',
  '020_conversation_spaces.sql',
];


// Bootstrap and harness copied from spaces-db.test.mjs; legacy tests stay on 020.
// Storage grants mirror Supabase: access must be denied by policies, rather than
// accidentally passing because our mock forgot to grant ordinary table access.
async function database() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      GRANT USAGE ON SCHEMA public TO service_role;
      CREATE PUBLICATION supabase_realtime;
      CREATE SCHEMA auth;
      CREATE SCHEMA storage;
      GRANT USAGE ON SCHEMA auth, public, storage TO anon, authenticated;
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY,
        email text,
        raw_user_meta_data jsonb DEFAULT '{}',
        email_confirmed_at timestamptz
      );
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
      CREATE TABLE storage.buckets (
        id text PRIMARY KEY,
        name text,
        public boolean,
        file_size_limit bigint,
        allowed_mime_types text[]
      );
      CREATE TABLE storage.objects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text,
        name text,
        metadata jsonb,
        owner_id text,
        UNIQUE (bucket_id, name)
      );
      CREATE FUNCTION storage.foldername(name text) RETURNS text[]
        LANGUAGE sql IMMUTABLE AS $$
          SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
        $$;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, anon;
    `);
    for (const file of migrations) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

function harness(db) {
  async function as(actor) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [actor?.id || '']);
    await db.query("SELECT set_config('request.jwt.claim.email', $1, false)", [actor?.email || '']);
    await db.exec('SET ROLE ' + (actor ? 'authenticated' : 'anon'));
    assert.equal((await db.query('SELECT current_user AS role')).rows[0].role,
      actor ? 'authenticated' : 'anon');
  }

  async function admin(sql, values = []) {
    await db.exec('RESET ROLE');
    return db.query(sql, values);
  }

  async function user(name, { unconfirmed = false, incomplete = false } = {}) {
    const actor = { id: randomUUID(), name, email: randomUUID() + '@spaces.example' };
    await admin(`INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
      VALUES ($1, $2, $3, $4)`, [actor.id, actor.email,
      JSON.stringify({ display_name: name, ...(incomplete ? {} : { private_phone: '+12345550199' }) }),
      unconfirmed ? null : new Date().toISOString()]);
    actor.token = (await db.query('SELECT share_token FROM public.basic_profiles WHERE id = $1', [actor.id])).rows[0].share_token;
    return actor;
  }

  async function rpc(name, values = []) {
    const placeholders = values.map((_, index) => '$' + (index + 1)).join(', ');
    return (await db.query(`SELECT public.${name}(${placeholders}) AS result`, values)).rows[0].result;
  }

  async function rows(name, values = []) {
    const placeholders = values.map((_, index) => '$' + (index + 1)).join(', ');
    return (await db.query(`SELECT * FROM public.${name}(${placeholders})`, values)).rows;
  }

  // Keep rejected statements from aborting the enclosing isolated test transaction.
  async function rejects(action, pattern) {
    await db.exec('SAVEPOINT expected_rejection');
    try {
      await assert.rejects(action, pattern);
    } finally {
      await db.exec('ROLLBACK TO SAVEPOINT expected_rejection; RELEASE SAVEPOINT expected_rejection');
    }
  }

  async function connect(a, b) {
    await as(a);
    const pending = await rpc('send_basic_chat_request', [b.token]);
    assert.equal(pending.status, 'pending_outgoing');
    await as(b);
    const accepted = await rpc('respond_basic_chat_request', [pending.request_id, true]);
    assert.equal(accepted.status, 'connected');
    return accepted.chat_id;
  }

  return { as, admin, user, rpc, rows, rejects, connect };
}

test('021 enforces space admins, durable activity and private assignment notifications', async (t) => {
  const db = await database();
  const { as, admin, user, rpc, rows, rejects, connect } = harness(db);
  const migrationUrl = new URL('../supabase/migrations/021_space_admins_activity_notifications.sql', import.meta.url);
  try {
    const owner = await user('Primary owner');
    const manager = await user('Group admin');
    const member = await user('Checklist creator');
    const peer = await user('Task assignee');
    const invited = await user('Pending invitee');
    const outsider = await user('Outside user');
    const ownContact = await user('Admin contact');
    const ownerContact = await user('Owner contact');
    for (const actor of [manager, member, peer, invited, ownerContact]) await connect(owner, actor);
    await connect(manager, ownContact);

    // Apply 021 over actual 020 data, including a member-created assigned task
    // which the new policy must preserve even though new assignment is denied.
    await as(owner);
    const legacySpace = await rpc('create_space', ['Legacy group', 'Existing purpose', [member.id]]);
    await as(member);
    await rpc('respond_space_invite', [legacySpace, true]);
    const legacyMessage = await rpc('send_space_message', [legacySpace, 'Existing source']);
    const legacyTask = await rpc('save_space_task', [legacySpace, 'Existing assigned task', owner.id, '2027-02-03', legacyMessage]);
    const legacyDone = await rpc('save_space_task', [legacySpace, 'Existing completed task', member.id]);
    await rpc('set_space_task_done', [legacyDone, true]);
    const beforeTasks = (await db.query('SELECT * FROM public.space_tasks ORDER BY id')).rows;
    const beforeMembers = (await db.query('SELECT * FROM public.space_members ORDER BY user_id')).rows;
    await admin('SELECT 1');
    await db.exec(await readFile(migrationUrl, 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/023_conversation_typing.sql', import.meta.url), 'utf8'));

    async function scenario(name, run) {
      await t.test(name, async () => {
        await db.exec('RESET ROLE; BEGIN');
        try { await run(); }
        finally { await db.exec('ROLLBACK; RESET ROLE'); }
      });
    }

    async function fixture() {
      await as(owner);
      const space = await rpc('create_space', ['Shared group', 'Private group', [manager.id, member.id, peer.id, invited.id]]);
      const other = await rpc('create_space', ['Other group', '', [member.id, peer.id]]);
      for (const actor of [manager, member, peer]) {
        await as(actor);
        await rpc('respond_space_invite', [space, true]);
        if (actor !== manager) await rpc('respond_space_invite', [other, true]);
      }
      await as(owner);
      await rpc('set_space_member_admin', [space, manager.id, true]);
      return { space, other };
    }

    async function events(space) {
      return (await db.query(`SELECT id, sender_id, body, kind, system_event FROM public.space_messages
        WHERE space_id = $1 AND kind = 'system' ORDER BY created_at, id`, [space])).rows;
    }

    async function notifications(space) { return (await rpc('get_space', [space])).task_notifications; }
    async function inbox() { return rpc('list_my_space_task_notifications'); }
    async function count(space) {
      return Number((await rpc('list_spaces')).spaces.find((s) => s.id === space).task_notification_count);
    }
    async function task(space, id) { return (await rpc('get_space', [space])).tasks.find((x) => x.id === id); }
    async function setAssignment(id, title, assignee) { return rpc('update_space_task', [id, title, assignee, null]); }

    await scenario('typing is authenticated, conversation-scoped and cannot impersonate another member', async () => {
      const { space, other } = await fixture();
      const sid = randomUUID();
      await as(member);
      await rpc('set_conversation_typing', [space, 'space', sid, true]);
      assert.deepEqual(await rows('list_conversation_typing', [space, 'space']), []);
      for (const sql of ['INSERT INTO public.conversation_typing DEFAULT VALUES',
        'UPDATE public.conversation_typing SET user_id = auth.uid()', 'DELETE FROM public.conversation_typing']) {
        await rejects(() => db.exec(sql), /permission denied/i);
      }
      await as(peer);
      const typing = (await db.query('SELECT * FROM public.list_conversation_typing($1, $2)', [space, 'space'])).rows;
      assert.equal(typing.length, 1); assert.equal(typing[0].user_id, member.id);
      assert.ok(typing[0].ttl_ms > 0 && typing[0].ttl_ms <= 6000);
      assert.deepEqual(await rows('list_conversation_typing', [other, 'space']), []);
      await rpc('set_conversation_typing', [space, 'space', sid, false]);
      assert.equal((await db.query('SELECT * FROM public.list_conversation_typing($1, $2)', [space, 'space'])).rows.length, 1);
      for (const actor of [outsider, invited, null]) {
        await as(actor);
        await rejects(() => rpc('set_conversation_typing', [space, 'space', sid, true]), /joined space member|permission denied/i);
        await rejects(() => rpc('list_conversation_typing', [space, 'space']), /joined space member|permission denied/i);
        if (actor) assert.deepEqual((await db.query('SELECT * FROM public.conversation_typing')).rows, []);
        else await rejects(() => db.query('SELECT * FROM public.conversation_typing'), /permission denied/i);
      }
    });

    await scenario('typing deduplicates devices, stops only its session, expires and revokes removed members', async () => {
      const { space } = await fixture();
      const first = randomUUID(), second = randomUUID();
      await as(member);
      await rpc('set_conversation_typing', [space, 'space', first, true]);
      await rpc('set_conversation_typing', [space, 'space', second, true]);
      await rpc('set_conversation_typing', [space, 'space', first, false]);
      await as(owner);
      assert.equal((await db.query('SELECT * FROM public.list_conversation_typing($1, $2)', [space, 'space'])).rows.length, 1);
      await admin("UPDATE public.conversation_typing SET expires_at = clock_timestamp() - interval '1 second'");
      await as(owner);
      assert.deepEqual((await db.query('SELECT * FROM public.list_conversation_typing($1, $2)', [space, 'space'])).rows, []);
      await as(member); await rpc('set_conversation_typing', [space, 'space', second, true]);
      await as(owner); await rpc('remove_space_member', [space, member.id]);
      assert.deepEqual((await db.query('SELECT * FROM public.list_conversation_typing($1, $2)', [space, 'space'])).rows, []);
      await as(member);
      await rejects(() => rpc('set_conversation_typing', [space, 'space', second, true]), /joined space member/i);
      assert.deepEqual((await db.query('SELECT * FROM public.conversation_typing')).rows, []);
    });

    await scenario('direct-chat typing requires participation and never adds messages or unread activity', async () => {
      const sid = randomUUID();
      const chat = (await admin('SELECT id FROM public.basic_chats WHERE member_a = least($1::uuid,$2::uuid) AND member_b = greatest($1::uuid,$2::uuid)', [owner.id, member.id])).rows[0].id;
      const before = (await db.query('SELECT count(*)::int n FROM public.basic_messages')).rows[0].n;
      await as(member);
      await rpc('set_conversation_typing', [chat, 'chat', sid, true]);
      await as(owner);
      assert.equal((await db.query('SELECT * FROM public.list_conversation_typing($1, $2)', [chat, 'chat'])).rows[0].user_id, member.id);
      await as(outsider);
      await rejects(() => rpc('list_conversation_typing', [chat, 'chat']), /not a chat member/i);
      await rejects(() => rpc('set_conversation_typing', [chat, 'chat', sid, true]), /not a chat member/i);
      assert.deepEqual((await db.query('SELECT * FROM public.conversation_typing')).rows, []);
      await as(member);
      await rejects(() => rpc('set_conversation_typing', [chat, 'invalid', sid, true]), /invalid typing/i);
      await rejects(() => rpc('set_conversation_typing', [chat, 'chat', null, true]), /invalid typing/i);
      await rpc('set_conversation_typing', [chat, 'chat', sid, false]);
      await as(owner);
      assert.deepEqual((await db.query('SELECT * FROM public.list_conversation_typing($1, $2)', [chat, 'chat'])).rows, []);
      assert.equal((await admin('SELECT count(*)::int n FROM public.basic_messages')).rows[0].n, before);
    });

    await scenario('migration preserves existing roles, source FKs, task data and ordinary message defaults', async () => {
      assert.deepEqual((await admin('SELECT * FROM public.space_tasks ORDER BY id')).rows, beforeTasks);
      assert.deepEqual((await admin('SELECT * FROM public.space_members ORDER BY user_id')).rows, beforeMembers);
      assert.deepEqual((await admin('SELECT * FROM public.space_task_notifications')).rows, []);
      await as(member);
      const detail = await rpc('get_space', [legacySpace]);
      assert.deepEqual(Object.keys(detail).sort(), ['space', 'members', 'tasks', 'decisions', 'links', 'task_notifications'].sort());
      assert.deepEqual(detail.task_notifications, []);
      const message = (await rpc('list_space_messages', [legacySpace]))[0];
      assert.equal(message.id, legacyMessage);
      assert.equal(message.kind, 'message');
      assert.equal(message.system_event, null);
      await rpc('update_space_task', [legacyTask, 'Creator edits title preserving assignment', owner.id, '2027-03-04']);
      assert.equal((await task(legacySpace, legacyTask)).assignee_id, owner.id);
      await rejects(() => rpc('update_space_task', [legacyTask, 'Omitted assignee unassigns']), /admins.*assignment/i);
      await rejects(() => rpc('set_space_task_done', [legacyTask, true]), /assignee|admins/i);
    });

    await scenario('admin escalation is denied and the joined primary owner is protected', async () => {
      const { space, other } = await fixture();
      await as(member);
      assert.equal(await rpc('space_is_admin', [space]), false);
      for (const target of [member.id, manager.id, owner.id]) {
        await rejects(() => rpc('set_space_member_admin', [space, target, true]), /only.*admins/i);
        await rejects(() => rpc('remove_space_member', [space, target]), /only.*admins/i);
      }
      await as(manager);
      assert.equal(await rpc('space_is_admin', [space]), true);
      assert.equal(await rpc('space_is_admin', [other]), false);
      for (const flag of [true, false]) await rejects(() => rpc('set_space_member_admin', [space, owner.id, flag]), /owner.*protected/i);
      await rejects(() => rpc('remove_space_member', [space, owner.id]), /owner.*protected/i);
      await rejects(() => rpc('remove_space_member', [space, manager.id]), /leave_space/i);
      await rejects(() => rpc('set_space_member_admin', [space, invited.id, true]), /joined non-owner/i);
      await rejects(() => rpc('set_space_member_admin', [space, outsider.id, true]), /joined non-owner/i);
      await rejects(() => rpc('set_space_member_admin', [space, member.id, null]), /choose/i);
      await rejects(() => rpc('set_space_member_admin', [other, peer.id, true]), /joined space member/i);
      await rpc('set_space_member_admin', [space, member.id, true]);
      await as(member);
      assert.equal(await rpc('space_is_admin', [space]), true);
      assert.equal((await rpc('get_space', [space])).members.find((x) => x.user_id === member.id).role, 'admin');
      await rpc('set_space_member_admin', [space, manager.id, false]);
      await as(manager);
      assert.equal(await rpc('space_is_admin', [space]), false);
      await rejects(() => rpc('set_space_member_admin', [space, manager.id, true]), /only.*admins/i);
      await as(owner);
      await rejects(() => rpc('leave_space', [space]), /owner cannot leave/i);
      assert.equal(await rpc('space_is_admin', [space]), true);
      const primary = (await rpc('get_space', [space])).members.find((x) => x.user_id === owner.id);
      assert.equal(primary.role, 'owner');
      assert.equal(primary.status, 'joined');
    });

    await scenario('admins invite only their own accepted direct connections and preserve recipient consent', async () => {
      const { space } = await fixture();
      await as(manager);
      await rejects(() => rpc('invite_space_members', [space, [ownerContact.id]]), /own existing direct connections/i);
      await rejects(() => rpc('invite_space_members', [space, [outsider.id]]), /direct connections/i);
      await rpc('send_basic_chat_request', [outsider.token]);
      await rejects(() => rpc('invite_space_members', [space, [outsider.id]]), /direct connections/i);
      await rejects(() => rpc('invite_space_members', [space, [null]]), /invalid/i);
      const dmCount = (await admin('SELECT count(*)::int n FROM public.basic_chats')).rows[0].n;
      await as(manager);
      const before = (await events(space)).length;
      await rpc('invite_space_members', [space, [ownContact.id, ownContact.id]]);
      await rpc('invite_space_members', [space, [ownContact.id]]);
      assert.equal((await events(space)).length, before + 1);
      assert.equal((await events(space)).at(-1).sender_id, manager.id);
      await as(ownContact);
      assert.equal(await rpc('space_is_admin', [space]), false);
      assert.equal((await rpc('list_spaces')).invitations.find((x) => x.space_id === space).inviter_name, manager.name);
      await rejects(() => rpc('get_space', [space]), /joined space member/i);
      assert.deepEqual(await inbox(), []);
      assert.deepEqual((await db.query('SELECT * FROM public.space_task_notifications')).rows, []);
      await rejects(() => rpc('save_space_task', [space, 'Before consent']), /joined space member/i);
      await rpc('respond_space_invite', [space, true]);
      const list = await rpc('list_spaces');
      assert.equal(Number(list.spaces.find((x) => x.id === space).member_count), 5);
      assert.equal((await admin('SELECT count(*)::int n FROM public.basic_chats')).rows[0].n, dmCount);
      await as(ownContact);
      assert.doesNotMatch(JSON.stringify(await rpc('get_space', [space])), /spaces\.example|12345550199|share_token|"phone"|"email"/);
      await as(owner);
      await rpc('remove_space_member', [space, invited.id]);
      await as(invited);
      await rejects(() => rpc('respond_space_invite', [space, true]), /not available/i);
    });

    await scenario('members create shared checklists but cannot assign, reassign, unassign or bypass RPCs', async () => {
      const { space } = await fixture();
      await as(member);
      for (const assignee of [member.id, owner.id, peer.id]) {
        await rejects(() => rpc('save_space_task', [space, 'Unauthorized assigned task', assignee]), /only.*admins.*assign/i);
      }
      const id = await rpc('save_space_task', [space, 'Shared checklist']);
      await rpc('update_space_task', [id, 'Creator edits shared item', null, '2027-04-05']);
      await rejects(() => setAssignment(id, 'Creator assigns self', member.id), /admins.*assignment/i);
      await as(peer);
      await rpc('set_space_task_done', [id, true]);
      assert.equal((await task(space, id)).completed_by, peer.id);
      await rpc('set_space_task_done', [id, false]);
      await rejects(() => rpc('update_space_task', [id, 'Noncreator edit']), /creator|admins/i);
      await rejects(() => rpc('remove_space_task', [id]), /creator|admins/i);
      await as(manager);
      await setAssignment(id, 'Assigned checklist', peer.id);
      await as(member);
      await rpc('update_space_task', [id, 'Creator preserves assignee', peer.id, '2027-05-06']);
      assert.equal((await task(space, id)).assignee_id, peer.id);
      for (const assignee of [null, member.id, owner.id]) {
        await rejects(() => setAssignment(id, 'Unauthorized reassignment', assignee), /admins.*assignment/i);
      }
      for (const done of [true, false]) await rejects(() => rpc('set_space_task_done', [id, done]), /assignee|admins/i);
      for (const sql of [
        'UPDATE public.space_tasks SET assignee_id = $1 WHERE id = $2',
        'UPDATE public.space_tasks SET completed_by = $1, completed_at = now() WHERE id = $2',
      ]) await rejects(() => db.query(sql, [member.id, id]), /permission denied/i);
      await as(peer);
      await rpc('set_space_task_done', [id, true]);
      const done = await task(space, id);
      await as(manager);
      await rpc('set_space_task_done', [id, true]);
      assert.deepEqual(await task(space, id), done);
      await rpc('set_space_task_done', [id, false]);
      await setAssignment(id, 'Unassigned again', null);
      await as(member);
      await rpc('remove_space_task', [id]);
      await as(peer);
      const removable = await rpc('save_space_task', [space, 'Admin can remove']);
      await as(manager);
      await rpc('remove_space_task', [removable]);
      assert.equal(await task(space, removable), undefined);
      await rejects(() => rpc('save_space_task', [space, 'Invitee cannot be assigned', invited.id]), /joined space members/i);
      await rejects(() => rpc('save_space_task', [space, 'Outsider cannot be assigned', outsider.id]), /joined space members/i);
    });

    await scenario('actual mutations emit durable typed plaintext events exactly once and user messages cannot spoof them', async () => {
      const { space, other } = await fixture();
      await as(manager);
      const initial = await events(space);
      assert.equal(initial.filter((e) => e.system_event.type === 'space_created').length, 1);
      assert.equal(initial.find((e) => e.system_event.type === 'space_created').sender_id, owner.id);
      assert.equal(initial.filter((e) => e.system_event.type === 'member_invited').length, 4);
      assert.equal(initial.filter((e) => e.system_event.type === 'member_joined').length, 3);
      const start = initial.length;
      await rpc('set_space_member_admin', [space, member.id, true]);
      await rpc('set_space_member_admin', [space, member.id, true]);
      await rpc('set_space_member_admin', [space, member.id, false]);
      await rpc('set_space_member_admin', [space, member.id, false]);
      await admin('UPDATE public.basic_profiles SET display_name = $1 WHERE id = $2', ['<b>Admin</b>\nName', manager.id]);
      await as(manager);
      const title = '<img src=x onerror=alert(1)>Book\ntrain';
      const source = await rpc('send_space_message', [space, 'Source']);
      const id = await rpc('save_space_task', [space, title, peer.id, null, source]);
      assert.equal(await rpc('save_space_task', [space, 'Retry cannot overwrite', member.id, null, source]), id);
      await setAssignment(id, title, peer.id); // identical update
      await setAssignment(id, title, member.id);
      await setAssignment(id, title, null);
      await setAssignment(id, 'Renamed task', null);
      await setAssignment(id, 'Renamed task', null);
      await rpc('set_space_task_done', [id, true]);
      await rpc('set_space_task_done', [id, true]);
      await rpc('set_space_task_done', [id, false]);
      const decision = await rpc('save_space_decision', [space, '<b>Travel Friday</b>', source]);
      assert.equal(await rpc('save_space_decision', [space, 'Retry', source]), decision);
      await rpc('remove_space_decision', [decision]);
      await rpc('remove_space_task', [id]);
      const activity = (await events(space)).slice(start);
      const expected = ['member_promoted', 'member_demoted', 'task_created', 'task_assigned', 'task_reassigned',
        'task_unassigned', 'task_updated', 'task_completed', 'task_reopened', 'decision_pinned', 'decision_unpinned', 'task_deleted'];
      // PostgreSQL timestamp/id order is stable even when two events share a
      // timestamp; UUID order need not equal the order of trigger statements.
      assert.deepEqual(activity.map((e) => e.system_event.type).sort(), expected.sort());
      for (const event of activity) {
        assert.equal(event.kind, 'system');
        assert.equal(event.sender_id, manager.id);
        assert.equal(event.system_event.actor_id, manager.id);
        assert.ok(event.body.includes('Admin Name') || event.system_event.type.startsWith('member_'));
        assert.doesNotMatch(event.body, /[<>\n\r]|<img|<b>|spaces\.example|12345550199/);
        assert.ok(Object.keys(event.system_event).every((k) => ['type', 'actor_id', 'target_id', 'task_id', 'decision_id'].includes(k)));
      }
      assert.match(activity.find((e) => e.system_event.type === 'task_created').body, /Book train/);
      assert.match(activity.find((e) => e.system_event.type === 'decision_pinned').body, /Travel Friday/);
      assert.equal(activity.find((e) => e.system_event.type === 'task_deleted').system_event.task_id, id);
      const fake = await rpc('send_space_message', [space, JSON.stringify({ type: 'task_assigned', actor_id: owner.id })]);
      const normal = (await rpc('list_space_messages', [space])).find((e) => e.id === fake);
      assert.equal(normal.kind, 'message');
      assert.equal(normal.system_event, null);
      await rejects(() => db.query(`INSERT INTO public.space_messages (space_id, sender_id, body, kind, system_event)
        VALUES ($1, $2, 'Fake', 'system', $3)`, [space, manager.id, JSON.stringify({ type: 'task_assigned', actor_id: manager.id })]), /permission denied/i);
      await rejects(() => rpc('space_append_activity', [space, 'task_assigned', 'Fake']), /permission denied/i);
      const total = (await db.query('SELECT count(*)::int n FROM public.space_messages WHERE space_id = $1', [space])).rows[0].n;
      // Persisted activity participates in the same paginated stream as chat.
      const seen = [];
      let before = null, beforeId = null;
      for (;;) {
        const page = await rpc('list_space_messages', [space, before, beforeId, 3]);
        if (!page.length) break;
        for (const message of page) {
          assert.equal(message.space_id, space);
          assert.deepEqual(Object.keys(message).sort(), ['id', 'space_id', 'sender_id', 'body', 'created_at',
            'attachment', 'sender_name', 'kind', 'system_event'].sort());
        }
        seen.push(...page.map((m) => m.id));
        before = page.at(-1).created_at;
        beforeId = page.at(-1).id;
      }
      assert.equal(seen.length, total);
      assert.equal(new Set(seen).size, total);
      await as(owner);
      const foreign = await rpc('send_space_message', [other, 'Foreign source']);
      await rejects(() => rpc('save_space_task', [space, 'Cross-space source', null, null, foreign]), /source.*this space/i);
      await rejects(() => rpc('save_space_decision', [space, 'Cross-space decision', foreign]), /source.*this space/i);
    });

    await scenario('notification privacy, source dedupe and global inbox are caller-scoped without implicit acknowledgement', async () => {
      const { space, other } = await fixture();
      await as(manager);
      const source = await rpc('send_space_message', [space, 'Task source']);
      const id = await rpc('save_space_task', [space, 'Book train', peer.id, null, source]);
      await rpc('save_space_task', [space, 'Retry', peer.id, null, source]);
      await setAssignment(id, 'Book train', peer.id);
      const selfTask = await rpc('save_space_task', [space, 'My admin task', manager.id]);
      assert.equal((await inbox()).length, 1, 'self-assignment is retained for frontend acknowledgement');
      assert.equal((await inbox())[0].task_id, selfTask);
      for (const actor of [owner, member, invited, outsider]) {
        await as(actor);
        assert.deepEqual((await db.query('SELECT * FROM public.space_task_notifications')).rows, []);
        assert.deepEqual(await inbox(), []);
      }
      await as(peer);
      const pending = await notifications(space);
      assert.equal(pending.length, 1);
      assert.equal(pending[0].task_id, id);
      assert.deepEqual(Object.keys(pending[0]).sort(), ['id', 'task_id', 'actor_id', 'created_at'].sort());
      assert.equal(await count(space), 1);
      const mine = await inbox();
      assert.equal(mine.length, 1);
      assert.deepEqual(Object.keys(mine[0]).sort(), ['id', 'space_id', 'task_id', 'task_title', 'space_title', 'actor_id', 'actor_name', 'created_at'].sort());
      assert.equal(mine[0].id, pending[0].id);
      assert.equal(mine[0].task_title, 'Book train');
      assert.equal(mine[0].space_title, 'Shared group');
      assert.equal(mine[0].actor_name, manager.name);
      assert.doesNotMatch(JSON.stringify(mine), /spaces\.example|12345550199|share_token|recipient_id/);
      await rpc('mark_space_read', [space]);
      assert.deepEqual(await notifications(space), pending);
      assert.deepEqual(await inbox(), mine);
      assert.equal(await count(space), 1);
      const stored = (await db.query('SELECT * FROM public.space_task_notifications')).rows;
      assert.equal(stored.length, 1);
      assert.equal(stored[0].read_at, null);
      assert.equal(stored[0].recipient_id, peer.id);
      const linked = (await db.query('SELECT * FROM public.space_messages WHERE id = $1', [stored[0].message_id])).rows[0];
      assert.equal(linked.system_event.type, 'task_assigned');
      assert.equal(linked.system_event.task_id, id);
      await as(owner);
      await rpc('save_space_task', [other, 'Other group task', peer.id]);
      await as(peer);
      assert.equal((await inbox()).length, 2);
      assert.equal((await inbox())[0].space_id, other);
      assert.equal(await count(other), 1);
      assert.equal(await count(space), 1);
    });

    await scenario('list_spaces exposes last_kind for system activity and ordinary chat', async () => {
      const { space } = await fixture();
      await as(peer);
      let summary = (await rpc('list_spaces')).spaces.find((s) => s.id === space);
      assert.equal(summary.last_kind, 'system');
      assert.match(summary.last_body, /admin/);
      await rpc('send_space_message', [space, 'Normal chat']);
      summary = (await rpc('list_spaces')).spaces.find((s) => s.id === space);
      assert.equal(summary.last_kind, 'message');
      assert.equal(summary.last_body, 'Normal chat');
      await as(manager);
      await rpc('save_space_task', [space, 'New assignment', peer.id]);
      await as(peer);
      summary = (await rpc('list_spaces')).spaces.find((s) => s.id === space);
      assert.equal(summary.last_kind, 'system');
      assert.match(summary.last_body, /(?:created|assigned) task: New assignment/);
      assert.equal(Number(summary.task_notification_count), 1);
      assert.equal((await inbox())[0].actor_name, manager.name);
      assert.equal((await inbox())[0].space_title, 'Shared group');
    });

    await scenario('bounded explicit acknowledgement ignores foreign owners and foreign spaces and is idempotent', async () => {
      const { space, other } = await fixture();
      await as(owner);
      await rpc('save_space_task', [space, 'Peer task', peer.id]);
      await rpc('save_space_task', [space, 'Member task', member.id]);
      await rpc('save_space_task', [other, 'Other peer task', peer.id]);
      await as(member);
      const theirs = (await notifications(space))[0].id;
      await as(peer);
      const mine = (await notifications(space))[0].id;
      const foreign = (await notifications(other))[0].id;
      await rejects(() => rpc('mark_space_task_notifications_read', [space, Array(101).fill(mine)]), /100/i);
      await rejects(() => rpc('mark_space_task_notifications_read', [space, null]), /100/i);
      await rejects(() => rpc('mark_space_task_notifications_read', [space, [null]]), /100/i);
      await rpc('mark_space_task_notifications_read', [space, []]);
      await rpc('mark_space_task_notifications_read', [space, [theirs, foreign, randomUUID()]]);
      assert.equal(await count(space), 1);
      assert.equal(await count(other), 1);
      await rpc('mark_space_task_notifications_read', [space, Array(100).fill(mine)]);
      assert.equal(await count(space), 0);
      assert.equal(await count(other), 1);
      const readAt = (await db.query('SELECT read_at FROM public.space_task_notifications WHERE id = $1', [mine])).rows[0].read_at;
      await rpc('mark_space_task_notifications_read', [space, [mine]]);
      assert.deepEqual((await db.query('SELECT read_at FROM public.space_task_notifications WHERE id = $1', [mine])).rows[0].read_at, readAt);
      await as(member);
      assert.equal(await count(space), 1);
      await as(outsider);
      await rejects(() => rpc('mark_space_task_notifications_read', [space, [mine]]), /joined space member/i);
    });

    await scenario('reassignment invalidates stale recipients; completion, unassignment and deletion clear active notifications', async () => {
      const { space } = await fixture();
      await as(manager);
      const id = await rpc('save_space_task', [space, 'Lifecycle task', peer.id]);
      await as(peer);
      const first = (await notifications(space))[0].id;
      await as(manager);
      await setAssignment(id, 'Lifecycle task', member.id);
      await as(peer);
      assert.equal(await count(space), 0);
      assert.deepEqual(await inbox(), []);
      assert.ok((await db.query('SELECT read_at FROM public.space_task_notifications WHERE id = $1', [first])).rows[0].read_at);
      await as(member);
      assert.equal(await count(space), 1);
      await as(manager);
      await setAssignment(id, 'Lifecycle task', peer.id);
      await as(peer);
      const again = await notifications(space);
      assert.equal(again.length, 1);
      assert.notEqual(again[0].id, first);
      await rpc('mark_space_task_notifications_read', [space, [first]]);
      assert.equal(await count(space), 1, 'stale client ids cannot acknowledge a new assignment');
      await rpc('set_space_task_done', [id, true]);
      assert.equal(await count(space), 0);
      assert.deepEqual(await inbox(), []);
      await rpc('set_space_task_done', [id, false]);
      assert.equal(await count(space), 0, 'reopening does not create a new assignment');
      await as(manager);
      await setAssignment(id, 'Lifecycle task', null);
      await setAssignment(id, 'Lifecycle task', peer.id);
      await as(peer);
      assert.equal(await count(space), 1);
      await as(manager);
      await setAssignment(id, 'Lifecycle task', null);
      await as(peer);
      assert.equal(await count(space), 0);
      await as(manager);
      await setAssignment(id, 'Lifecycle task', peer.id);
      await rpc('remove_space_task', [id]);
      await as(peer);
      assert.deepEqual(await inbox(), []);
      assert.deepEqual((await db.query('SELECT * FROM public.space_task_notifications WHERE task_id = $1', [id])).rows, []);
      assert.equal((await events(space)).filter((e) => e.system_event.task_id === id && e.system_event.type === 'task_deleted').length, 1);
    });

    await scenario('leave and removal revoke content/storage access, clean notifications and unassign only open local tasks', async () => {
      for (const removal of [false, true]) {
        const { space, other } = await fixture();
        await as(owner);
        const open = await rpc('save_space_task', [space, 'Open task', peer.id]);
        const done = await rpc('save_space_task', [space, 'Done task', peer.id]);
        await rpc('set_space_task_done', [done, true]);
        const elsewhere = await rpc('save_space_task', [other, 'Elsewhere', peer.id]);
        const path = `${space}/${peer.id}/${randomUUID()}`;
        await as(peer);
        await db.query(`INSERT INTO storage.objects (bucket_id, name, metadata, owner_id)
          VALUES ('space-files', $1, '{"mimetype":"text/plain","size":20}', $2)`, [path, peer.id]);
        if (removal) {
          await as(manager);
          await rpc('remove_space_member', [space, peer.id]);
        } else await rpc('leave_space', [space]);
        await as(peer);
        for (const table of ['space_messages', 'space_tasks', 'space_members', 'space_decisions', 'space_task_notifications']) {
          assert.deepEqual((await db.query(`SELECT * FROM public.${table} WHERE space_id = $1`, [space])).rows, [], table);
        }
        assert.deepEqual((await db.query('SELECT * FROM storage.objects WHERE name = $1', [path])).rows, []);
        assert.deepEqual((await db.query('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [path])).rows, []);
        assert.equal(await rpc('space_storage_access', [path, false]), false);
        await rejects(() => rpc('get_space', [space]), /joined space member/i);
        await rejects(() => rpc('mark_space_task_notifications_read', [space, []]), /joined space member/i);
        assert.equal((await inbox()).some((n) => n.space_id === space), false);
        assert.equal(await count(other), 1);
        assert.equal((await task(other, elsewhere)).assignee_id, peer.id);
        await as(owner);
        assert.equal((await task(space, open)).assignee_id, null);
        assert.equal((await task(space, done)).assignee_id, peer.id);
        assert.equal((await rpc('get_space', [space])).members.find((m) => m.user_id === peer.id).status, 'left');
        assert.equal(Number((await rpc('list_spaces')).spaces.find((s) => s.id === space).member_count), 3);
        const history = await events(space);
        const departure = history.filter((e) => e.system_event.type === (removal ? 'member_removed' : 'member_left'));
        assert.equal(departure.length, 1);
        assert.equal(departure[0].sender_id, removal ? manager.id : peer.id);
        assert.equal(history.filter((e) => e.system_event.task_id === open && e.system_event.type === 'task_unassigned').length, 1);
        assert.equal((await db.query(`SELECT * FROM public.space_task_notifications
          WHERE space_id = $1 AND recipient_id = $2 AND read_at IS NULL`, [space, peer.id])).rows.length, 0);
        await rejects(() => rpc('invite_space_members', [space, [peer.id]]), /left/i);
      }
    });

    await scenario('global inbox caps newest-first results and filters inactive assignment rows defensively', async () => {
      const { space, other } = await fixture();
      await as(owner);
      for (let i = 0; i < 103; i++) await rpc('save_space_task', [i % 2 ? other : space, 'Global task ' + i, peer.id]);
      await admin(`UPDATE public.space_task_notifications n SET created_at =
        '2026-10-24T00:00:00Z'::timestamptz + split_part(t.title, ' ', 3)::int * interval '1 second'
        FROM public.space_tasks t WHERE t.id = n.task_id AND t.space_id = ANY($1::uuid[])`, [[space, other]]);
      await as(peer);
      const list = await inbox();
      assert.equal(list.length, 100);
      assert.equal(list[0].task_title, 'Global task 102');
      assert.equal(list.at(-1).task_title, 'Global task 3');
      assert.equal(await count(space) + await count(other), 103);
      const first = list[0];
      // Privileged fixture simulates stale/corrupt cache rows. Validity must be
      // checked against tasks, not merely read_at, in all three read payloads.
      await admin('UPDATE public.space_task_notifications SET recipient_id = $1 WHERE id = $2', [member.id, first.id]);
      await as(member);
      assert.deepEqual(await inbox(), []);
      assert.deepEqual(await notifications(space), []);
      assert.equal(await count(space), 0);
    });

    await scenario('new helper ACLs, notification RLS, table grants and realtime publication are explicit', async () => {
      const internal = ['space_activity_text', 'space_activity_name', 'space_append_activity',
        'space_member_activity', 'space_task_activity', 'space_decision_activity', 'notify_space_task_push'];
      const exposed = ['space_is_admin', 'set_space_member_admin', 'remove_space_member',
        'list_my_space_task_notifications', 'mark_space_task_notifications_read'];
      const functions = (await admin(`SELECT p.proname AS name, p.prosecdef AS definer, p.proconfig AS config,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
        EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS public
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [[...internal, ...exposed]])).rows;
      assert.equal(functions.length, internal.length + exposed.length);
      for (const fn of functions) {
        assert.equal(fn.definer, true, fn.name);
        assert.ok(fn.config.some((s) => /^search_path=(?:""|)$/.test(s)), fn.name);
        assert.equal(fn.anonymous, false, fn.name);
        assert.equal(fn.public, false, fn.name);
        assert.equal(fn.authenticated, exposed.includes(fn.name), fn.name);
      }
      const rls = (await admin(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.space_task_notifications'::regclass`)).rows[0];
      assert.equal(rls.relrowsecurity, true);
      assert.equal((await db.query(`SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'space_task_notifications'`)).rows.length, 1);
      await as(peer);
      for (const table of ['space_members', 'space_messages', 'space_tasks', 'space_task_notifications']) {
        const grants = (await db.query(`SELECT has_table_privilege(current_user,$1,'INSERT') i,
          has_table_privilege(current_user,$1,'UPDATE') u, has_table_privilege(current_user,$1,'DELETE') d`, ['public.' + table])).rows[0];
        assert.deepEqual(grants, { i: false, u: false, d: false });
      }
      for (const sql of ['INSERT INTO public.space_task_notifications DEFAULT VALUES',
        'UPDATE public.space_task_notifications SET read_at = now()', 'DELETE FROM public.space_task_notifications']) {
        await rejects(() => db.query(sql), /permission denied/i);
      }
      await as(null);
      for (const [name, args] of [['list_my_space_task_notifications', []], ['space_is_admin', [legacySpace]],
        ['set_space_member_admin', [legacySpace, member.id, true]], ['remove_space_member', [legacySpace, member.id]],
        ['mark_space_task_notifications_read', [legacySpace, []]]]) {
        await rejects(() => rpc(name, args), /permission denied/i);
      }
    });

    await scenario('service_role can read trusted push rows without granting clients broader access', async () => {
      const { space, other } = await fixture();
      await as(owner);
      const first = await rpc('save_space_task', [space, 'Trusted assignment', peer.id]);
      const second = await rpc('save_space_task', [other, 'Other trusted assignment', member.id]);
      await as(outsider);
      for (const table of ['space_task_notifications', 'space_tasks', 'space_members']) {
        assert.deepEqual((await db.query(`SELECT * FROM public.${table}`)).rows, []);
      }
      await as(null);
      await db.exec('RESET ROLE; SET ROLE service_role');
      assert.equal((await db.query('SELECT current_user AS role')).rows[0].role, 'service_role');
      const trusted = (await db.query(`SELECT n.task_id, n.recipient_id, n.actor_id, t.title, m.status
        FROM public.space_task_notifications n
        JOIN public.space_tasks t ON t.id = n.task_id AND t.space_id = n.space_id
        JOIN public.space_members m ON m.space_id = n.space_id AND m.user_id = n.recipient_id
        WHERE n.space_id = ANY($1::uuid[]) ORDER BY t.title`, [[space, other]])).rows;
      assert.deepEqual(trusted, [
        { task_id: second, recipient_id: member.id, actor_id: owner.id, title: 'Other trusted assignment', status: 'joined' },
        { task_id: first, recipient_id: peer.id, actor_id: owner.id, title: 'Trusted assignment', status: 'joined' },
      ]);
      for (const role of ['service_role', 'anon', 'authenticated']) {
        for (const table of ['space_task_notifications', 'space_tasks', 'space_members']) {
          const grants = (await db.query(`SELECT has_table_privilege($1,$2,'SELECT') s,
            has_table_privilege($1,$2,'INSERT') i, has_table_privilege($1,$2,'UPDATE') u,
            has_table_privilege($1,$2,'DELETE') d`, [role, 'public.' + table])).rows[0];
          assert.deepEqual(grants, { s: role !== 'anon', i: false, u: false, d: false }, role + ':' + table);
        }
      }
      for (const role of ['anon', 'authenticated']) {
        assert.equal((await db.query("SELECT pg_has_role($1, 'service_role', 'MEMBER') AS member", [role])).rows[0].member, false);
      }
      await as(peer);
      const personal = (await db.query('SELECT * FROM public.space_task_notifications')).rows;
      assert.equal(personal.length, 1);
      assert.equal(personal[0].task_id, first);
      await as(owner);
      assert.deepEqual((await db.query('SELECT * FROM public.space_task_notifications')).rows, []);
    });

    await scenario('task push skips absent extensions, uses the verified id-only webhook and never rolls back on failure', async () => {
      const { space } = await fixture();
      await as(manager);
      await rpc('save_space_task', [space, 'No vault or net installed', peer.id]);
      await admin(`CREATE SCHEMA vault`);
      await db.exec(`CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
        INSERT INTO vault.decrypted_secrets VALUES ('samlap_push_webhook_secret', 'test-secret');
        CREATE SCHEMA net;
        CREATE TABLE public.test_push_queue (url text, body jsonb, headers jsonb, timeout_ms int);
        CREATE FUNCTION net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int)
        RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
          INSERT INTO public.test_push_queue VALUES (url, body, headers, timeout_milliseconds);
          RETURN 1;
        END $$;`);
      await as(manager);
      const id = await rpc('save_space_task', [space, 'Enqueue assignment', peer.id]);
      const queued = (await admin('SELECT * FROM public.test_push_queue')).rows;
      assert.equal(queued.length, 1);
      assert.equal(queued[0].url, 'https://samlap.pratyushghosh.me/api/push/task-assignment');
      assert.deepEqual(queued[0].headers, { 'Content-Type': 'application/json', 'x-push-webhook-secret': 'test-secret' });
      assert.equal(queued[0].timeout_ms, 5000);
      const notification = (await db.query('SELECT id FROM public.space_task_notifications WHERE task_id = $1', [id])).rows[0];
      assert.deepEqual(queued[0].body, { type: 'INSERT', schema: 'public', table: 'space_task_notifications', record: { id: notification.id } });
      await db.exec(`CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int)
        RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Network unavailable'; END $$;`);
      await as(manager);
      const saved = await rpc('save_space_task', [space, 'Push failure still saves', peer.id]);
      assert.equal((await task(space, saved)).assignee_id, peer.id);
      await as(peer);
      assert.equal((await notifications(space)).length, 3);
    });
  } finally { await db.close(); }
});
