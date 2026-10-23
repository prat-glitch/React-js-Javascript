// Manual browser fixture. Binds only to loopback and never contacts hosted Supabase.
// Run: node tests/fixtures/profile-ui-server.mjs (fake login: alice@example.test / preview-pass)
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdir, symlink, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';

const webPort = 5174, apiPort = 5181;
process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${apiPort}`;
process.env.VITE_SUPABASE_ANON_KEY = 'profile-preview-only';
const alice = { id: randomUUID(), name: 'Alice', token: 'fcb1c761-f82b-401a-85e8-0eea80b2b034' };
const bob = { id: randomUUID(), name: 'Bob', token: '3b7802f5-4051-4f88-9867-310ef58036f2' };
const dana = { id: randomUUID(), name: 'Dana', token: '9ad43da0-1620-4269-987e-62f15cbfa658' };
const user = { id: alice.id, aud: 'authenticated', role: 'authenticated', email: 'alice@example.test',
  email_confirmed_at: new Date().toISOString(), user_metadata: { display_name: 'Alice' }, app_metadata: { provider: 'email' } };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: alice.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}.fixture-only`;
const requests = [{ request_id: randomUUID(), direction: 'incoming', peer_name: 'Dana', peer_token: dana.token, status: 'pending', chat_id: null }];
const chats = [], messages = [];
const profile = () => ({ display_name: 'Alice', share_token: alice.token, phone: '+12345550199' });
function card(shareToken) {
  const person = [alice, bob, dana].find((item) => item.token === shareToken);
  if (!person) return null;
  const request = requests.find((item) => item.peer_token === shareToken);
  const chat = chats.find((item) => item.peer_token === shareToken);
  return { display_name: person.name, share_token: person.token, request_id: request?.request_id || null,
    chat_id: chat?.chat_id || null, status: person === alice ? 'self' : chat ? 'connected' :
      request?.status === 'pending' ? 'pending_' + request.direction : request?.status || 'available' };
}
const api = createServer(async (req, res) => {
  const headers = { 'Access-Control-Allow-Origin': `http://localhost:${webPort}`, 'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
  const reply = (data, status = 200) => { res.writeHead(status, headers); res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') { reply({}); return; }
  const url = new URL(req.url, process.env.VITE_SUPABASE_URL);
  let body = '';
  for await (const chunk of req) body += chunk;
  const args = body ? JSON.parse(body) : {};
  if (url.pathname === '/auth/v1/settings') { reply({ external: { email: true, google: false }, mailer_autoconfirm: true }); return; }
  if (url.pathname === '/auth/v1/token') { reply({ access_token: token, token_type: 'bearer', expires_in: 86400, refresh_token: 'fixture-refresh', user }); return; }
  if (url.pathname === '/auth/v1/user') { reply(user); return; }
  if (!req.headers.authorization?.includes(token)) { reply({ message: 'Fixture sign-in required' }, 401); return; }
  const rpc = url.pathname.split('/rpc/')[1];
  if (rpc === 'ensure_basic_profile' || rpc === 'save_basic_profile') { reply(profile()); return; }
  if (rpc === 'list_basic_chats') { reply(chats); return; }
  if (rpc === 'list_basic_chat_requests') { reply(requests); return; }
  if (rpc === 'get_basic_profile_card') { reply(card(args.p_share_token)); return; }
  if (rpc === 'send_basic_chat_request') {
    const existing = requests.find((item) => item.peer_token === args.p_share_token);
    if (existing) { reply({ status: existing.status === 'pending' ? 'pending_' + existing.direction : existing.status, request_id: existing.request_id }); return; }
    const created = { request_id: randomUUID(), direction: 'outgoing', peer_name: 'Bob', peer_token: bob.token, status: 'pending', chat_id: null };
    requests.push(created); reply({ status: 'pending_outgoing', request_id: created.request_id }); return;
  }
  if (rpc === 'respond_basic_chat_request') {
    const request = requests.find((item) => item.request_id === args.p_request_id);
    if (!request) { reply({ message: 'Request unavailable' }, 404); return; }
    request.status = args.p_accept ? 'accepted' : 'declined';
    if (args.p_accept) {
      request.chat_id = randomUUID();
      chats.push({ chat_id: request.chat_id, peer_name: request.peer_name, peer_token: request.peer_token, peer_id: dana.id,
        last_body: '', last_at: null, unread_count: 0 });
    }
    reply({ status: args.p_accept ? 'connected' : 'declined', chat_id: request.chat_id }); return;
  }
  if (rpc === 'cancel_basic_chat_request') {
    const request = requests.find((item) => item.request_id === args.p_request_id);
    request.status = 'cancelled'; reply({ status: 'cancelled' }); return;
  }
  if (rpc === 'mark_basic_chat_read') { reply(null); return; }
  if (url.pathname === '/rest/v1/basic_messages') {
    if (req.method === 'POST') messages.push({ id: randomUUID(), ...args, created_at: new Date().toISOString(), read_at: null });
    reply(req.method === 'POST' ? null : messages); return;
  }
  reply({ message: 'Unknown fixture endpoint' }, 404);
});
api.listen(apiPort, '127.0.0.1');
const fixtureRoot = resolve(tmpdir(), 'samlap-profile-preview-' + process.pid);
await mkdir(fixtureRoot, { recursive: true });
for (const directory of ['src', 'components', 'lib', 'public']) {
  await cp(resolve(directory), resolve(fixtureRoot, directory), { recursive: true });
}
await symlink(resolve('node_modules'), resolve(fixtureRoot, 'node_modules'), 'junction');
await writeFile(resolve(fixtureRoot, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { next: '*', react: '*', 'react-dom': '*' } }));
await writeFile(resolve(fixtureRoot, 'next.config.mjs'), 'export default ' + JSON.stringify({ env: {
  NEXT_PUBLIC_SUPABASE_URL: process.env.VITE_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
} }));
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'dev', fixtureRoot,
  '-p', String(webPort), '-H', '127.0.0.1', '--webpack'], { stdio: 'inherit', windowsHide: true });
const imagePath = resolve('tests/fixtures/profile-qr.png');
await QRCode.toFile(imagePath, `http://localhost:${webPort}/connect/${bob.token}`, { width: 256, margin: 4 });
console.log(JSON.stringify({ url: `http://localhost:${webPort}`, qrImage: imagePath, bobToken: bob.token }));
function stop() { child.kill(); api.close(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
