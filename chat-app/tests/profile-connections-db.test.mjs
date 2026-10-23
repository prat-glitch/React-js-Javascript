import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL enforces profile privacy and recipient consent', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', email_confirmed_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
    `);
    for (const file of ['012_basic_chat.sql', '013_basic_profile_phone_unique.sql', '014_basic_profile_on_signup.sql', '019_private_profile_connections.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
    async function user(name, options = {}) {
      const id = randomUUID();
      await db.exec('RESET ROLE');
      await db.query('INSERT INTO auth.users (id,email,raw_user_meta_data,email_confirmed_at) VALUES ($1,$2,$3,$4)',
        [id, name.toLowerCase() + '@private.example', JSON.stringify({ display_name: name, ...(options.noPhone ? {} : { private_phone: '+12345550199' }) }),
          options.unconfirmed ? null : new Date().toISOString()]);
      const { rows } = await db.query('SELECT share_token FROM public.basic_profiles WHERE id=$1', [id]);
      return { id, token: rows[0].share_token, name };
    }
    async function as(actor) {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor?.id || '']);
      await db.query("SELECT set_config('request.jwt.claim.email',$1,false)", [(actor?.name || '').toLowerCase() + '@private.example']);
      await db.exec('SET ROLE ' + (actor ? 'authenticated' : 'anon'));
    }
    async function rpc(name, values = []) {
      const { rows } = await db.query(`SELECT public.${name}(${values.map((_, index) => '$' + (index + 1)).join(',')}) AS result`, values);
      return rows[0].result;
    }
    const alice = await user('Alice');
    const bob = await user('Bob');
    const eve = await user('Eve');
    const dan = await user('Dan');
    const eli = await user('Eli');
    const unconfirmed = await user('Unconfirmed', { unconfirmed: true });
    const incomplete = await user('Incomplete', { noPhone: true });
    let request, chatId;

    await t.test('anonymous callers cannot read or request profiles', async () => {
      await as(null);
      await assert.rejects(rpc('get_basic_profile_card', [bob.token]), /permission denied/);
      await assert.rejects(rpc('send_basic_chat_request', [bob.token]), /permission denied/);
      await assert.rejects(db.query('SELECT * FROM basic_profiles'), /permission denied/);
    });

    await t.test('public profile cards and own-profile RLS do not disclose peer contacts', async () => {
      await as(alice);
      const card = await rpc('get_basic_profile_card', [bob.token]);
      assert.equal(card.display_name, 'Bob'); assert.equal(card.status, 'available');
      assert.deepEqual(Object.keys(card).sort(), ['chat_id', 'display_name', 'request_id', 'share_token', 'status']);
      assert.doesNotMatch(JSON.stringify(card), /private\.example|12345550199/);
      const { rows } = await db.query('SELECT * FROM basic_profiles WHERE id=$1', [bob.id]);
      assert.equal(rows.length, 0);
      await assert.rejects(db.query('UPDATE basic_profiles SET share_token=$1 WHERE id=$2', [randomUUID(), alice.id]), /permission denied/);
      await assert.rejects(rpc('save_basic_profile', ['alice@private.example', '+12345550199']), /without an email/);
    });

    await t.test('a request, duplicate request, or reciprocal request never creates a chat', async () => {
      await as(alice);
      request = await rpc('send_basic_chat_request', [bob.token]);
      assert.equal(request.status, 'pending_outgoing');
      const repeat = await rpc('send_basic_chat_request', [bob.token]);
      assert.equal(repeat.request_id, request.request_id);
      assert.equal((await db.query('SELECT * FROM basic_chats')).rows.length, 0);
      await assert.rejects(db.query('INSERT INTO basic_chats (member_a,member_b) VALUES ($1,$2)', [alice.id, bob.id]), /permission denied/);
      await assert.rejects(rpc('respond_basic_chat_request', [request.request_id, true]), /not available/);
      await as(bob);
      assert.equal((await rpc('send_basic_chat_request', [alice.token])).status, 'pending_incoming');
      assert.equal((await db.query('SELECT * FROM basic_chats')).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM basic_chat_requests')).rows.length, 1);
      await assert.rejects(db.query('INSERT INTO basic_chat_requests (requester_id,recipient_id,status) VALUES ($1,$2,$3)', [alice.id, bob.id, 'accepted']), /permission denied/);
    });

    await t.test('only the recipient can accept, and acceptance is idempotent', async () => {
      await as(eve);
      assert.equal((await db.query('SELECT * FROM basic_chat_requests')).rows.length, 0);
      await assert.rejects(rpc('respond_basic_chat_request', [request.request_id, true]), /not available/);
      await as(bob);
      const accepted = await rpc('respond_basic_chat_request', [request.request_id, true]);
      assert.equal(accepted.status, 'connected'); chatId = accepted.chat_id;
      assert.equal((await rpc('respond_basic_chat_request', [request.request_id, true])).chat_id, chatId);
      assert.equal((await db.query('SELECT * FROM basic_chats')).rows.length, 1);
      await as(alice);
      assert.equal((await rpc('get_basic_profile_card', [bob.token])).status, 'connected');
      const chats = (await db.query('SELECT * FROM list_basic_chats()')).rows;
      assert.equal(chats[0].peer_name, 'Bob');
      assert.doesNotMatch(JSON.stringify(chats), /peer_email|private\.example|12345550199/);
    });

    await t.test('accepted members can message but outsiders cannot read, send or impersonate', async () => {
      await as(alice);
      await db.query('INSERT INTO basic_messages (chat_id,sender_id,body) VALUES ($1,$2,$3)', [chatId, alice.id, 'Hello']);
      await assert.rejects(db.query('INSERT INTO basic_messages (chat_id,sender_id,body) VALUES ($1,$2,$3)', [chatId, bob.id, 'Spoof']), /row-level security/);
      await as(eve);
      assert.equal((await db.query('SELECT * FROM basic_messages WHERE chat_id=$1', [chatId])).rows.length, 0);
      await assert.rejects(db.query('INSERT INTO basic_messages (chat_id,sender_id,body) VALUES ($1,$2,$3)', [chatId, eve.id, 'Intrusion']), /row-level security/);
    });

    await t.test('decline is terminal and cancellation cannot be accepted or immediately resent', async () => {
      await as(alice);
      const declined = await rpc('send_basic_chat_request', [dan.token]);
      await as(dan); assert.equal((await rpc('respond_basic_chat_request', [declined.request_id, false])).status, 'declined');
      await as(alice); assert.equal((await rpc('send_basic_chat_request', [dan.token])).status, 'declined');
      const cancelled = await rpc('send_basic_chat_request', [eli.token]);
      assert.equal((await rpc('cancel_basic_chat_request', [cancelled.request_id])).status, 'cancelled');
      assert.equal((await rpc('send_basic_chat_request', [eli.token])).status, 'cancelled');
      await as(eli); assert.equal((await rpc('respond_basic_chat_request', [cancelled.request_id, true])).status, 'cancelled');
      assert.equal((await db.query('SELECT * FROM basic_chats')).rows.length, 0);
    });

    await t.test('unconfirmed or incomplete accounts cannot initiate or accept connections', async () => {
      await as(unconfirmed); await assert.rejects(rpc('send_basic_chat_request', [bob.token]), /Confirm your email/);
      await as(incomplete); await assert.rejects(rpc('send_basic_chat_request', [bob.token]), /Complete your private profile/);
      await as(alice); const pending = await rpc('send_basic_chat_request', [unconfirmed.token]);
      await as(unconfirmed); await assert.rejects(rpc('respond_basic_chat_request', [pending.request_id, true]), /Confirm your email/);
      await as(alice); const noPhone = await rpc('send_basic_chat_request', [incomplete.token]);
      await as(incomplete); await assert.rejects(rpc('respond_basic_chat_request', [noPhone.request_id, true]), /Complete your private profile/);
    });

    await t.test('legacy instant-chat and contact-lookup functions are removed', async () => {
      await as(alice);
      await assert.rejects(rpc('create_basic_chat', [eve.id]), /does not exist/);
      await assert.rejects(rpc('find_basic_user', ['bob@private.example']), /does not exist/);
      assert.equal((await rpc('get_basic_profile_card', [alice.token])).status, 'self');
      assert.equal((await rpc('send_basic_chat_request', [alice.token])).status, 'self');
      assert.equal(await rpc('get_basic_profile_card', [randomUUID()]), null);
    });

    await t.test('database limits new requests even when a caller bypasses the UI', async () => {
      const sender = await user('RateLimited');
      const targets = [];
      for (let i = 0; i < 21; i++) targets.push(await user('Target' + i));
      await as(sender);
      for (const target of targets.slice(0, 20)) assert.equal((await rpc('send_basic_chat_request', [target.token])).status, 'pending_outgoing');
      await assert.rejects(rpc('send_basic_chat_request', [targets[20].token]), /Too many chat requests/);
    });
  } finally { await db.close(); }
});
