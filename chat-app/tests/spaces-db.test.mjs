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

const tables = ['spaces', 'space_members', 'space_messages', 'space_tasks', 'space_decisions', 'space_links'];
const messageFields = ['id', 'space_id', 'sender_id', 'body', 'created_at', 'attachment', 'sender_name'].sort();
const fileLimit = 20 * 1024 * 1024;

function publicMessage(message, sender) {
  assert.deepEqual(Object.keys(message).sort(), messageFields);
  if (sender) {
    assert.equal(message.sender_id, sender.id);
    assert.equal(message.sender_name, sender.name);
  }
  assert.doesNotMatch(JSON.stringify(message), /attachment_object_id|spaces\.example|12345550199/);
}

// Storage grants mirror Supabase: access must be denied by policies, rather than
// accidentally passing because our mock forgot to grant ordinary table access.
async function database() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
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

test('PostgreSQL enforces conversation space consent, isolation, and Storage security', async (t) => {
  const db = await database();
  const { as, admin, user, rpc, rows, rejects, connect } = harness(db);
  try {
    const owner = await user('Space owner');
    const member = await user('Joined member');
    const invited = await user('Invited member');
    const outsider = await user('Outside user');
    const incomplete = await user('Incomplete user', { incomplete: true });
    const unconfirmed = await user('Unconfirmed user', { unconfirmed: true });
    await connect(owner, member);
    await connect(owner, invited);

    // Each scenario rolls back its fixtures, so failures do not hide later
    // security regressions or consume another scenario's rate/cap allowance.
    async function scenario(name, run) {
      await t.test(name, async () => {
        await db.exec('RESET ROLE; BEGIN');
        try { await run(); }
        finally { await db.exec('ROLLBACK; RESET ROLE'); }
      });
    }

    async function create(title = 'A shared plan', members = []) {
      return rpc('create_space', [title, 'Plan privately together', members]);
    }

    async function fixture() {
      await as(owner);
      const space = await create('First space', [member.id, invited.id]);
      const other = await create('Second space', [member.id]);
      await as(member);
      await rpc('respond_space_invite', [space, true]);
      await rpc('respond_space_invite', [other, true]);
      await as(owner);
      return { space, other };
    }

    function attachment(space, actor = owner, overrides = {}) {
      return { path: `${space}/${actor.id}/${randomUUID()}`, name: 'plan.pdf', mime: 'application/pdf', size: 1234, ...overrides };
    }

    async function upload(file, actor = owner, metadata = { mimetype: file.mime, size: file.size }) {
      await as(actor);
      return (await db.query(`INSERT INTO storage.objects (bucket_id, name, metadata, owner_id)
        VALUES ('space-files', $1, $2, $3) RETURNING id`, [file.path, JSON.stringify(metadata), actor.id])).rows[0].id;
    }

    async function send(space, body = 'A private message', file = null) {
      return rpc('send_space_message', [space, body, file === null ? null : JSON.stringify(file)]);
    }

    function mutationCalls(space, task, decision) {
      return [
        ['send_space_message', [space, 'Intrusion', null]],
        ['mark_space_read', [space]],
        ['mark_space_read', [space, randomUUID()]],
        ['invite_space_members', [space, []]],
        ['save_space_task', [space, 'Intrusion', null, null, null]],
        ['set_space_task_done', [task, true]],
        ['update_space_task', [task, 'Intrusion', null, null]],
        ['remove_space_task', [task]],
        ['save_space_decision', [space, 'Intrusion', null]],
        ['remove_space_decision', [decision]],
        ['save_space_link', [space, 'https://intrusion.example/', 'Intrusion', null]],
        ['leave_space', [space]],
      ];
    }

    async function storageNoRows(sql, values) {
      // Anon can fail on a private policy helper before RLS returns an empty
      // result. Both outcomes deny access under normal production table grants.
      await db.exec('SAVEPOINT storage_read');
      try {
        let result;
        try { result = await db.query(sql, values); }
        catch (error) {
          assert.equal(error.code, '42501');
          return;
        }
        assert.equal(result.rows.length, 0);
      } finally {
        await db.exec('ROLLBACK TO SAVEPOINT storage_read; RELEASE SAVEPOINT storage_read');
      }
    }

    async function storageHidden(path) {
      await storageNoRows('SELECT * FROM storage.objects WHERE name = $1', [path]);
    }

    await scenario('creation requires a confirmed account and a complete private profile', async () => {
      await as(null);
      await rejects(() => create(), /permission denied|sign in/i);
      await as(incomplete);
      await rejects(() => create(), /complete.*profile/i);
      await as(unconfirmed);
      await rejects(() => create(), /confirm.*email/i);
      await as(owner);
      const id = await create();
      assert.match(id, /^[0-9a-f-]{36}$/);
      const detail = await rpc('get_space', [id]);
      assert.equal(detail.space.title, 'A shared plan');
      assert.equal(detail.space.owner_id, owner.id);
      assert.equal(detail.members.length, 1);
      assert.equal(detail.members[0].user_id, owner.id);
      assert.equal(detail.members[0].status, 'joined');
    });

    await scenario('creation validates text and rejects invalid or null selected members atomically', async () => {
      await as(owner);
      for (const title of [null, '', '   ', 'x'.repeat(121)]) {
        await rejects(() => create(title), /title|name/i);
      }
      await rejects(() => rpc('create_space', ['Valid name', 'x'.repeat(2001), []]), /purpose/i);
      for (const ids of [[null], [member.id, null], [randomUUID()], [outsider.id]]) {
        await rejects(() => create('Invalid invitation', ids), /member|connect|invite|select/i);
      }
      assert.equal((await db.query('SELECT * FROM public.spaces')).rows.length, 0);
      const id = await create('  Trimmed title  ', [member.id, member.id]);
      const detail = await rpc('get_space', [id]);
      assert.equal(detail.space.title, 'Trimmed title');
      assert.equal(detail.members.length, 2);
      assert.equal(detail.members.filter((m) => m.user_id === member.id).length, 1);
    });

    await scenario('only accepted direct connections may be selected and spaces never create DMs', async () => {
      const pendingUser = await user('Pending connection');
      await as(owner);
      const pending = await rpc('send_basic_chat_request', [pendingUser.token]);
      await rejects(() => create('Pending consent', [pendingUser.id]), /connect/i);
      await as(pendingUser);
      await rpc('respond_basic_chat_request', [pending.request_id, false]);
      await as(owner);
      await rejects(() => create('Declined consent', [pendingUser.id]), /connect/i);
      // The inviter has a direct connection to each invitee. Merely sharing a
      // space with somebody must not establish a direct chat between invitees.
      const before = (await db.query('SELECT count(*)::int AS n FROM public.basic_chats')).rows[0].n;
      const id = await create('No implicit DMs', [member.id, invited.id]);
      await as(member);
      await rpc('respond_space_invite', [id, true]);
      await as(invited);
      await rpc('respond_space_invite', [id, true]);
      const all = await admin('SELECT * FROM public.basic_chats');
      assert.equal(all.rows.length, before);
      assert.equal(all.rows.some((c) => [c.member_a, c.member_b].includes(member.id)
        && [c.member_a, c.member_b].includes(invited.id)), false);
    });

    await scenario('the owner may create ten spaces per hour and the next request is atomic', async () => {
      await as(owner);
      for (let i = 0; i < 10; i++) await create('Rate limit ' + i);
      await rejects(() => create('Eleventh space'), /too many|limit|hour/i);
      assert.equal((await db.query('SELECT * FROM public.spaces')).rows.length, 10);
      assert.equal((await db.query('SELECT * FROM public.space_members')).rows.length, 10);
      // Another creator has an independent allowance.
      await as(member);
      await create('Independent allowance');
      await admin("UPDATE public.spaces SET created_at = now() - interval '61 minutes' WHERE owner_id = $1", [owner.id]);
      await as(owner);
      await create('After the rate window');
    });

    await scenario('twenty includes the owner, and duplicate selections do not consume extra seats', async () => {
      const peers = [];
      for (let i = 0; i < 20; i++) peers.push(await user('Capacity peer ' + i));
      // Accepted DMs are a privileged fixture here; separate scenarios exercise
      // the actual request/accept RPCs and verify that pending consent fails.
      for (const peer of peers) {
        await admin(`INSERT INTO public.basic_chats (member_a, member_b)
          VALUES (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [owner.id, peer.id]);
      }
      await as(owner);
      await rejects(() => create('Too many members', peers.map((p) => p.id)), /20|twenty|member|limit/i);
      assert.equal((await db.query('SELECT * FROM public.spaces')).rows.length, 0);
      const selected = peers.slice(0, 19).map((p) => p.id);
      const id = await create('Full space', [...selected, ...selected]);
      const detail = await rpc('get_space', [id]);
      assert.equal(detail.members.length, 20);
      assert.equal(new Set(detail.members.map((m) => m.user_id)).size, 20);
      const listed = await rpc('list_spaces');
      assert.equal(Number(listed.spaces.find((s) => s.id === id).member_count), 1);
      await rejects(() => rpc('invite_space_members', [id, [peers[19].id]]), /20|member|limit/i);
      await as(peers[0]);
      assert.equal(Number((await rpc('list_spaces')).invitations[0].member_count), 1);
      await rpc('respond_space_invite', [id, true]);
      assert.equal(Number((await rpc('list_spaces')).spaces[0].member_count), 2);
      await as(peers[1]);
      assert.equal(Number((await rpc('list_spaces')).invitations[0].member_count), 2);
    });

    await scenario('clients have SELECT-only table grants and cannot bypass mutation RPCs', async () => {
      const { space } = await fixture();
      const tables = (await admin(`SELECT c.relname AS name, a.attname AS column_name
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN LATERAL (SELECT attname FROM pg_attribute
          WHERE attrelid = c.oid AND attnum > 0 AND NOT attisdropped ORDER BY attnum LIMIT 1) a ON true
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND (c.relname = 'spaces' OR c.relname LIKE 'space\\_%' ESCAPE '\\')
        ORDER BY c.relname`)).rows;
      assert.ok(tables.length >= 5, 'expected spaces, memberships, messages, tasks, and decisions');
      for (const actor of [owner, member, invited, outsider, null]) {
        await as(actor);
        for (const { name, column_name: column } of tables) {
          const privileges = (await db.query(`SELECT
            has_table_privilege(current_user, $1, 'INSERT') AS insert,
            has_table_privilege(current_user, $1, 'UPDATE') AS update,
            has_table_privilege(current_user, $1, 'DELETE') AS delete`, ['public.' + name])).rows[0];
          assert.deepEqual(privileges, { insert: false, update: false, delete: false }, name);
          await rejects(() => db.query(`INSERT INTO public."${name}" DEFAULT VALUES`), /permission denied/);
          await rejects(() => db.query(`UPDATE public."${name}" SET "${column}" = "${column}" WHERE false`), /permission denied/);
          await rejects(() => db.query(`DELETE FROM public."${name}" WHERE false`), /permission denied/);
        }
      }
      await as(owner);
      assert.equal((await rpc('get_space', [space])).space.id, space);
    });

    await scenario('anonymous callers cannot execute space RPCs or private helpers', async () => {
      const { space } = await fixture();
      const task = await rpc('save_space_task', [space, 'Original task']);
      const decision = await rpc('save_space_decision', [space, 'Original decision']);
      await as(null);
      const calls = [
        ...mutationCalls(space, task, decision),
        ['create_space', ['Anonymous', '', []]],
        ['respond_space_invite', [space, true]],
        ['list_spaces', []],
        ['get_space', [space]],
        ['list_space_messages', [space, null, null, 10]],
        ['list_space_resources', [space, 'media', null, null, 10]],
        ['space_is_joined', [space]],
        ['space_storage_access', [`${space}/${owner.id}/${randomUUID()}`, false]],
        ['space_upload_unattached', [`${space}/${owner.id}/${randomUUID()}`]],
      ];
      for (const [name, values] of calls) await rejects(() => rpc(name, values), /permission denied/);
      for (const actor of [null, owner]) {
        await as(actor);
        for (const [name, values] of [
          ['space_require_profile', []],
          ['space_require_joined', [space]],
          ['space_valid_url', ['https://example.com/']],
        ]) await rejects(() => rpc(name, values), /permission denied/);
      }
    });

    await scenario('an invitation exposes only its summary until the invitee explicitly joins', async () => {
      const { space } = await fixture();
      const message = await send(space, 'Secret discussion https://private.example/');
      await rpc('save_space_task', [space, 'Secret task']);
      await rpc('save_space_decision', [space, 'Secret decision']);
      for (const actor of [invited, outsider]) {
        await as(actor);
        for (const table of tables) assert.equal((await db.query(`SELECT * FROM public.${table}`)).rows.length, 0, table);
        await rejects(() => rpc('get_space', [space]), /joined space member/i);
        await rejects(() => rpc('list_space_messages', [space, null, null, 10]), /joined space member/i);
        await rejects(() => rpc('list_space_resources', [space, 'files', null, null, 10]), /joined space member/i);
        const list = await rpc('list_spaces');
        assert.deepEqual(list.spaces, []);
        if (actor === invited) {
          assert.equal(list.invitations.length, 1);
          assert.deepEqual(Object.keys(list.invitations[0]).sort(),
            ['space_id', 'title', 'purpose', 'inviter_name', 'member_count'].sort());
          assert.equal(list.invitations[0].space_id, space);
          assert.equal(list.invitations[0].inviter_name, owner.name);
          assert.equal(Number(list.invitations[0].member_count), 2);
          assert.doesNotMatch(JSON.stringify(list), /Secret|private\.example|spaces\.example|12345550199/);
        } else assert.deepEqual(list.invitations, []);
      }
      await as(invited);
      await rpc('respond_space_invite', [space, true]);
      assert.equal((await rpc('list_spaces')).invitations.length, 0);
      assert.equal(Number((await rpc('list_spaces')).spaces[0].member_count), 3);
      assert.equal((await rpc('get_space', [space])).tasks.length, 1);
      assert.equal((await rpc('list_space_messages', [space]))[0].id, message);
      assert.equal((await db.query('SELECT * FROM public.space_messages')).rows.length, 1);
    });

    await scenario('every mutation checks joined membership for invitees and outsiders', async () => {
      const { space } = await fixture();
      const task = await rpc('save_space_task', [space, 'Original task']);
      const decision = await rpc('save_space_decision', [space, 'Original decision']);
      for (const actor of [invited, outsider]) {
        await as(actor);
        for (const [name, values] of mutationCalls(space, task, decision)) {
          await rejects(() => rpc(name, values), /joined space member/i);
        }
      }
      await as(owner);
      const detail = await rpc('get_space', [space]);
      assert.equal(detail.tasks[0].title, 'Original task');
      assert.equal(detail.tasks[0].completed_at, null);
      assert.equal(detail.decisions[0].body, 'Original decision');
      assert.deepEqual(detail.links, []);
    });

    await scenario('invitation responses are actor-specific, validated, and terminal', async () => {
      const { space, other } = await fixture();
      await as(outsider);
      await rejects(() => rpc('respond_space_invite', [space, true]), /not available/i);
      await as(owner);
      await rejects(() => rpc('respond_space_invite', [space, true]), /not available/i);
      await as(invited);
      await rejects(() => rpc('respond_space_invite', [space, null]), /accept or decline/i);
      await rejects(() => rpc('respond_space_invite', [other, true]), /not available/i);
      await rpc('respond_space_invite', [space, false]);
      for (const accept of [true, false]) {
        await rejects(() => rpc('respond_space_invite', [space, accept]), /not available/i);
      }
      assert.deepEqual(await rpc('list_spaces'), { spaces: [], invitations: [] });
      await as(owner);
      await rejects(() => rpc('invite_space_members', [space, [invited.id]]), /declined|left/i);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((s) => s.id === space).member_count), 2);
      await as(member);
      await rejects(() => rpc('respond_space_invite', [space, false]), /not available/i);
    });

    await scenario('acceptance requires a confirmed complete profile but decline does not', async () => {
      await as(owner);
      const space = await create();
      for (const actor of [incomplete, unconfirmed]) {
        await admin(`INSERT INTO public.basic_chats (member_a, member_b)
          VALUES (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid))`, [owner.id, actor.id]);
        await as(owner);
        await rpc('invite_space_members', [space, [actor.id]]);
        await as(actor);
        await rejects(() => rpc('respond_space_invite', [space, true]), /complete.*profile|confirm.*email/i);
        assert.equal((await rpc('list_spaces')).invitations.length, 1);
        await rpc('respond_space_invite', [space, false]);
        assert.equal((await rpc('list_spaces')).invitations.length, 0);
      }
    });

    await scenario('only the owner can invite direct connections and counts include only joined members', async () => {
      const { space } = await fixture();
      await as(member);
      await rejects(() => rpc('invite_space_members', [space, [outsider.id]]), /only.*owner/i);
      await as(owner);
      for (const ids of [[null], [member.id, null], [outsider.id], [owner.id]]) {
        await rejects(() => rpc('invite_space_members', [space, ids]), /invalid|direct connections/i);
      }
      await rpc('invite_space_members', [space, [member.id, member.id, invited.id]]);
      assert.equal((await rpc('get_space', [space])).members.length, 3);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((s) => s.id === space).member_count), 2);
      await as(invited);
      await rpc('respond_space_invite', [space, false]);
      await as(owner);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((s) => s.id === space).member_count), 2);
    });

    await scenario('function ACLs, definer search paths, RLS, attachment FK, and realtime publication are explicit', async () => {
      const functions = (await admin(`SELECT p.proname AS name, p.prosecdef AS definer, p.proconfig AS config,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
        EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS public
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND (p.proname LIKE 'space\\_%' ESCAPE '\\'
          OR p.proname = ANY($1::text[]))`, [[
        'create_space', 'list_spaces', 'get_space', 'invite_space_members', 'respond_space_invite',
        'list_space_messages', 'list_space_resources', 'send_space_message', 'mark_space_read',
        'save_space_task', 'set_space_task_done', 'update_space_task', 'remove_space_task',
        'save_space_decision', 'remove_space_decision', 'save_space_link', 'leave_space',
      ]])).rows;
      assert.equal(functions.length, 23);
      for (const fn of functions) {
        assert.equal(fn.definer, true, fn.name);
        assert.ok(fn.config?.some((setting) => /^search_path=(?:""|)$/.test(setting)), fn.name);
        assert.equal(fn.anonymous, false, fn.name);
        assert.equal(fn.public, false, fn.name);
        assert.equal(fn.authenticated, !['space_require_joined', 'space_require_profile', 'space_valid_url'].includes(fn.name), fn.name);
      }
      const readSignature = (await admin(`SELECT pronargs, pronargdefaults, proargnames FROM pg_proc
        WHERE oid = 'public.mark_space_read(uuid,uuid)'::regprocedure`)).rows[0];
      assert.deepEqual(readSignature, { pronargs: 2, pronargdefaults: 1, proargnames: ['p_space_id', 'p_message_id'] });
      assert.equal((await admin("SELECT to_regprocedure('public.mark_space_read(uuid)') AS old_overload")).rows[0].old_overload, null);
      const rls = (await admin(`SELECT relname, relrowsecurity FROM pg_class
        WHERE oid = ANY(ARRAY['public.spaces'::regclass, 'public.space_members'::regclass,
          'public.space_messages'::regclass, 'public.space_tasks'::regclass,
          'public.space_decisions'::regclass, 'public.space_links'::regclass, 'storage.objects'::regclass])`)).rows;
      assert.equal(rls.length, 7);
      assert.ok(rls.every((table) => table.relrowsecurity));
      const published = (await admin(`SELECT tablename FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'`)).rows.map((r) => r.tablename);
      for (const table of tables) assert.ok(published.includes(table), table);
      const fk = (await admin(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid = 'public.space_messages'::regclass AND contype = 'f'
          AND confrelid = 'storage.objects'::regclass`)).rows;
      assert.equal(fk.length, 1);
      assert.match(fk[0].definition, /FOREIGN KEY \(attachment_object_id\).*storage.objects\(id\).*ON DELETE RESTRICT/);
    });

    await scenario('messages have exactly the public fields, sender identity, and validated bodies', async () => {
      const { space } = await fixture();
      for (const body of [null, '', '   ', 'x'.repeat(10001)]) {
        await rejects(() => send(space, body), /text|attachment/i);
      }
      const ownerMessage = await send(space, 'x'.repeat(10000));
      await as(member);
      const memberMessage = await send(space, 'Hello from a member');
      const page = await rpc('list_space_messages', [space, null, null, 100]);
      assert.equal(page.length, 2);
      publicMessage(page.find((m) => m.id === ownerMessage), owner);
      publicMessage(page.find((m) => m.id === memberMessage), member);
      assert.equal(page.find((m) => m.id === memberMessage).attachment, null);
      await rejects(() => send(randomUUID(), 'Missing space'), /joined space member/i);
    });

    await scenario('task sources and assignees are joined members of this space and retries return the original id', async () => {
      const { space, other } = await fixture();
      const source = await send(space, 'Book the train');
      const foreign = await send(other, 'A different plan');
      for (const title of [null, '', '   ', 'x'.repeat(241)]) {
        await rejects(() => rpc('save_space_task', [space, title]), /task title/i);
      }
      for (const assignee of [invited.id, outsider.id, randomUUID()]) {
        await rejects(() => rpc('save_space_task', [space, 'Bad assignee', assignee]), /joined space members/i);
      }
      for (const invalidSource of [foreign, randomUUID()]) {
        await rejects(() => rpc('save_space_task', [space, 'Bad source', null, null, invalidSource]), /source.*this space/i);
      }
      await rejects(() => rpc('save_space_task', [space, 'Bad date', null, 'not-a-date']), /date|syntax/i);
      const id = await rpc('save_space_task', [space, '  Book train  ', member.id, '2027-01-02', source]);
      await as(member);
      assert.equal(await rpc('save_space_task', [space, 'Overwrite attempt', owner.id, '2028-01-01', source]), id);
      const task = (await rpc('get_space', [space])).tasks.find((x) => x.id === id);
      assert.equal(task.title, 'Book train');
      assert.equal(task.assignee_id, member.id);
      assert.equal(task.due_date, '2027-01-02');
      assert.equal(task.created_by, owner.id);
      assert.equal(task.source_message_id, source);
      const first = await rpc('save_space_task', [space, 'Unlinked task']);
      assert.notEqual(await rpc('save_space_task', [space, 'Unlinked task']), first);
      await rpc('save_space_task', [space, 'x'.repeat(240)]);
    });

    await scenario('joined members can toggle tasks idempotently but only the creator or owner can edit or remove', async () => {
      const { space } = await fixture();
      const ownerTask = await rpc('save_space_task', [space, 'Owner task', member.id]);
      await as(member);
      await rejects(() => rpc('update_space_task', [ownerTask, 'Spoofed edit']), /creator|owner/i);
      await rejects(() => rpc('remove_space_task', [ownerTask]), /creator|owner/i);
      await rejects(() => rpc('set_space_task_done', [ownerTask, null]), /done or open/i);
      await rpc('set_space_task_done', [ownerTask, true]);
      const done = (await rpc('get_space', [space])).tasks.find((x) => x.id === ownerTask);
      assert.ok(done.completed_at);
      assert.equal(done.completed_by, member.id);
      await as(owner);
      await rpc('set_space_task_done', [ownerTask, true]);
      assert.deepEqual((await rpc('get_space', [space])).tasks.find((x) => x.id === ownerTask), done);
      await rpc('set_space_task_done', [ownerTask, false]);
      const reopened = (await rpc('get_space', [space])).tasks.find((x) => x.id === ownerTask);
      assert.equal(reopened.completed_at, null);
      assert.equal(reopened.completed_by, null);
      await as(member);
      const ownTask = await rpc('save_space_task', [space, 'My task', owner.id]);
      for (const title of [null, '', ' ', 'x'.repeat(241)]) {
        await rejects(() => rpc('update_space_task', [ownTask, title]), /task title/i);
      }
      for (const assignee of [invited.id, outsider.id, randomUUID()]) {
        await rejects(() => rpc('update_space_task', [ownTask, 'Bad assignee', assignee]), /joined space members/i);
      }
      await rejects(() => rpc('update_space_task', [ownTask, 'Bad date', null, '2027-02-30']), /date|range/i);
      await rpc('update_space_task', [ownTask, '  Edited by creator  ', member.id, '2027-02-03']);
      let task = (await rpc('get_space', [space])).tasks.find((x) => x.id === ownTask);
      assert.equal(task.title, 'Edited by creator');
      assert.equal(task.assignee_id, member.id);
      assert.equal(task.due_date, '2027-02-03');
      await as(owner);
      await rpc('update_space_task', [ownTask, 'Edited by owner']);
      task = (await rpc('get_space', [space])).tasks.find((x) => x.id === ownTask);
      assert.equal(task.created_by, member.id);
      assert.equal(task.assignee_id, null);
      assert.equal(task.due_date, null);
      await rpc('remove_space_task', [ownTask]);
      await as(member);
      const removable = await rpc('save_space_task', [space, 'Remove own task']);
      await rpc('remove_space_task', [removable]);
      assert.deepEqual((await rpc('get_space', [space])).tasks.map((x) => x.id), [ownerTask]);
      for (const [name, values] of [
        ['update_space_task', [randomUUID(), 'Unknown task']],
        ['remove_space_task', [randomUUID()]],
        ['set_space_task_done', [randomUUID(), true]],
      ]) await rejects(() => rpc(name, values), /joined space member/i);
    });

    await scenario('decisions validate same-space sources, preserve source dedupe, and restrict deletion', async () => {
      const { space, other } = await fixture();
      const source = await send(space, 'We agreed on Friday');
      const foreign = await send(other, 'Other decision');
      for (const body of [null, '', ' ', 'x'.repeat(2001)]) {
        await rejects(() => rpc('save_space_decision', [space, body]), /decision/i);
      }
      for (const invalidSource of [foreign, randomUUID()]) {
        await rejects(() => rpc('save_space_decision', [space, 'Invalid source', invalidSource]), /source.*this space/i);
      }
      const id = await rpc('save_space_decision', [space, '  Friday it is  ', source]);
      await as(member);
      assert.equal(await rpc('save_space_decision', [space, 'Overwrite attempt', source]), id);
      const original = (await rpc('get_space', [space])).decisions.find((x) => x.id === id);
      assert.equal(original.body, 'Friday it is');
      assert.equal(original.created_by, owner.id);
      assert.equal(original.source_message_id, source);
      await rejects(() => rpc('remove_space_decision', [id]), /creator|owner/i);
      const own = await rpc('save_space_decision', [space, 'Member decision']);
      await rpc('remove_space_decision', [own]);
      const byMember = await rpc('save_space_decision', [space, 'Owner may remove']);
      await as(owner);
      await rpc('remove_space_decision', [byMember]);
      await rpc('remove_space_decision', [id]);
      const a = await rpc('save_space_decision', [space, 'x'.repeat(2000)]);
      assert.notEqual(await rpc('save_space_decision', [space, 'x'.repeat(2000)]), a);
      await rejects(() => rpc('remove_space_decision', [randomUUID()]), /joined space member/i);
    });

    await scenario('explicit links validate URL safety and sources while upserts preserve original attribution', async () => {
      const { space, other } = await fixture();
      const source = await send(space, 'First source');
      const nextSource = await send(space, 'Second source');
      const foreign = await send(other, 'Foreign source');
      const unsafe = [
        null, '', 'javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd',
        '//example.com/path', 'https://', 'https:///example.com',
        'https://user@example.com/', 'https://user:secret@example.com/',
        'https://example.com\\@evil.example/', 'https://example.com/a b',
        'https://example.com/\nheader', 'https://example.com/\tpath', 'https://example.com/\u007f',
        'https://example.com/<script>', 'https://example.com/"quoted"',
        'https://example.com/' + 'x'.repeat(2048),
      ];
      for (const url of unsafe) {
        await rejects(() => rpc('save_space_link', [space, url, 'Unsafe']), /HTTP|URL/i);
      }
      for (const title of [null, 'x'.repeat(241)]) {
        await rejects(() => rpc('save_space_link', [space, 'https://example.com/', title]), /title/i);
      }
      for (const badSource of [foreign, randomUUID()]) {
        await rejects(() => rpc('save_space_link', [space, 'https://example.com/', 'Bad source', badSource]), /source.*this space/i);
      }
      const valid = [
        'http://example.com/', 'HTTPS://example.com/Plan', 'https://example.com:8443/path#part',
        'https://[::1]/', 'https://example.com/@alice?q=@bob',
      ];
      for (const url of valid) await rpc('save_space_link', [space, url, 'Valid URL']);
      const url = 'https://example.com/shared';
      const id = await rpc('save_space_link', [space, url, '  Original  ', source]);
      await as(member);
      assert.equal(await rpc('save_space_link', [space, url, '  Better title  ', nextSource]), id);
      const link = (await rpc('get_space', [space])).links.find((x) => x.id === id);
      assert.equal(link.title, 'Better title');
      assert.equal(link.created_by, owner.id);
      assert.equal(link.source_message_id, source);
      const otherId = await rpc('save_space_link', [other, url, 'Other space']);
      assert.notEqual(otherId, id);
      assert.equal((await rpc('get_space', [space])).links.filter((x) => x.url === url).length, 1);
    });

    await scenario('plain-message autolinks trim punctuation, dedupe transactionally, and skip encoded GIF bodies', async () => {
      const { space } = await fixture();
      const one = 'https://one.example/path';
      const two = 'HTTPS://two.example/@alice?q=@bob';
      const source = await send(space, `See (${one}). Also ${two}! Repeat ${one}; https://user:secret@bad.example/`);
      let links = (await rpc('get_space', [space])).links;
      assert.deepEqual(links.map((x) => x.url).sort(), [one, two].sort());
      assert.ok(links.every((x) => x.source_message_id === source && x.created_by === owner.id));
      const original = links.find((x) => x.url === one);
      await as(member);
      await send(space, one);
      const updatedId = await rpc('save_space_link', [space, one, 'A named resource']);
      assert.equal(updatedId, original.id);
      await send(space, one);
      links = (await rpc('get_space', [space])).links;
      const updated = links.find((x) => x.url === one);
      assert.equal(updated.title, 'A named resource');
      assert.equal(updated.created_by, owner.id);
      assert.equal(updated.source_message_id, source);
      const gifBody = 'samlap:gif:v1:' + JSON.stringify({ url: 'https://gif.example/a.gif', title: 'https://not-a-link.example/' });
      const gif = await send(space, gifBody);
      assert.equal((await rpc('get_space', [space])).links.length, 2);
      assert.equal((await rpc('list_space_resources', [space, 'media']))[0].id, gif);
      assert.deepEqual(await rpc('list_space_resources', [space, 'files']), []);
    });

    await scenario('joined table reads are confined to their spaces across all six tables', async () => {
      const { space } = await fixture();
      await send(space, 'Shared discussion');
      await rpc('save_space_task', [space, 'Shared task']);
      await rpc('save_space_decision', [space, 'Shared decision']);
      await rpc('save_space_link', [space, 'https://shared.example/', 'Shared link']);
      await as(outsider);
      const hidden = await create('Private outsider space');
      await send(hidden, 'Hidden discussion');
      await rpc('save_space_task', [hidden, 'Hidden task']);
      await rpc('save_space_decision', [hidden, 'Hidden decision']);
      await rpc('save_space_link', [hidden, 'https://hidden.example/', 'Hidden link']);
      for (const actor of [owner, member]) {
        await as(actor);
        for (const table of tables) {
          const column = table === 'spaces' ? 'id' : 'space_id';
          assert.ok((await db.query(`SELECT * FROM public.${table} WHERE ${column} = $1`, [space])).rows.length > 0, table);
          assert.equal((await db.query(`SELECT * FROM public.${table} WHERE ${column} = $1`, [hidden])).rows.length, 0, table);
        }
        await rejects(() => rpc('get_space', [hidden]), /joined space member/i);
      }
      await as(outsider);
      for (const table of tables) {
        const column = table === 'spaces' ? 'id' : 'space_id';
        assert.equal((await db.query(`SELECT * FROM public.${table} WHERE ${column} = $1`, [space])).rows.length, 0, table);
      }
    });

    await scenario('get_space arrays have stable created_at/id order and sanitized member names', async () => {
      const { space } = await fixture();
      for (let i = 0; i < 5; i++) {
        await rpc('save_space_task', [space, 'Task ' + i]);
        await rpc('save_space_decision', [space, 'Decision ' + i]);
        await rpc('save_space_link', [space, `https://example.com/${i}`, 'Link ' + i]);
      }
      for (const table of ['space_tasks', 'space_decisions', 'space_links']) {
        await admin(`UPDATE public.${table} SET created_at = '2026-01-01T00:00:00Z' WHERE space_id = $1`, [space]);
      }
      await admin('UPDATE public.basic_profiles SET display_name = $1 WHERE id = $2', ['private@spaces.example', member.id]);
      await as(owner);
      const detail = await rpc('get_space', [space]);
      assert.deepEqual(Object.keys(detail).sort(), ['space', 'members', 'tasks', 'decisions', 'links'].sort());
      for (const key of ['tasks', 'decisions', 'links']) {
        assert.equal(detail[key].length, 5);
        assert.deepEqual(detail[key].map((x) => x.id), detail[key].map((x) => x.id).sort());
      }
      assert.equal(detail.members[0].user_id, owner.id);
      assert.deepEqual(detail.members.slice(1).map((x) => x.user_id), [member.id, invited.id].sort());
      assert.equal(detail.members.find((x) => x.user_id === member.id).display_name, 'Samlap user');
      assert.doesNotMatch(JSON.stringify(detail), /spaces\.example|12345550199/);
    });

    await scenario('Storage bucket is private, sized, and restricted to the supported MIME allowlist', async () => {
      const bucket = (await admin("SELECT * FROM storage.buckets WHERE id = 'space-files'")).rows[0];
      assert.equal(bucket.public, false);
      assert.equal(Number(bucket.file_size_limit), fileLimit);
      assert.deepEqual([...bucket.allowed_mime_types].sort(), [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/ogg', 'application/pdf', 'text/plain', 'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ].sort());
    });

    await scenario('an attachment must already exist at this uploader/space path with matching trusted metadata', async () => {
      const { space, other } = await fixture();
      const missing = attachment(space);
      await rejects(() => send(space, '', missing), /upload.*before sending/i);
      const valid = attachment(space);
      await upload(valid);
      for (const change of [{ mime: 'text/plain' }, { size: valid.size + 1 }]) {
        await rejects(() => send(space, '', { ...valid, ...change }), /trusted.*metadata/i);
      }
      const foreignSpace = attachment(other);
      await upload(foreignSpace);
      await rejects(() => send(space, '', foreignSpace), /attachment path/i);
      const foreignOwner = attachment(space, member);
      await upload(foreignOwner, member);
      await as(owner);
      await rejects(() => send(space, '', foreignOwner), /attachment path/i);
      for (const metadata of [{}, null, { mimetype: valid.mime }, { size: valid.size },
        { mimetype: 'text/plain', size: valid.size }, { mimetype: valid.mime, size: '-1' },
        { mimetype: valid.mime, size: '1.5' }, { mimetype: valid.mime, size: '001234' }]) {
        const file = attachment(space);
        await upload(file, owner, metadata);
        await rejects(() => send(space, '', file), /trusted.*metadata/i);
      }
      await as(owner);
      const id = await send(space, '', valid);
      const message = (await rpc('list_space_messages', [space]))[0];
      assert.equal(message.id, id);
      assert.equal(message.body, '');
      assert.deepEqual(message.attachment, valid);
      publicMessage(message, owner);
      const stored = (await admin('SELECT attachment_object_id FROM public.space_messages WHERE id = $1', [id])).rows[0];
      assert.ok(stored.attachment_object_id);
      await as(member);
      const resources = await rpc('list_space_resources', [space, 'files']);
      assert.equal(resources.length, 1);
      publicMessage(resources[0], owner);
    });

    await scenario('attachment JSON, canonical paths, filenames, MIME types, and size boundaries are validated', async () => {
      const { space } = await fixture();
      const valid = attachment(space);
      await upload(valid);
      const invalid = [
        [], 'not an object', 42, true, {},
        { ...valid, extra: true },
        ...Object.keys(valid).map((key) => Object.fromEntries(Object.entries(valid).filter(([k]) => k !== key))),
        ...['path', 'name', 'mime', 'size'].map((key) => ({ ...valid, [key]: null })),
        { ...valid, path: 123 }, { ...valid, name: 123 }, { ...valid, mime: [] },
        { ...valid, size: '1234' },
        ...['', 'x'.repeat(181), '../plan.pdf', 'folder/plan.pdf', 'folder\\plan.pdf', 'bad\nname.pdf', 'bad\u007fname.pdf']
          .map((name) => ({ ...valid, name })),
        ...[-1, 1.5, fileLimit + 1].map((size) => ({ ...valid, size })),
        ...['text/html', 'image/svg+xml', 'application/javascript', 'application/octet-stream', '']
          .map((mime) => ({ ...valid, mime })),
        ...['garbage', valid.path + '/extra', valid.path + '/', valid.path.replace(/[^/]+$/, '..'),
          `not-a-uuid/${owner.id}/${randomUUID()}`, `${space}/not-a-uuid/${randomUUID()}`]
          .map((path) => ({ ...valid, path })),
      ];
      for (const file of invalid) {
        await rejects(() => send(space, '', file), /attachment|filename|size|type|path/i);
      }
      // Bounds are tested against real metadata, so the upper boundary cannot
      // accidentally pass only because the mock bypasses the Storage API limit.
      for (const size of [1, fileLimit]) {
        const file = attachment(space, owner, { name: 'x'.repeat(176) + '.pdf', size });
        await upload(file);
        await send(space, '', file);
      }
    });

    await scenario('zero-byte attachments are rejected even when the trusted object matches', async () => {
      const { space } = await fixture();
      const file = attachment(space, owner, { size: 0 });
      await upload(file);
      await rejects(() => send(space, '', file), /size|attachment/i);
    });

    await scenario('published files cannot be reused, overwritten, or deleted, including by their sender', async () => {
      const { space } = await fixture();
      const file = attachment(space);
      const objectId = await upload(file);
      await send(space, 'Published', file);
      await rejects(() => send(space, 'Reuse', file), /unique|duplicate/i);
      assert.equal((await db.query('UPDATE storage.objects SET metadata = $1 WHERE id = $2 RETURNING id',
        [JSON.stringify({ mimetype: 'text/plain', size: 1 }), objectId])).rows.length, 0);
      assert.equal((await db.query('DELETE FROM storage.objects WHERE id = $1 RETURNING id', [objectId])).rows.length, 0);
      await rejects(() => db.query(`INSERT INTO storage.objects (bucket_id,name,metadata)
        VALUES ('space-files',$1,$2) ON CONFLICT (bucket_id,name) DO UPDATE SET metadata = EXCLUDED.metadata`,
      [file.path, JSON.stringify({ mimetype: file.mime, size: 99 })]), /row-level security|permission denied/i);
      await admin('SELECT 1');
      await rejects(() => db.query('DELETE FROM storage.objects WHERE id = $1', [objectId]), /foreign key/i);
      // Even if a trusted Storage service renames an object, the internal FK
      // protects its identity when the path-based unattached check no longer can.
      const renamed = `${space}/${owner.id}/${randomUUID()}`;
      await admin('UPDATE storage.objects SET name = $1 WHERE id = $2', [renamed, objectId]);
      await as(owner);
      await rejects(() => db.query('DELETE FROM storage.objects WHERE id = $1', [objectId]), /foreign key/i);
    });

    await scenario('Storage permits joined reads and only an uploader can clean up their unpublished file', async () => {
      const { space } = await fixture();
      const file = attachment(space);
      const objectId = await upload(file);
      await as(member);
      assert.equal((await db.query('SELECT * FROM storage.objects WHERE id = $1', [objectId])).rows.length, 1);
      assert.equal((await db.query('DELETE FROM storage.objects WHERE id = $1 RETURNING id', [objectId])).rows.length, 0);
      for (const actor of [invited, outsider, null]) {
        await as(actor);
        await storageHidden(file.path);
        await rejects(() => db.query(`INSERT INTO storage.objects (bucket_id,name,metadata,owner_id)
          VALUES ('space-files',$1,$2,$3)`, [`${space}/${actor?.id || owner.id}/${randomUUID()}`,
          JSON.stringify({ mimetype: file.mime, size: file.size }), actor?.id || owner.id]), /row-level security|permission denied/i);
      }
      await as(owner);
      for (const path of [
        `${space}/${member.id}/${randomUUID()}`, `${randomUUID()}/${owner.id}/${randomUUID()}`,
        `${space}/${owner.id}/not-a-uuid`, `${space}/${owner.id}/${randomUUID()}/nested`,
      ]) await rejects(() => db.query("INSERT INTO storage.objects (bucket_id,name) VALUES ('space-files',$1)", [path]), /row-level security/i);
      assert.equal((await db.query('DELETE FROM storage.objects WHERE id = $1 RETURNING id', [objectId])).rows.length, 1);
    });

    await scenario('restrictive Storage guards survive unrelated permissive policies for every operation', async () => {
      const { space } = await fixture();
      const published = attachment(space);
      await upload(published);
      await send(space, 'Attached', published);
      const pending = attachment(space);
      await upload(pending);
      const peerFile = attachment(space, member);
      await upload(peerFile, member);
      await admin(`CREATE POLICY legacy_permissive_storage ON storage.objects
        FOR ALL TO PUBLIC USING (true) WITH CHECK (true)`);
      const unrelated = (await admin(`INSERT INTO storage.objects (bucket_id,name)
        VALUES ('unrelated-bucket','public-control') RETURNING id`)).rows[0].id;
      for (const actor of [invited, outsider, null]) {
        await as(actor);
        for (const file of [published, pending, peerFile]) {
          await storageHidden(file.path);
          await storageNoRows('UPDATE storage.objects SET metadata = $1 WHERE name = $2 RETURNING id', ['{}', file.path]);
          await storageNoRows('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [file.path]);
        }
        await rejects(() => db.query("INSERT INTO storage.objects (bucket_id,name) VALUES ('space-files',$1)",
          [`${space}/${actor?.id || owner.id}/${randomUUID()}`]), /row-level security|permission denied/i);
        // The adversarial policy really grants unrelated access; private-bucket
        // denials therefore prove the restrictive guard, not a missing grant.
        if (actor) assert.equal((await db.query('SELECT id FROM storage.objects WHERE id = $1', [unrelated])).rows.length, 1);
        await rejects(() => db.query(`UPDATE storage.objects SET bucket_id = 'space-files', name = $1 WHERE id = $2`,
          [`${space}/${actor?.id || owner.id}/${randomUUID()}`, unrelated]), /row-level security|permission denied/i);
      }
      await as(owner);
      assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id = 'space-files'")).rows.length, 3);
      for (const file of [published, pending, peerFile]) {
        await storageNoRows('UPDATE storage.objects SET metadata = $1 WHERE name = $2 RETURNING id', ['{}', file.path]);
        await storageNoRows("UPDATE storage.objects SET bucket_id = 'unrelated-bucket' WHERE name = $1 RETURNING id", [file.path]);
      }
      await storageNoRows('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [published.path]);
      await storageNoRows('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [peerFile.path]);
      assert.equal((await db.query('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [pending.path])).rows.length, 1);
      await as(member);
      assert.equal((await db.query('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [peerFile.path])).rows.length, 1);
    });

    await scenario('autolinks retain balanced URL delimiters and bare IPv6 authorities', async () => {
      const { space } = await fixture();
      const urls = [
        'https://en.wikipedia.org/wiki/Function_(mathematics)',
        'http://[::1]',
        'https://example.com/a[b]',
        'https://example.com/a{b}',
      ];
      await send(space, urls.map((url) => `(${url}).`).join(' '));
      assert.deepEqual((await rpc('get_space', [space])).links.map((x) => x.url).sort(), [...urls].sort());
    });

    await scenario('unread counts exclude own messages and mark-read advances only the caller in that space', async () => {
      const { space, other } = await fixture();
      await admin("UPDATE public.space_members SET last_read_at = '2000-01-01T00:00:00Z' WHERE user_id = $1", [member.id]);
      await as(owner);
      await send(space, 'First unread');
      await send(space, 'Second unread');
      await send(other, 'Other unread');
      await as(member);
      await send(space, 'My own message');
      let list = await rpc('list_spaces');
      assert.equal(Number(list.spaces.find((x) => x.id === space).unread_count), 2);
      assert.equal(Number(list.spaces.find((x) => x.id === other).unread_count), 1);
      const ownerBefore = (await db.query('SELECT last_read_at, last_read_message_id FROM public.space_members WHERE space_id = $1 AND user_id = $2', [space, owner.id])).rows[0];
      await rpc('mark_space_read', [space]);
      list = await rpc('list_spaces');
      assert.equal(Number(list.spaces.find((x) => x.id === space).unread_count), 0);
      assert.equal(Number(list.spaces.find((x) => x.id === other).unread_count), 1);
      assert.deepEqual((await db.query('SELECT last_read_at, last_read_message_id FROM public.space_members WHERE space_id = $1 AND user_id = $2', [space, owner.id])).rows[0], ownerBefore);
      const firstRead = (await db.query('SELECT last_read_at FROM public.space_members WHERE space_id = $1 AND user_id = $2', [space, member.id])).rows[0].last_read_at;
      await rpc('mark_space_read', [space]);
      const secondRead = (await db.query('SELECT last_read_at FROM public.space_members WHERE space_id = $1 AND user_id = $2', [space, member.id])).rows[0].last_read_at;
      assert.ok(new Date(secondRead) >= new Date(firstRead));
      await as(owner);
      await send(space, 'After mark-read');
      await as(member);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).unread_count), 1);
    });

    await scenario('bounded read acknowledgements leave newer messages unread and never regress either cursor component', async () => {
      const { space } = await fixture();
      const earlier = await send(space, 'Earlier message');
      const ties = [];
      for (let i = 0; i < 3; i++) ties.push(await send(space, 'Tied message ' + i));
      ties.sort();
      const later = await send(space, 'Arrived after the loaded page');
      await admin("UPDATE public.space_messages SET created_at = '2026-03-01T12:00:00Z' WHERE id = ANY($1::uuid[])", [ties]);
      await admin("UPDATE public.space_messages SET created_at = '2026-02-28T12:00:00Z' WHERE id = $1", [earlier]);
      await admin("UPDATE public.space_messages SET created_at = '2026-03-02T12:00:00Z' WHERE id = $1", [later]);
      await admin('UPDATE public.space_members SET last_read_at = NULL, last_read_message_id = NULL WHERE space_id = $1 AND user_id = $2', [space, member.id]);
      await as(member);
      const marker = async () => (await db.query(`SELECT last_read_at, last_read_message_id
        FROM public.space_members WHERE space_id = $1 AND user_id = $2`, [space, member.id])).rows[0];
      const unread = async () => Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).unread_count);
      const peersBefore = (await db.query(`SELECT user_id, last_read_at, last_read_message_id
        FROM public.space_members WHERE space_id = $1 AND user_id <> $2 ORDER BY user_id`, [space, member.id])).rows;
      assert.equal(await unread(), 5);
      await rpc('mark_space_read', [space, earlier]);
      assert.equal(await unread(), 4);
      await rpc('mark_space_read', [space, ties[0]]);
      assert.equal(await unread(), 3, 'a tied message with a greater id remains unread');
      await rpc('mark_space_read', [space, ties[1]]);
      assert.equal(await unread(), 2, 'both the greater tied id and the later timestamp remain unread');
      const middle = await marker();
      assert.equal(middle.last_read_message_id, ties[1]);
      assert.deepEqual(middle.last_read_at, (await db.query('SELECT created_at FROM public.space_messages WHERE id = $1', [ties[1]])).rows[0].created_at);
      for (const stale of [earlier, ties[0], ties[1]]) {
        await rpc('mark_space_read', [space, stale]);
        assert.deepEqual(await marker(), middle);
        assert.equal(await unread(), 2);
      }
      await rpc('mark_space_read', [space, ties[2]]);
      assert.equal(await unread(), 1);
      await rpc('mark_space_read', [space, later]);
      assert.equal(await unread(), 0);
      const latest = await marker();
      await rpc('mark_space_read', [space, ties[2]]);
      assert.deepEqual(await marker(), latest, 'an older timestamp cannot replace the cursor');
      assert.deepEqual((await db.query(`SELECT user_id, last_read_at, last_read_message_id
        FROM public.space_members WHERE space_id = $1 AND user_id <> $2 ORDER BY user_id`, [space, member.id])).rows, peersBefore);
    });

    await scenario('read acknowledgements reject cross-space or nonexistent messages without changing the cursor', async () => {
      const { space, other } = await fixture();
      const local = await send(space, 'Local message');
      const foreign = await send(other, 'A message in another joined space');
      await as(member);
      await rpc('mark_space_read', [space, local]);
      const before = (await db.query(`SELECT space_id, last_read_at, last_read_message_id FROM public.space_members
        WHERE user_id = $1 ORDER BY space_id`, [member.id])).rows;
      for (const invalid of [foreign, randomUUID()]) {
        await rejects(() => rpc('mark_space_read', [space, invalid]), /read message.*this space/i);
        assert.deepEqual((await db.query(`SELECT space_id, last_read_at, last_read_message_id FROM public.space_members
          WHERE user_id = $1 ORDER BY space_id`, [member.id])).rows, before);
      }
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === other).unread_count), 1);
    });

    await scenario('legacy read calls choose the latest stored tuple and empty spaces never advance to wall time', async () => {
      const { space, other } = await fixture();
      await as(member);
      const marker = async () => (await db.query(`SELECT last_read_at, last_read_message_id
        FROM public.space_members WHERE space_id = $1 AND user_id = $2`, [space, member.id])).rows[0];
      const initial = await marker();
      for (const args of [[space], [space, null]]) {
        await rpc('mark_space_read', args);
        assert.deepEqual(await marker(), initial);
      }
      await admin('UPDATE public.space_members SET last_read_at = NULL WHERE space_id = $1 AND user_id = $2', [space, member.id]);
      await as(member);
      await rpc('mark_space_read', [space]);
      assert.deepEqual(await marker(), { last_read_at: null, last_read_message_id: null });
      await as(owner);
      const ids = [await send(space, 'First tied message'), await send(space, 'Second tied message')].sort();
      await send(other, 'Later message in a different space');
      await admin("UPDATE public.space_messages SET created_at = '2026-03-01T12:00:00Z' WHERE id = ANY($1::uuid[])", [ids]);
      await as(member);
      await rpc('mark_space_read', [space]);
      const expected = {
        last_read_at: (await db.query('SELECT created_at FROM public.space_messages WHERE id = $1', [ids[1]])).rows[0].created_at,
        last_read_message_id: ids[1],
      };
      assert.deepEqual(await marker(), expected, 'default selects the greatest id when timestamps tie');
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).unread_count), 0);
      await rpc('mark_space_read', [space, null]);
      assert.deepEqual(await marker(), expected);
      await as(owner);
      const next = await send(space, 'After the legacy acknowledgement');
      await as(member);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).unread_count), 1);
      await rpc('mark_space_read', [space, null]);
      assert.equal((await marker()).last_read_message_id, next);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).unread_count), 0);
    });

    await scenario('timestamp-only read markers use a zero UUID so tied messages remain unread', async () => {
      const { space } = await fixture();
      const tied = await send(space, 'At the legacy timestamp');
      const later = await send(space, 'After the legacy timestamp');
      await admin("UPDATE public.space_messages SET created_at = '2026-03-01T12:00:00Z' WHERE id = $1", [tied]);
      await admin("UPDATE public.space_messages SET created_at = '2026-03-02T12:00:00Z' WHERE id = $1", [later]);
      await admin(`UPDATE public.space_members SET last_read_at = '2026-03-01T12:00:00Z', last_read_message_id = NULL
        WHERE space_id = $1 AND user_id = $2`, [space, member.id]);
      await as(member);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).unread_count), 2);
      await rpc('mark_space_read', [space, tied]);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).unread_count), 1);
      assert.equal((await db.query(`SELECT last_read_message_id FROM public.space_members
        WHERE space_id = $1 AND user_id = $2`, [space, member.id])).rows[0].last_read_message_id, tied);
    });

    await scenario('leaving revokes all table/RPC/Storage access and unassigns only open tasks in that space', async () => {
      const { space, other } = await fixture();
      await rejects(() => rpc('leave_space', [space]), /owner cannot leave/i);
      await as(member);
      const source = await send(space, 'Member source');
      const open = await rpc('save_space_task', [space, 'Open task', member.id]);
      const done = await rpc('save_space_task', [space, 'Completed task', member.id]);
      await rpc('set_space_task_done', [done, true]);
      const otherTask = await rpc('save_space_task', [other, 'Other space task', member.id]);
      const decision = await rpc('save_space_decision', [space, 'Member decision', source]);
      await rpc('save_space_link', [space, 'https://member.example/', 'Member link']);
      const file = attachment(space, member);
      await upload(file, member);
      await send(space, '', file);
      const pending = attachment(space, member);
      await upload(pending, member);
      await rpc('leave_space', [space]);
      for (const table of tables) {
        const column = table === 'spaces' ? 'id' : 'space_id';
        assert.equal((await db.query(`SELECT * FROM public.${table} WHERE ${column} = $1`, [space])).rows.length, 0, table);
      }
      for (const [name, values] of [
        ...mutationCalls(space, open, decision),
        ['get_space', [space]],
        ['list_space_messages', [space]],
        ['list_space_resources', [space, 'files']],
      ]) await rejects(() => rpc(name, values), /joined space member/i);
      await rejects(() => rpc('respond_space_invite', [space, true]), /not available/i);
      const list = await rpc('list_spaces');
      assert.equal(list.spaces.some((x) => x.id === space), false);
      assert.equal(list.spaces.some((x) => x.id === other), true);
      assert.deepEqual(list.invitations, []);
      for (const path of [file.path, pending.path]) {
        await storageHidden(path);
        await storageNoRows('DELETE FROM storage.objects WHERE name = $1 RETURNING id', [path]);
      }
      await rejects(() => db.query("INSERT INTO storage.objects (bucket_id,name) VALUES ('space-files',$1)",
        [`${space}/${member.id}/${randomUUID()}`]), /row-level security/i);
      await as(owner);
      const detail = await rpc('get_space', [space]);
      assert.equal(detail.members.find((x) => x.user_id === member.id).status, 'left');
      assert.equal(detail.tasks.find((x) => x.id === open).assignee_id, null);
      assert.equal(detail.tasks.find((x) => x.id === done).assignee_id, member.id);
      assert.ok(detail.tasks.find((x) => x.id === done).completed_at);
      assert.equal((await rpc('get_space', [other])).tasks.find((x) => x.id === otherTask).assignee_id, member.id);
      assert.equal(Number((await rpc('list_spaces')).spaces.find((x) => x.id === space).member_count), 1);
      await rejects(() => rpc('invite_space_members', [space, [member.id]]), /declined|left/i);
      await rejects(() => rpc('save_space_task', [space, 'Assign former member', member.id]), /joined space members/i);
      await rejects(() => rpc('update_space_task', [open, 'Assign former member', member.id]), /joined space members/i);
      assert.equal((await db.query('SELECT id FROM storage.objects WHERE name = $1', [file.path])).rows.length, 1);
    });

    await scenario('message timestamp/id keysets paginate ties without omissions, repeats, or space leakage', async () => {
      const { space, other } = await fixture();
      const ids = [];
      for (let i = 0; i < 7; i++) ids.push(await send(space, 'Tied message ' + i));
      const older = await send(space, 'Older message');
      const newer = await send(space, 'Newer message');
      await send(other, 'Do not leak');
      const tiedAt = '2026-03-01T12:00:00Z';
      await admin('UPDATE public.space_messages SET created_at = $1 WHERE id = ANY($2::uuid[])', [tiedAt, ids]);
      await admin("UPDATE public.space_messages SET created_at = '2026-02-28T12:00:00Z' WHERE id = $1", [older]);
      await admin("UPDATE public.space_messages SET created_at = '2026-03-02T12:00:00Z' WHERE id = $1", [newer]);
      await as(member);
      const found = [];
      let before = null, beforeId = null;
      for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
        const page = await rpc('list_space_messages', [space, before, beforeId, 2]);
        if (!page.length) break;
        assert.ok(page.length <= 2);
        for (const message of page) { publicMessage(message, owner); assert.equal(message.space_id, space); }
        found.push(...page.map((x) => x.id));
        before = page.at(-1).created_at;
        beforeId = page.at(-1).id;
      }
      assert.deepEqual(found, [newer, ...[...ids].sort().reverse(), older]);
      assert.equal(new Set(found).size, found.length);
      assert.deepEqual((await rpc('list_space_messages', [space, tiedAt, null, 100])).map((x) => x.id), [older]);
      assert.equal((await rpc('list_space_messages', [space])).length, 9);
      for (const limit of [null, 0, -1, 101]) {
        await rejects(() => rpc('list_space_messages', [space, null, null, limit]), /cursor|limit/i);
      }
      await rejects(() => rpc('list_space_messages', [space, null, ids[0], 2]), /cursor|limit/i);
    });

    await scenario('media and file resource keysets filter types and preserve tied timestamps independently', async () => {
      const { space, other } = await fixture();
      const media = [], files = [];
      for (const [mime, name] of [
        ['image/png', 'photo.png'], ['video/mp4', 'movie.mp4'], ['audio/mpeg', 'recording.mp3'],
      ]) {
        const file = attachment(space, owner, { mime, name });
        await upload(file);
        media.push(await send(space, '', file));
      }
      for (let i = 0; i < 3; i++) {
        media.push(await send(space, 'samlap:gif:v1:' + JSON.stringify({ url: `https://gif.example/${i}.gif` })));
        const file = attachment(space);
        await upload(file);
        files.push(await send(space, '', file));
      }
      await send(space, 'Plain text https://example.com/ is neither a media nor a file resource');
      const otherFile = attachment(other);
      await upload(otherFile);
      await send(other, '', otherFile);
      const tiedAt = '2026-03-01T12:00:00Z';
      await admin('UPDATE public.space_messages SET created_at = $1 WHERE space_id = $2', [tiedAt, space]);
      await as(member);
      for (const [kind, expected] of [['media', media], ['files', files]]) {
        const found = [];
        let before = null, beforeId = null;
        for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
          const page = await rpc('list_space_resources', [space, kind, before, beforeId, 2]);
          if (!page.length) break;
          assert.ok(page.length <= 2);
          for (const resource of page) { publicMessage(resource, owner); assert.equal(resource.space_id, space); }
          found.push(...page.map((x) => x.id));
          before = page.at(-1).created_at;
          beforeId = page.at(-1).id;
        }
        assert.deepEqual(found, [...expected].sort().reverse(), kind);
        assert.equal(new Set(found).size, expected.length);
        assert.deepEqual(await rpc('list_space_resources', [space, kind, tiedAt, null, 100]), []);
      }
      for (const kind of [null, '', 'links', 'all']) {
        await rejects(() => rpc('list_space_resources', [space, kind, null, null, 10]), /kind|cursor|limit/i);
      }
      for (const limit of [null, 0, -1, 101]) {
        await rejects(() => rpc('list_space_resources', [space, 'media', null, null, limit]), /kind|cursor|limit/i);
      }
      await rejects(() => rpc('list_space_resources', [space, 'files', null, files[0], 2]), /kind|cursor|limit/i);
    });
  } finally { await db.close(); }
});
