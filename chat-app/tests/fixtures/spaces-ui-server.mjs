// Isolated manual UI fixture: real PostgreSQL (PGlite), no hosted Supabase.
// Run: node tests/fixtures/spaces-ui-server.mjs
// Login: alice@example.test or bob@example.test / preview-pass
// Optional: SPACES_WEB_PORT=5174, SPACES_API_PORT=5181, SPACES_FIXTURE_TMPDIR.
// The logged fixtureRoot is a COPY: copy edited frontend files there for Next HMR.
// Database, sessions, signed URLs and uploaded file bytes live only in memory.
import { createServer } from 'node:http';
import { createServer as createProbe } from 'node:net';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const identifier = (value) => '"' + String(value).replaceAll('"', '""') + '"';
const json = (value) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? Number(item) : item);
const encode = (value) => Buffer.from(json(value)).toString('base64url');

function port(value, fallback) {
  const result = Number(value ?? fallback);
  if (!Number.isInteger(result) || result < 1 || result > 65535) throw new Error('Invalid fixture port');
  return result;
}

async function listen(server, number) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(number, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });
}

async function closeServer(server) {
  if (!server?.listening) return;
  const closed = new Promise((done) => server.close(done));
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await closed;
}

export async function createFixture() {
  const webPort = port(process.env.SPACES_WEB_PORT ?? process.env.WEB_PORT, 5174);
  const apiPort = port(process.env.SPACES_API_PORT ?? process.env.API_PORT, 5181);
  if (webPort === apiPort) throw new Error('Web and API ports must differ');
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;
  const migrationPath = resolve(repoRoot, 'supabase/migrations/020_conversation_spaces.sql');
  let spacesSQL;
  try { spacesSQL = await readFile(migrationPath, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Conversation Spaces backend is not ready: ${migrationPath} is missing. Start this fixture after the backend agent writes it.`);
    throw error;
  }

  const db = new PGlite();
  let api, child, fixtureRoot, closing, seed;
  let queue = Promise.resolve();
  const users = [];
  const accessTokens = new Map(), refreshTokens = new Map(), signedUrls = new Map(), files = new Map();
  const jwtSecret = randomBytes(32);
  let rpcDefinitions, storageBucket;

  async function bootstrap() {
    // Match tests/profile-connections-db.test.mjs and the Storage bootstrap in
    // tests/spaces-db.test.mjs. Policies/functions come from the real migrations.
    await db.exec(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      GRANT USAGE ON SCHEMA auth, public, storage TO anon, authenticated;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text,
        raw_user_meta_data jsonb DEFAULT '{}', email_confirmed_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        $$ SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text, name text, metadata jsonb, owner_id text, UNIQUE(bucket_id, name));
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
        $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, anon;
    `);
    for (const file of ['012_basic_chat.sql', '013_basic_profile_phone_unique.sql',
      '014_basic_profile_on_signup.sql', '019_private_profile_connections.sql']) {
      await db.exec(await readFile(resolve(repoRoot, 'supabase/migrations', file), 'utf8'));
    }
    await db.exec(spacesSQL);
    await db.exec(await readFile(resolve(repoRoot, 'supabase/migrations/021_space_admins_activity_notifications.sql'), 'utf8'));
    await db.exec(await readFile(resolve(repoRoot, 'supabase/migrations/022_space_polls.sql'), 'utf8'));
    await db.exec(await readFile(resolve(repoRoot, 'supabase/migrations/023_conversation_typing.sql'), 'utf8'));
    rpcDefinitions = (await db.query(`SELECT p.proname AS name,
      COALESCE(p.proargnames[1:p.pronargs], ARRAY[]::text[]) AS names,
      ARRAY(SELECT format_type(t, NULL) FROM unnest(p.proargtypes::oid[]) t) AS types,
      p.pronargdefaults AS defaults, p.proretset AS set
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'`)).rows;
    storageBucket = (await db.query("SELECT * FROM storage.buckets WHERE id='space-files'")).rows[0];
    if (!storageBucket || storageBucket.public) throw new Error('Migration must define a private space-files bucket');
  }

  async function seedDatabase() {
    const confirmed = new Date().toISOString();
    for (const [index, name] of ['Alice', 'Bob', 'Dana'].entries()) {
      const actor = { id: randomUUID(), name, email: name.toLowerCase() + '@example.test' };
      const metadata = { display_name: name, private_phone: '+1202555010' + index };
      await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at)
        VALUES ($1,$2,$3,$4)`, [actor.id, actor.email, json(metadata), confirmed]);
      actor.shareToken = (await db.query('SELECT share_token FROM public.basic_profiles WHERE id=$1', [actor.id])).rows[0].share_token;
      actor.user = { id: actor.id, aud: 'authenticated', role: 'authenticated', email: actor.email,
        email_confirmed_at: confirmed, confirmed_at: confirmed, created_at: confirmed, updated_at: confirmed,
        user_metadata: metadata, app_metadata: { provider: 'email', providers: ['email'] }, identities: [] };
      users.push(actor);
    }
    const [alice, bob, dana] = users;
    const call = (actor, name, args) => as(actor, (tx) => rpc(tx, name, args));
    const chatIds = {};
    for (const peer of [bob, dana]) {
      const request = await call(alice, 'send_basic_chat_request', { p_share_token: peer.shareToken });
      const accepted = await call(peer, 'respond_basic_chat_request', { p_request_id: request.request_id, p_accept: true });
      chatIds[peer.name.toLowerCase()] = accepted.chat_id;
      await as(peer, (tx) => tx.query('INSERT INTO public.basic_messages(chat_id,sender_id,body) VALUES ($1,$2,$3)',
        [accepted.chat_id, peer.id, `Hi Alice! We can keep our direct messages here and the shared plans in Spaces.`]));
    }
    async function joinedSpace(title, purpose) {
      const id = await call(alice, 'create_space', { p_title: title, p_purpose: purpose, p_member_ids: [bob.id, dana.id] });
      for (const peer of [bob, dana]) await call(peer, 'respond_space_invite', { p_space_id: id, p_accept: true });
      return id;
    }
    const tripId = await joinedSpace('Darjeeling trip', 'Plan our train journey, tea garden walks, and a weekend in the hills.');
    const projectId = await joinedSpace('College project', 'Keep the research, presentation, and submission plan together.');
    const tripMessages = [];
    const conversation = [
      [alice, 'Let’s plan our Darjeeling trip here. We have three days to explore the hills.'],
      [bob, 'I can check guesthouses near Chowrasta. A quiet place within walking distance would be ideal.'],
      [dana, 'Alice, could you book the train tickets by the end of the week?'],
      [alice, 'Here is the shared itinerary: https://example.test/darjeeling-itinerary'],
      [bob, 'Let’s take the morning train on Friday and visit a tea garden on Saturday.'],
      [dana, 'Agreed. I’ll bring a camera and a light rain jacket for the tea garden walk.'],
      [alice, 'Sounds good. We can compare guesthouse options here after the tickets are booked.'],
    ];
    for (const [actor, body] of conversation) tripMessages.push(await call(actor, 'send_space_message', { p_space_id: tripId, p_body: body }));
    for (const [actor, body] of [
      [alice, 'This space is for the college project. Let’s keep the trip planning in Darjeeling trip.'],
      [bob, 'I’ll prepare the research outline and share it before our next meeting.'],
      [dana, 'I can work on the presentation after we agree on the outline.'],
    ]) await call(actor, 'send_space_message', { p_space_id: projectId, p_body: body });
    const due = new Date();
    due.setDate(due.getDate() + 3);
    const dueDate = [due.getFullYear(), String(due.getMonth() + 1).padStart(2, '0'), String(due.getDate()).padStart(2, '0')].join('-');
    const taskId = await call(alice, 'save_space_task', { p_space_id: tripId, p_title: 'Book the train tickets',
      p_assignee_id: alice.id, p_due_date: dueDate, p_source_message_id: tripMessages[2] });
    await call(alice, 'save_space_task', { p_space_id: tripId, p_title: 'Confirm the guesthouse',
      p_assignee_id: bob.id, p_due_date: dueDate, p_source_message_id: tripMessages[1] });
    const decisionId = await call(bob, 'save_space_decision', { p_space_id: tripId,
      p_body: 'Take the morning train on Friday and visit a tea garden on Saturday.', p_source_message_id: tripMessages[4] });
    await call(alice, 'save_space_link', { p_space_id: tripId, p_url: 'https://example.test/darjeeling-itinerary',
      p_title: 'Darjeeling shared itinerary', p_source_message_id: tripMessages[3] });
    const invitationId = await call(bob, 'create_space', { p_title: 'Weekend reading club',
      p_purpose: 'Choose a book and plan a relaxed weekend discussion.', p_member_ids: [alice.id] });
    return { tripId, projectId, invitationId, taskId, decisionId, tripMessages, chatIds, dueDate };
  }

  // PGlite has one connection. Serialize the ENTIRE transaction, including SET
  // LOCAL ROLE/claims, SQL, and rollback. A failed request cannot leak identity.
  function as(actor, action) {
    const operation = queue.then(() => db.transaction(async (tx) => {
      const claims = { sub: actor?.id ?? '', email: actor?.email ?? '', role: actor ? 'authenticated' : 'anon' };
      await tx.query(`SELECT set_config('request.jwt.claim.sub',$1,true),
        set_config('request.jwt.claim.email',$2,true), set_config('request.jwt.claims',$3,true)`,
      [claims.sub, claims.email, json(claims)]);
      await tx.exec('SET LOCAL ROLE ' + (actor ? 'authenticated' : 'anon'));
      return action(tx);
    }));
    queue = operation.catch(() => {});
    return operation;
  }

  async function rpc(tx, name, args = {}) {
    if (!args || Array.isArray(args) || typeof args !== 'object') throw new Error('RPC arguments must be an object');
    const candidates = rpcDefinitions.filter((fn) => fn.name === name &&
      Object.keys(args).every((key) => fn.names.includes(key)) &&
      fn.names.slice(0, fn.names.length - fn.defaults).every((key) => Object.hasOwn(args, key)));
    if (candidates.length !== 1) throw new Error(`Unknown or ambiguous SQL RPC/arguments: ${name}(${Object.keys(args).join(', ')})`);
    const fn = candidates[0], values = [];
    // proargnames order, not JavaScript/Supabase object insertion order. Named
    // SQL notation also preserves actual database defaults for omitted args.
    const parameters = fn.names.flatMap((key, index) => {
      if (!Object.hasOwn(args, key)) return [];
      const value = args[key];
      values.push(value !== null && ['json', 'jsonb'].includes(fn.types[index]) ? json(value) : value);
      return [`${identifier(key)} => $${values.length}::${fn.types[index]}`];
    });
    const call = `public.${identifier(name)}(${parameters.join(',')})`;
    const result = await tx.query(fn.set ? `SELECT * FROM ${call}` : `SELECT ${call} AS result`, values);
    return fn.set ? result.rows : result.rows[0]?.result ?? null;
  }

  function session(actor) {
    const issuedAt = Math.floor(Date.now() / 1000), expiresAt = issuedAt + 3600;
    const payload = encode({ sub: actor.id, aud: 'authenticated', role: 'authenticated', email: actor.email,
      iat: issuedAt, exp: expiresAt, session_id: randomUUID() });
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${payload}`;
    const token = `${unsigned}.${createHmac('sha256', jwtSecret).update(unsigned).digest('base64url')}`;
    const refreshToken = randomBytes(32).toString('base64url');
    accessTokens.set(token, { actor, expiresAt, refreshToken });
    refreshTokens.set(refreshToken, { actor, token });
    return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
      refresh_token: refreshToken, user: actor.user };
  }

  function authenticated(req) {
    const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const record = accessTokens.get(token);
    if (!record || record.expiresAt <= Date.now() / 1000) throw new Error('Fixture sign-in required or session expired');
    return { ...record, token };
  }

  function objectPath(url, prefix) {
    const parts = url.pathname.slice(prefix.length).split('/').map(decodeURIComponent);
    const bucket = parts.shift(), name = parts.join('/');
    if (bucket !== 'space-files' || !name || parts.some((part) => !part || ['.', '..'].includes(part))) throw new Error('Invalid fixture storage path');
    return { bucket, name, key: `${bucket}/${name}` };
  }

  async function visibleObject(tx, object) {
    const row = (await tx.query('SELECT * FROM storage.objects WHERE bucket_id=$1 AND name=$2', [object.bucket, object.name])).rows[0];
    if (!row || !files.has(object.key)) throw new Error('File unavailable to this joined space member');
    return row;
  }

  async function storage(req, res, url, args, bytes, actor, reply) {
    if (url.pathname.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
      const object = objectPath(url, '/storage/v1/object/sign/');
      if (!Number.isInteger(args.expiresIn) || args.expiresIn < 1 || args.expiresIn > 3600) throw new Error('Signed URL lifetime must be 1 to 3600 seconds');
      await as(actor, (tx) => visibleObject(tx, object));
      const token = randomBytes(32).toString('base64url');
      for (const [key, record] of signedUrls) if (record.expiresAt <= Date.now()) signedUrls.delete(key);
      signedUrls.set(token, { actor, key: object.key, expiresAt: Date.now() + args.expiresIn * 1000 });
      reply({ signedURL: `/object/sign/${object.key}?token=${token}` }); return;
    }
    if (url.pathname === '/storage/v1/object/space-files' && req.method === 'DELETE') {
      if (!Array.isArray(args.prefixes) || args.prefixes.some((name) => typeof name !== 'string')) throw new Error('Storage prefixes must be an array of paths');
      const removed = await as(actor, (tx) => tx.query(`DELETE FROM storage.objects
        WHERE bucket_id='space-files' AND name=ANY($1::text[]) RETURNING id,name`, [args.prefixes]));
      for (const row of removed.rows) files.delete('space-files/' + row.name);
      reply(removed.rows); return;
    }
    if (url.pathname.startsWith('/storage/v1/object/') && ['POST', 'PUT'].includes(req.method)) {
      const object = objectPath(url, '/storage/v1/object/');
      let content = bytes, mime = (req.headers['content-type'] ?? '').split(';')[0].toLowerCase();
      if (mime === 'multipart/form-data') {
        const form = await new Response(bytes, { headers: { 'content-type': req.headers['content-type'] } }).formData();
        const uploaded = [...form.values()].filter((value) => typeof value !== 'string');
        if (uploaded.length !== 1) throw new Error('Choose exactly one upload');
        content = Buffer.from(await uploaded[0].arrayBuffer());
        mime = uploaded[0].type || 'application/octet-stream';
      }
      if (!content.length || content.length > Number(storageBucket.file_size_limit)) throw new Error('Upload must contain 1 byte to 20 MiB');
      if (!storageBucket.allowed_mime_types.includes(mime)) throw new Error('Upload MIME type is not allowed');
      const metadata = json({ size: content.length, mimetype: mime });
      const row = await as(actor, async (tx) => {
        const result = req.method === 'PUT'
          ? await tx.query('UPDATE storage.objects SET metadata=$3 WHERE bucket_id=$1 AND name=$2 RETURNING id', [object.bucket, object.name, metadata])
          : await tx.query(`INSERT INTO storage.objects(bucket_id,name,metadata,owner_id) VALUES ($1,$2,$3,$4)
            ${req.headers['x-upsert'] === 'true' ? 'ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=EXCLUDED.metadata' : ''}
            RETURNING id`, [object.bucket, object.name, metadata, actor.id]);
        if (!result.rows.length) throw new Error('Storage object is unavailable or immutable');
        return result.rows[0];
      });
      files.set(object.key, { bytes: content, mime });
      reply({ Id: row.id, Key: object.key }, 200); return;
    }
    if (url.pathname.startsWith('/storage/v1/object/') && ['GET', 'HEAD'].includes(req.method)) {
      await download(req, res, url, actor); return;
    }
    throw new Error('Unsupported fixture storage operation');
  }

  async function download(req, res, url, actor) {
    const signed = url.pathname.startsWith('/storage/v1/object/sign/');
    const prefix = signed ? '/storage/v1/object/sign/' : url.pathname.startsWith('/storage/v1/object/authenticated/')
      ? '/storage/v1/object/authenticated/' : '/storage/v1/object/';
    const object = objectPath(url, prefix);
    let capability;
    if (signed) {
      capability = signedUrls.get(url.searchParams.get('token'));
      if (!capability || capability.expiresAt <= Date.now() || capability.key !== object.key) throw new Error('Signed URL is invalid or expired');
      actor = capability.actor;
    }
    await as(actor, (tx) => visibleObject(tx, object));
    if (capability && capability.expiresAt <= Date.now()) throw new Error('Signed URL is expired');
    const file = files.get(object.key);
    if (!file) throw new Error('File is unavailable');
    const headers = { ...cors(req), 'Content-Type': file.mime, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    if (url.searchParams.has('download')) {
      const filename = (url.searchParams.get('download') || 'download').replace(/[\r\n"\\/\u0000-\u001f\u007f]/g, '_');
      headers['Content-Disposition'] = `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    }
    let content = file.bytes, status = 200;
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2])) throw new Error('Invalid byte range');
      const start = range[1] ? Number(range[1]) : Math.max(0, content.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), content.length - 1) : content.length - 1;
      if (start > end || start >= content.length) throw new Error('Byte range is outside the file');
      headers['Content-Range'] = `bytes ${start}-${end}/${content.length}`;
      content = content.subarray(start, end + 1); status = 206;
    }
    headers['Content-Length'] = content.length;
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : content);
  }

  async function tableRequest(tx, req, url, body) {
    const table = url.pathname.slice('/rest/v1/'.length);
    if (!['basic_messages', 'space_messages'].includes(table)) throw new Error('Unknown fixture table');
    const columns = (await tx.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1`, [table])).rows.map((row) => row.column_name);
    const column = (key) => {
      if (!columns.includes(key)) throw new Error(`Unknown ${table} column: ${key}`);
      return identifier(key);
    };
    const select = url.searchParams.get('select') ?? '*';
    const selection = select === '*' ? '*' : select.split(',').map(column).join(',');
    if (req.method === 'POST' && table === 'basic_messages') {
      const records = Array.isArray(body) ? body : [body];
      const rows = [];
      for (const record of records) {
        const keys = Object.keys(record);
        if (!keys.length) throw new Error('Message body is required');
        rows.push(...(await tx.query(`INSERT INTO public.${identifier(table)} (${keys.map(column).join(',')})
          VALUES (${keys.map((_, index) => '$' + (index + 1)).join(',')}) RETURNING ${selection}`, Object.values(record))).rows);
      }
      return rows;
    }
    if (!['GET', 'HEAD'].includes(req.method)) throw new Error('Unsupported fixture table operation');
    const values = [], filters = [];
    for (const [key, filter] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
      const field = column(key);
      const match = /^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/s.exec(filter);
      if (!match) throw new Error('Unsupported table filter: ' + filter);
      const [, operator, value] = match;
      if (operator === 'is') {
        if (!['null', 'true', 'false'].includes(value)) throw new Error('Invalid IS filter');
        filters.push(`${field} IS ${value.toUpperCase()}`);
      } else if (operator === 'in') {
        if (!value.startsWith('(') || !value.endsWith(')')) throw new Error('Invalid IN filter');
        const items = value.slice(1, -1).split(',').map((item) => item.replace(/^"|"$/g, ''));
        filters.push(`${field} IN (${items.map((item) => { values.push(item); return '$' + values.length; }).join(',')})`);
      } else {
        values.push(value);
        filters.push(`${field} ${{ eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[operator]} $${values.length}`);
      }
    }
    const order = (url.searchParams.get('order') ?? 'created_at.asc,id.asc').split(',').map((item) => {
      const [key, direction = 'asc', nulls] = item.split('.');
      if (!['asc', 'desc'].includes(direction) || (nulls && !['nullsfirst', 'nullslast'].includes(nulls))) throw new Error('Invalid sort order');
      return `${column(key)} ${direction.toUpperCase()}${nulls ? ' NULLS ' + (nulls === 'nullsfirst' ? 'FIRST' : 'LAST') : ''}`;
    }).join(',');
    const range = /^(?:items=)?(\d+)-(\d+)$/.exec(req.headers.range ?? '');
    const offset = Number(url.searchParams.get('offset') ?? range?.[1] ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? (range ? Number(range[2]) - offset + 1 : 1000));
    if (![offset, limit].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid pagination');
    values.push(Math.min(limit, 10000), offset);
    return (await tx.query(`SELECT ${selection} FROM public.${identifier(table)}
      ${filters.length ? 'WHERE ' + filters.join(' AND ') : ''} ORDER BY ${order}
      LIMIT $${values.length - 1} OFFSET $${values.length}`, values)).rows;
  }

  async function stop() {
    if (closing) return closing;
    closing = (async () => {
      if (child && child.exitCode === null && child.signalCode === null) {
        // Kill only our child/tree. Windows SIGTERM alone orphans Next's worker.
        const exited = new Promise((done) => child.once('exit', done));
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          killer.once('error', () => child.kill());
        } else child.kill('SIGTERM');
        await Promise.race([exited, new Promise((done) => { const timer = setTimeout(done, 3000); timer.unref(); })]);
      }
      await closeServer(api);
      await queue;
      await db.close();
    })();
    return closing;
  }

  try {
    await bootstrap();
    seed = await seedDatabase();
    api = createServer((req, res) => { handle(req, res).catch((error) => {
      if (!res.headersSent) {
        res.writeHead(/Fixture sign-in required/.test(error.message) ? 401 : 400, { 'Content-Type': 'application/json', ...cors(req) });
        res.end(json({ message: error.message }));
      } else res.destroy();
    }); });
    api.on('upgrade', (_req, socket) => socket.destroy()); // Poll fallback is intentional.
    await listen(api, apiPort);
    return { apiUrl, webUrl, users, seed, stop, startWeb };
  } catch (error) { await stop(); throw error; }

  function cors(req) {
    const origins = [webUrl, `http://localhost:${webPort}`];
    return {
      ...(origins.includes(req.headers.origin) ? { 'Access-Control-Allow-Origin': req.headers.origin } : {}),
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'authorization,apikey,content-type,accept-profile,content-profile,cache-control,x-metadata,x-client-info,prefer,range,range-unit,x-upsert,x-supabase-api-version',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Range,Range-Unit,Content-Disposition',
      'Cache-Control': 'no-store', Vary: 'Origin',
    };
  }

  async function handle(req, res) {
    const reply = (data, status = 200, headers = {}) => {
      res.writeHead(status, { ...cors(req), 'Content-Type': 'application/json', ...headers });
      res.end(req.method === 'HEAD' ? undefined : json(data));
    };
    const url = new URL(req.url, apiUrl);
    if (req.headers.origin && ![webUrl, `http://localhost:${webPort}`].includes(req.headers.origin)) throw new Error('Fixture origin is not allowed');
    if (req.method === 'OPTIONS') { reply(null, 204); return; }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 26 * 1024 * 1024) throw new Error('Fixture request exceeds 26 MiB');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const isJson = (req.headers['content-type'] ?? '').includes('application/json');
    const args = bytes.length && isJson ? JSON.parse(bytes.toString('utf8')) : {};
    if (url.pathname === '/auth/v1/settings' && req.method === 'GET') {
      reply({ external: { email: true, google: false }, disable_signup: true, mailer_autoconfirm: true, phone_autoconfirm: true }); return;
    }
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      let actor;
      if (url.searchParams.get('grant_type') === 'password') {
        actor = users.find((item) => item.email === String(args.email).trim().toLowerCase());
        if (!actor || args.password !== 'preview-pass') throw new Error('Use alice@example.test or bob@example.test with preview-pass');
      } else if (url.searchParams.get('grant_type') === 'refresh_token') {
        const record = refreshTokens.get(args.refresh_token);
        if (!record) throw new Error('Invalid fixture refresh token');
        actor = record.actor;
        accessTokens.delete(record.token); refreshTokens.delete(args.refresh_token);
      } else throw new Error('Unsupported fixture auth grant');
      reply(session(actor)); return;
    }
    // Signed links carry their own short-lived capability; still recheck RLS as
    // the issuer on each download so leaving the space revokes existing links.
    if (/^\/storage\/v1\/object\/sign\//.test(url.pathname) && ['GET', 'HEAD'].includes(req.method)) {
      await download(req, res, url); return;
    }
    const auth = authenticated(req);
    if (url.pathname === '/auth/v1/user' && req.method === 'GET') { reply(auth.actor.user); return; }
    if (url.pathname === '/auth/v1/logout' && req.method === 'POST') {
      for (const [token, record] of accessTokens) if (record.actor.id === auth.actor.id) {
        accessTokens.delete(token); refreshTokens.delete(record.refreshToken);
      }
      reply(null, 204); return;
    }
    if (url.pathname.startsWith('/rest/v1/rpc/') && ['GET', 'POST'].includes(req.method)) {
      const name = decodeURIComponent(url.pathname.slice('/rest/v1/rpc/'.length));
      const rpcArgs = req.method === 'GET' ? Object.fromEntries(url.searchParams) : args;
      reply(await as(auth.actor, (tx) => rpc(tx, name, rpcArgs))); return;
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const rows = await as(auth.actor, (tx) => tableRequest(tx, req, url, args));
      const singular = (req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');
      if (singular && rows.length !== 1) throw new Error('Expected exactly one visible row');
      const representation = req.method !== 'POST' || (req.headers.prefer ?? '').includes('return=representation');
      reply(representation ? (singular ? rows[0] : rows) : null, req.method === 'POST' ? 201 : 200); return;
    }
    if (url.pathname.startsWith('/storage/v1/')) {
      await storage(req, res, url, args, bytes, auth.actor, reply); return;
    }
    throw new Error('Unknown fixture endpoint: ' + url.pathname);
  }

  async function startWeb() {
    // Fail if occupied; never terminate another server or silently switch ports.
    const probe = createProbe();
    await listen(probe, webPort);
    await closeServer(probe);
    fixtureRoot = await mkdtemp(resolve(process.env.SPACES_FIXTURE_TMPDIR ?? tmpdir(), 'samlap-spaces-preview-'));
    for (const directory of ['src', 'components', 'lib', 'public']) {
      await cp(resolve(repoRoot, directory), resolve(fixtureRoot, directory), { recursive: true });
    }
    // A fixture inside the workspace can resolve its parent's dependencies without
    // a junction, which Windows sandboxes may disallow.
    const fixtureRequire = createRequire(resolve(fixtureRoot, 'package.json'));
    let inheritedDependencies = false;
    try { inheritedDependencies = fixtureRequire.resolve('next/package.json') === resolve(repoRoot, 'node_modules/next/package.json'); }
    catch { /* External temporary folders need their own dependency link. */ }
    if (!inheritedDependencies) await symlink(resolve(repoRoot, 'node_modules'), resolve(fixtureRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const pkg = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
    await writeFile(resolve(fixtureRoot, 'package.json'), json({ private: true, type: 'module', dependencies: pkg.dependencies }));
    const env = { NEXT_PUBLIC_SUPABASE_URL: apiUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'spaces-preview-only' };
    await writeFile(resolve(fixtureRoot, 'next.config.mjs'), 'export default ' + json({
      env, devIndicators: false, outputFileTracingRoot: fixtureRoot,
    }) + ';\n');
    // Do not copy .env files or inherit hosted Supabase/service-role secrets.
    const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(path|pathext|systemroot|windir|comspec|temp|tmp|userprofile|localappdata|appdata|homedrive|homepath|systemdrive|number_of_processors|processor_architecture)$/i.test(key)));
    Object.assign(childEnv, env, { VITE_SUPABASE_URL: apiUrl, VITE_SUPABASE_ANON_KEY: 'spaces-preview-only', NEXT_TELEMETRY_DISABLED: '1' });
    console.log(json({ fixtureRoot, url: webUrl, apiUrl, login: 'alice@example.test / preview-pass',
      alternateLogin: 'bob@example.test / preview-pass', seed }));
    child = spawn(process.execPath, [resolve(repoRoot, 'node_modules/next/dist/bin/next'), 'dev', fixtureRoot,
      '-p', String(webPort), '-H', '127.0.0.1', '--webpack'], { cwd: fixtureRoot, env: childEnv, stdio: 'inherit', windowsHide: true });
    child.once('error', (error) => { console.error(error.message); process.exitCode = 1; void stop(); });
    child.once('exit', (code) => { if (!closing) { process.exitCode = code || 1; void stop(); } });
    return fixtureRoot;
  }
}

async function main() {
  const fixture = await createFixture();
  process.once('SIGINT', () => { void fixture.stop(); });
  process.once('SIGTERM', () => { void fixture.stop(); });
  try { await fixture.startWeb(); }
  catch (error) { await fixture.stop(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(json({ message: error.message })); process.exitCode = 1; });
}
