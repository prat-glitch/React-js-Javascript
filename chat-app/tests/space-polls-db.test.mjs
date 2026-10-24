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
  '021_space_admins_activity_notifications.sql',
  '022_space_polls.sql',
];


// Isolated PostgreSQL permissions tests; no hosted database is contacted.
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

test('022 supports optional, private group voting with authentic decision results', async (t) => {
  const db = await database();
  const { as, admin, user, rpc, rejects, connect } = harness(db);
  try {
    const owner = await user('Owner'), creator = await user('Poll creator'), member = await user('Voter');
    const invited = await user('Invited'), outsider = await user('Outside');
    for (const actor of [creator, member, invited]) await connect(owner, actor);
    await as(owner);
    const space = await rpc('create_space', ['Trip', '', [creator.id, member.id, invited.id]]);
    const other = await rpc('create_space', ['Another group', '', []]);
    for (const actor of [creator, member]) { await as(actor); await rpc('respond_space_invite', [space, true]); }
    async function scenario(name, run) {
      await t.test(name, async () => {
        await db.exec('RESET ROLE; BEGIN');
        try { await run(); } finally { await db.exec('ROLLBACK; RESET ROLE'); }
      });
    }
    async function poll(question = 'Which hotel?', labels = ['Hotel ABC', 'Hotel XYZ']) {
      await as(creator);
      const id = await rpc('create_space_poll', [space, randomUUID(), question, labels]);
      return rpc('get_space_poll', [id]);
    }
    const vote = (p, index) => rpc('vote_space_poll', [p.id, index === null ? null : p.options[index].id]);
    const get = (p) => rpc('get_space_poll', [p.id]);

    await scenario('members create immutable polls, with safe idempotent request retries', async () => {
      const id = randomUUID(); await as(creator);
      assert.equal(await rpc('create_space_poll', [space, id, '  Which day?  ', [' Friday ', 'Saturday']]), id);
      assert.equal(await rpc('create_space_poll', [space, id, 'Which day?', ['Friday', 'Saturday']]), id);
      const p = await rpc('get_space_poll', [id]);
      assert.equal(p.question, 'Which day?'); assert.equal(p.options[0].label, 'Friday');
      assert.equal(p.total_votes, 0); assert.equal(p.my_option_id, null); assert.equal(p.decision_id, null);
      await rejects(() => rpc('create_space_poll', [space, id, 'Changed question', ['Friday', 'Saturday']]), /different details/);
      await as(member);
      await rejects(() => rpc('create_space_poll', [space, id, 'Which day?', ['Friday', 'Saturday']]), /different details/);
      const events = (await db.query("SELECT * FROM public.space_messages WHERE space_id=$1 AND system_event->>'type'='poll_created'", [space])).rows;
      assert.equal(events.length, 1); assert.equal(events[0].kind, 'system'); assert.equal(events[0].system_event.poll_id, id);
    });
    await scenario('rejects empty, duplicate, oversized and malformed choices', async () => {
      await as(member);
      for (const labels of [[], ['one'], ['one', 'ONE '], ['one', ' '], ['one', null], ['one', 'x'.repeat(121)], Array.from({ length: 9 }, (_, i) => 'Choice ' + i)]) {
        await rejects(() => rpc('create_space_poll', [space, randomUUID(), 'Question', labels]), /2 to 8/);
      }
      for (const question of [null, ' ', 'x'.repeat(241)]) {
        await rejects(() => rpc('create_space_poll', [space, randomUUID(), question, ['A', 'B']]), /question/);
      }
    });
    await scenario('one vote per member, repeat is a no-op, change and withdraw are supported', async () => {
      const p = await poll(); await vote(p, 0); await vote(p, 0);
      let actual = await get(p); assert.equal(actual.total_votes, 1); assert.equal(actual.revision, 1);
      await vote(p, 1); actual = await get(p);
      assert.equal(actual.total_votes, 1); assert.equal(actual.options[0].votes, 0); assert.equal(actual.options[1].votes, 1);
      assert.equal(actual.my_option_id, p.options[1].id);
      await vote(p, null); await vote(p, null); actual = await get(p);
      assert.equal(actual.total_votes, 0); assert.equal(actual.my_option_id, null); assert.equal(actual.revision, 3);
    });
    await scenario('members see totals but never another voter’s ballot or private profile', async () => {
      const p = await poll(); await vote(p, 0); await as(member); await vote(p, 1);
      const actual = await get(p); assert.equal(actual.total_votes, 2); assert.equal(actual.my_option_id, p.options[1].id);
      const ballots = (await db.query('SELECT * FROM public.space_poll_votes')).rows;
      assert.equal(ballots.length, 1); assert.equal(ballots[0].voter_id, member.id);
      assert.doesNotMatch(JSON.stringify(actual), /voter_id|email|phone/);
      await rejects(() => db.query('SELECT public.space_poll_json($1)', [p.id]), /permission denied/);
      for (const table of ['space_polls', 'space_poll_options', 'space_poll_votes']) {
        await rejects(() => db.query('DELETE FROM public.' + table), /permission denied/);
        await rejects(() => db.query('UPDATE public.' + table + ' SET space_id=$1', [other]), /permission denied/);
      }
      await rejects(() => db.query('INSERT INTO public.space_poll_votes(space_id,poll_id,voter_id,option_id) VALUES($1,$2,$3,$4)', [space, p.id, creator.id, p.options[0].id]), /permission denied/);
    });
    await scenario('outsiders, invited and anonymous users cannot read or act on a poll', async () => {
      const p = await poll();
      for (const actor of [outsider, invited, null]) {
        await as(actor);
        await rejects(() => get(p), /not available|permission denied/);
        await rejects(() => rpc('list_space_polls', [space]), /Not a joined|permission denied/);
        await rejects(() => vote(p, 0), /Not a joined|permission denied/);
        await rejects(() => rpc('close_space_poll', [p.id]), /Not a joined|permission denied/);
        await rejects(() => rpc('decide_space_poll', [p.id, p.options[0].id]), /Not a joined|permission denied/);
        await rejects(() => rpc('create_space_poll', [space, randomUUID(), 'Bad', ['A', 'B']]), /Not a joined|permission denied/);
        if (actor) assert.deepEqual((await db.query('SELECT * FROM public.space_polls')).rows, []);
      }
    });
    await scenario('cannot vote for an option from another poll or another group', async () => {
      const p = await poll(), second = await poll('Other poll');
      await rejects(() => rpc('vote_space_poll', [p.id, second.options[0].id]), /from this poll/);
      await as(owner); const id = await rpc('create_space_poll', [other, randomUUID(), 'Other group', ['A', 'B']]);
      const foreign = await rpc('get_space_poll', [id]); await as(creator);
      await rejects(() => rpc('vote_space_poll', [p.id, foreign.options[0].id]), /from this poll/);
      await rejects(() => rpc('vote_space_poll', [randomUUID(), p.options[0].id]), /Not a joined/);
    });
    await scenario('only creator/admin closes, closure is idempotent and freezes every ballot operation', async () => {
      const p = await poll(); await vote(p, 0); await as(member);
      await rejects(() => rpc('close_space_poll', [p.id]), /creator or group admins/);
      await as(owner); await rpc('close_space_poll', [p.id]); await rpc('close_space_poll', [p.id]);
      const actual = await get(p); assert.ok(actual.closed_at); assert.equal(actual.closed_by, owner.id);
      for (const actor of [owner, creator, member]) {
        await as(actor);
        for (const index of [0, 1, null]) await rejects(() => vote(p, index), /Voting is closed/);
      }
      const events = (await db.query("SELECT * FROM public.space_messages WHERE system_event->>'type'='poll_closed'")).rows;
      assert.equal(events.length, 1);
      assert.equal((await rpc('get_space', [space])).decisions.length, 0);
    });
    await scenario('open, empty, losing or unauthorized results cannot become decisions', async () => {
      const p = await poll(); await vote(p, 0);
      await rejects(() => rpc('decide_space_poll', [p.id, p.options[0].id]), /Close voting/);
      await rpc('close_space_poll', [p.id]);
      await rejects(() => rpc('decide_space_poll', [p.id, p.options[1].id]), /most votes/);
      await rejects(() => rpc('decide_space_poll', [p.id, randomUUID()]), /most votes/);
      await as(member); await rejects(() => rpc('decide_space_poll', [p.id, p.options[0].id]), /creator or group admins/);
      const empty = await poll('No votes'); await rpc('close_space_poll', [empty.id]);
      await rejects(() => rpc('decide_space_poll', [empty.id, empty.options[0].id]), /No votes were cast/);
    });
    await scenario('pins one authentic result with final counts, supports retry and source retrieval', async () => {
      const p = await poll(); await vote(p, 0); await as(member); await vote(p, 0); await as(creator);
      await rpc('close_space_poll', [p.id]);
      const id = await rpc('decide_space_poll', [p.id, p.options[0].id]);
      assert.equal(await rpc('decide_space_poll', [p.id, p.options[0].id]), id);
      const d = (await rpc('get_space', [space])).decisions.find((d) => d.id === id);
      assert.equal(d.body, 'Which hotel?\nHotel ABC'); assert.equal(d.source_poll_id, p.id);
      assert.equal(d.source_poll_option_id, p.options[0].id); assert.equal(d.source_message_id, null);
      assert.equal(d.poll_result_snapshot.total_votes, 2); assert.equal(d.poll_result_snapshot.options[0].votes, 2);
      assert.equal('my_option_id' in d.poll_result_snapshot, false); assert.equal((await get(p)).decision_id, id);
      const saved = d.poll_result_snapshot; await as(member); await rpc('leave_space', [space]); await as(owner);
      assert.equal((await get(p)).total_votes, 2);
      assert.deepEqual((await rpc('get_space', [space])).decisions[0].poll_result_snapshot, saved);
    });
    await scenario('ties require an explicit top choice and conflicting retries cannot silently replace it', async () => {
      const p = await poll(); await vote(p, 0); await as(member); await vote(p, 1); await as(creator);
      await rpc('close_space_poll', [p.id]);
      await rejects(() => rpc('decide_space_poll', [p.id, null]), /most votes/);
      const id = await rpc('decide_space_poll', [p.id, p.options[1].id]);
      assert.equal((await get(p)).decision_id, id);
      await rejects(() => rpc('decide_space_poll', [p.id, p.options[0].id]), /different result is already pinned/);
    });
    await scenario('message decisions and manual decisions still work independently; unpin preserves poll', async () => {
      const p = await poll(); await vote(p, 0); await rpc('close_space_poll', [p.id]);
      const id = await rpc('decide_space_poll', [p.id, p.options[0].id]); await rpc('remove_space_decision', [id]);
      assert.equal((await get(p)).decision_id, null); assert.equal((await get(p)).total_votes, 1);
      const message = await rpc('send_space_message', [space, 'Budget: ₹6,000 each']);
      const fromMessage = await rpc('save_space_decision', [space, 'Budget: ₹6,000 each', message]);
      const manual = await rpc('save_space_decision', [space, 'Train on Friday']);
      const decisions = (await rpc('get_space', [space])).decisions;
      assert.equal(decisions.length, 2); assert.equal(decisions.find((d) => d.id === fromMessage).source_message_id, message);
      assert.equal(decisions.find((d) => d.id === manual).source_poll_id, null);
    });
    await scenario('leaving removes access and voting, retained votes do not leak ballots', async () => {
      const p = await poll(); await as(member); await vote(p, 1); await rpc('leave_space', [space]);
      await rejects(() => get(p), /not available to you/); await rejects(() => vote(p, 0), /Not a joined/);
      assert.deepEqual((await db.query('SELECT * FROM public.space_poll_votes')).rows, []);
      await as(creator); assert.equal((await get(p)).total_votes, 1);
    });
    await scenario('pagination stays deterministic when timestamps match and creation is rate limited', async () => {
      const a = await poll('A'), b = await poll('B'), c = await poll('C');
      await admin('UPDATE public.space_polls SET created_at=$1', ['2026-10-24T00:00:00Z']); await as(member);
      const page = await rpc('list_space_polls', [space, null, null, 2]); assert.equal(page.length, 2);
      const rest = await rpc('list_space_polls', [space, page[1].created_at, page[1].id, 2]);
      assert.equal(rest.length, 1); assert.equal(new Set([...page, ...rest].map((p) => p.id)).size, 3);
      assert.deepEqual([...page, ...rest].map((p) => p.id), [a.id, b.id, c.id].sort().reverse());
      await rejects(() => rpc('list_space_polls', [space, page[0].created_at]), /both poll cursor/);
      // Restore recent timestamps before checking the per-hour quota.
      await admin('UPDATE public.space_polls SET created_at=clock_timestamp()');
      for (let i = 3; i < 20; i++) await poll('Question ' + i);
      await as(creator);
      await rejects(() => rpc('create_space_poll', [space, randomUUID(), 'Too many', ['A', 'B']]), /several polls/);
    });
  } finally { await db.close(); }
});


