import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { shouldSendTaskAssignmentPush, validTaskAssignmentWebhook } from '../lib/push-validation.js';

const ids = {
  notification: '21f2cd5c-367c-414e-b518-98059f15acf8',
  space: '31f2cd5c-367c-414e-b518-98059f15acf8',
  task: '41f2cd5c-367c-414e-b518-98059f15acf8',
  recipient: '51f2cd5c-367c-414e-b518-98059f15acf8',
  outsider: '61f2cd5c-367c-414e-b518-98059f15acf8',
};
const notification = {
  id: ids.notification, space_id: ids.space, task_id: ids.task,
  recipient_id: ids.recipient, actor_id: ids.outsider, read_at: null,
};
const task = { id: ids.task, space_id: ids.space, assignee_id: ids.recipient, completed_at: null };
const membership = { space_id: ids.space, user_id: ids.recipient, status: 'joined' };
const webhook = { type: 'INSERT', schema: 'public', table: 'space_task_notifications', record: { id: ids.notification } };
const subscription = (endpoint) => ({ endpoint, p256dh: 'public-key', auth_secret: 'auth-key', user_id: ids.recipient });
const payload = {
  url: `/?space=${ids.space}&view=tasks&task=${ids.task}`,
  tag: `task-assignment-${ids.notification}`, kind: 'task_assignment',
};

test('task webhook accepts only public notification inserts with a string UUID', () => {
  assert.equal(validTaskAssignmentWebhook(webhook), true);
  assert.equal(validTaskAssignmentWebhook({ ...webhook, record: { id: ids.notification.toUpperCase() } }), true);
  for (const value of [null, {}, { ...webhook, type: 'UPDATE' }, { ...webhook, type: 'DELETE' },
    { ...webhook, schema: 'private' }, { ...webhook, table: 'basic_messages' },
    { ...webhook, table: 'space_tasks' }, { ...webhook, record: null }]) {
    assert.equal(validTaskAssignmentWebhook(value), false);
  }
  for (const id of [undefined, null, 123, [ids.notification], { toString: () => ids.notification },
    '', 'not-a-uuid', ids.notification + '\n', ' ' + ids.notification,
    ids.notification.replaceAll('-', ''), ids.notification.replace('21f', 'xyz')]) {
    assert.equal(validTaskAssignmentWebhook({ ...webhook, record: { id } }), false);
  }
});

test('only an unread current assignment to a joined recipient is eligible', () => {
  assert.equal(shouldSendTaskAssignmentPush(notification, task, membership), true);
  const cases = [
    [null, task, membership],
    [{ ...notification, read_at: '2026-10-24T12:00:00Z' }, task, membership],
    [notification, null, membership],
    [notification, { ...task, completed_at: '2026-10-24T12:00:00Z' }, membership],
    [notification, { ...task, assignee_id: ids.outsider }, membership],
    [notification, { ...task, assignee_id: null }, membership],
    [notification, { ...task, id: ids.outsider }, membership],
    [notification, { ...task, space_id: ids.outsider }, membership],
    [notification, task, null],
    [notification, task, []],
    [notification, task, { ...membership, status: 'left' }],
    [notification, task, { ...membership, status: 'invited' }],
    [notification, task, { ...membership, status: 'declined' }],
    [notification, task, { ...membership, user_id: ids.outsider }],
    [notification, task, { ...membership, space_id: ids.outsider }],
    [{ ...notification, recipient_id: ids.outsider }, task, membership],
  ];
  for (const args of cases) assert.equal(shouldSendTaskAssignmentPush(...args), false);
  for (const field of ['id', 'space_id', 'task_id', 'recipient_id']) {
    assert.equal(shouldSendTaskAssignmentPush({ ...notification, [field]: 'invalid' }, task, membership), false);
  }
});

// Evaluate production handlers with in-memory dependencies; no database or push network calls.
function loadScript(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  return runInNewContext(source + '\n;({ ' + Object.keys(dependencies.exports).join(', ') + ' });', dependencies);
}

function routeHarness({ rows = {}, errors = {}, configured = true, secret = 'test-webhook-secret', fail = {} } = {}) {
  const tables = {
    space_task_notifications: [notification], space_tasks: [task], space_members: [membership],
    basic_push_subscriptions: [subscription('https://push.example/recipient')], ...rows,
  };
  const queries = [];
  const sent = [];
  const checks = { admin: 0, configured: 0, comparisons: 0 };
  const db = { from(table) {
    const query = { table, filters: [], operation: 'select' };
    function execute(single) {
      queries.push(query);
      if (errors[table]) return Promise.resolve({ data: null, error: errors[table] });
      const found = tables[table].filter((row) => query.filters.every(([key, value]) => row[key] === value));
      const data = query.operation === 'delete' ? null : found.map((row) =>
        Object.fromEntries(query.columns.split(',').map((key) => [key, row[key]])));
      return Promise.resolve({ data: single ? data[0] ?? null : data, error: null });
    }
    const builder = {
      select(columns) { query.columns = columns; return builder; },
      eq(key, value) { query.filters.push([key, value]); return builder; },
      delete() { query.operation = 'delete'; return builder; },
      maybeSingle() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };
    return builder;
  } };
  const { POST } = loadScript('../src/app/api/push/task-assignment/route.js', {
    exports: { POST: true }, process: { env: { PUSH_WEBHOOK_SECRET: secret } },
    createHash, timingSafeEqual(left, right) {
      checks.comparisons++;
      assert.equal(left.length, 32);
      assert.equal(right.length, 32);
      return timingSafeEqual(left, right);
    },
    adminClient() { checks.admin++; return db; },
    json: (data, status = 200) => Response.json(data, { status }),
    shouldSendTaskAssignmentPush, validTaskAssignmentWebhook,
    pushConfigured() { checks.configured++; return configured; },
    async sendGenericPush(target, data) {
      if (fail[target.endpoint]) throw fail[target.endpoint];
      sent.push({ target, payload: JSON.parse(JSON.stringify(data)) });
    },
    console: { error() {} },
  });
  const request = (body = webhook, receivedSecret = 'test-webhook-secret') => ({
    headers: new Headers(receivedSecret === null ? {} : { 'x-push-webhook-secret': receivedSecret }),
    json: async () => body,
  });
  return { POST, request, queries, sent, checks };
}

test('authentication uses fixed-size constant-time comparison before configuration, body or database access', async () => {
  for (const [secret, received] of [['test-webhook-secret', null], ['test-webhook-secret', 'wrong'],
    ['test-webhook-secret', 'x'.repeat(1000)], ['', 'test-webhook-secret']]) {
    const h = routeHarness({ secret, configured: false });
    const request = h.request(undefined, received);
    request.json = () => { assert.fail('unauthorized body must not be parsed'); };
    assert.equal((await h.POST(request)).status, 401);
    assert.equal(h.checks.configured, 0);
    assert.equal(h.checks.admin, 0);
    assert.equal(h.checks.comparisons, secret && received ? 1 : 0);
  }
});

test('configuration and malformed webhooks return existing API error conventions without database access', async () => {
  const h = routeHarness({ configured: false });
  assert.equal((await h.POST(h.request())).status, 503);
  assert.equal(h.checks.admin, 0);
  const ready = routeHarness();
  const request = ready.request();
  request.json = async () => { throw new SyntaxError('bad JSON'); };
  assert.equal((await ready.POST(request)).status, 400);
  for (const event of [{ ...webhook, type: 'UPDATE' }, { ...webhook, record: { id: 'bad' } },
    { ...webhook, table: 'space_tasks' }, null]) {
    assert.equal((await ready.POST(ready.request(event))).status, 400);
  }
  assert.equal(ready.checks.admin, 0);
});

test('trusted rows override tampered webhook fields and only recipient subscriptions receive a generic task link', async () => {
  const h = routeHarness({ rows: { basic_push_subscriptions: [
    subscription('https://push.example/recipient'),
    { ...subscription('https://push.example/outsider'), user_id: ids.outsider },
  ] } });
  const response = await h.POST(h.request({ ...webhook, record: {
    ...notification, recipient_id: ids.outsider, task_id: ids.outsider, space_id: ids.outsider,
    title: 'Private task title', actor_name: 'Private name', read_at: 'tampered',
  } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 1, failed: 0 });
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].target.endpoint, 'https://push.example/recipient');
  assert.deepEqual(h.sent[0].payload, payload);
  assert.deepEqual(h.queries.map((query) => [query.table, query.columns, query.filters]), [
    ['space_task_notifications', 'id,space_id,task_id,recipient_id,read_at', [['id', ids.notification]]],
    ['space_tasks', 'id,space_id,assignee_id,completed_at', [['id', ids.task]]],
    ['space_members', 'space_id,user_id,status', [['space_id', ids.space], ['user_id', ids.recipient], ['status', 'joined']]],
    ['basic_push_subscriptions', 'endpoint,p256dh,auth_secret', [['user_id', ids.recipient]]],
  ]);
});

test('route skips stale, deleted, completed, reassigned, cross-space and nonmember assignments before subscription access', async () => {
  for (const rows of [
    { space_task_notifications: [] },
    { space_task_notifications: [{ ...notification, read_at: '2026-10-24T12:00:00Z' }] },
    { space_tasks: [] },
    { space_tasks: [{ ...task, completed_at: '2026-10-24T12:00:00Z' }] },
    { space_tasks: [{ ...task, assignee_id: ids.outsider }] },
    { space_tasks: [{ ...task, assignee_id: null }] },
    { space_tasks: [{ ...task, space_id: ids.outsider }] },
    { space_members: [] },
    { space_members: [{ ...membership, status: 'left' }] },
    { space_members: [{ ...membership, status: 'invited' }] },
    { space_members: [{ ...membership, user_id: ids.outsider }] },
    { space_members: [{ ...membership, space_id: ids.outsider }] },
  ]) {
    const h = routeHarness({ rows });
    const response = await h.POST(h.request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sent: 0 });
    assert.equal(h.sent.length, 0);
    assert.ok(h.queries.every((query) => query.table !== 'basic_push_subscriptions'));
  }
  const h = routeHarness({ rows: { basic_push_subscriptions: [] } });
  assert.deepEqual(await (await h.POST(h.request())).json(), { sent: 0 });
});

test('delivery is best effort and removes only recipient endpoints returning 404 or 410', async () => {
  const subscriptions = ['ok', 'gone404', 'gone410', 'retry'].map((name) => subscription(`https://push.example/${name}`));
  const fail = Object.fromEntries(subscriptions.slice(1).map((entry, index) =>
    [entry.endpoint, { statusCode: [404, 410, 503][index] }]));
  for (const targets of [subscriptions, subscriptions.slice(1)]) {
    const h = routeHarness({ rows: { basic_push_subscriptions: targets }, fail });
    const response = await h.POST(h.request());
    assert.equal(response.status, targets.length === 4 ? 200 : 502);
    assert.deepEqual(await response.json(), { sent: targets.length === 4 ? 1 : 0, failed: 3 });
    assert.deepEqual(h.queries.filter((query) => query.operation === 'delete').map((query) => query.filters), [
      [['endpoint', subscriptions[1].endpoint], ['user_id', ids.recipient]],
      [['endpoint', subscriptions[2].endpoint], ['user_id', ids.recipient]],
    ]);
  }
});

test('database errors stop delivery and return 500 for each trusted lookup', async () => {
  for (const table of ['space_task_notifications', 'space_tasks', 'space_members', 'basic_push_subscriptions']) {
    const h = routeHarness({ errors: { [table]: new Error('database unavailable') } });
    const response = await h.POST(h.request());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Push delivery failed.' });
    assert.equal(h.sent.length, 0);
    assert.equal(h.queries.at(-1).table, table);
  }
});

test('push transport preserves the exact DM payload and includes optional task kind without private content', async () => {
  const calls = [];
  const { sendGenericPush } = loadScript('../lib/send-push.js', {
    exports: { sendGenericPush: true }, process: { env: {
      VAPID_PRIVATE_KEY: 'private', NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'public', VAPID_SUBJECT: 'mailto:push@example.com',
    } },
    webpush: { async sendNotification(...args) { calls.push(args); } },
  });
  const dm = { url: '/?chat=' + ids.space, tag: 'message-' + ids.notification };
  await sendGenericPush(subscription('https://push.example/recipient'), dm);
  await sendGenericPush(subscription('https://push.example/recipient'), { ...payload, title: 'Private title', body: 'Private text' });
  assert.equal(calls[0][1], JSON.stringify(dm));
  assert.deepEqual(JSON.parse(calls[1][1]), payload);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1][0])), {
    endpoint: 'https://push.example/recipient', keys: { p256dh: 'public-key', auth: 'auth-key' },
  });
  assert.equal(calls[1][2].TTL, 3600);
  assert.equal(calls[1][2].urgency, 'high');
});

function workerHarness(visible = false, windows = null) {
  const handlers = new Map();
  const shown = [];
  const opened = [];
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    clients: {
      matchAll: async () => windows ?? [{ visibilityState: visible ? 'visible' : 'hidden' }],
      openWindow: async (url) => opened.push(url),
    },
    registration: { showNotification: async (title, options) => shown.push({ title, options }) },
    location: { origin: 'https://samlap.example' },
  };
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL, Date });
  async function dispatch(name, event) {
    let done;
    handlers.get(name)({ ...event, waitUntil(promise) { done = promise; } });
    await done;
  }
  return { dispatch, shown, opened };
}

test('service worker uses exact task kind, fixed generic text and existing visible/silent behavior', async () => {
  for (const visible of [true, false]) {
    const h = workerHarness(visible);
    await h.dispatch('push', { data: { json: () => ({ ...payload, title: 'Private name', body: 'Private task' }) } });
    const { title, options } = h.shown[0];
    assert.equal(title, 'Samlap');
    assert.equal(options.body, 'A task was assigned to you in Samlap.');
    assert.equal(options.tag, payload.tag);
    assert.equal(options.data.url, payload.url);
    assert.equal(options.silent, visible ? true : undefined);
    assert.equal(options.vibrate?.join(','), visible ? undefined : '120,60,120');
  }
  for (const kind of [undefined, null, '', 'TASK_ASSIGNMENT', 'task_assignment ', ['task_assignment'], {}, 'message']) {
    const h = workerHarness();
    await h.dispatch('push', { data: { json: () => ({ kind, body: 'private content' }) } });
    assert.equal(h.shown[0].options.body, 'You have a new message in Samlap.');
  }
  for (const data of [undefined, { json: () => null }, { json: () => { throw new SyntaxError('bad payload'); } }]) {
    const h = workerHarness();
    await h.dispatch('push', { data });
    assert.equal(h.shown[0].options.body, 'You have a new message in Samlap.');
  }
});

test('task notification clicks open the task link or navigate and focus an existing window, keeping origin protection', async () => {
  const calls = [];
  const window = {
    url: 'https://samlap.example/',
    navigate: async (url) => calls.push(['navigate', url]),
    focus: async () => calls.push(['focus']),
  };
  for (const windows of [[], [window]]) {
    const h = workerHarness(false, windows);
    let closed = false;
    await h.dispatch('notificationclick', { notification: { data: { url: payload.url }, close() { closed = true; } } });
    assert.equal(closed, true);
    if (windows.length) assert.deepEqual(calls, [['navigate', 'https://samlap.example' + payload.url], ['focus']]);
    else assert.deepEqual(h.opened, ['https://samlap.example' + payload.url]);
  }
  const h = workerHarness(false, []);
  await h.dispatch('notificationclick', { notification: { data: { url: 'https://evil.example/' }, close() {} } });
  assert.deepEqual(h.opened, ['https://samlap.example']);
});
