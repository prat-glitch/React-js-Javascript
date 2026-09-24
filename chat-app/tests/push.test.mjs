import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { validPushSubscription, validMessageWebhook } from '../lib/push-validation.js';

test('accepts real push subscription shape and rejects local endpoints', () => {
  const keys = { p256dh: 'a'.repeat(80), auth: 'b'.repeat(24) };
  assert.equal(validPushSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys }), true);
  assert.equal(validPushSubscription({ endpoint: 'http://localhost:8080/push', keys }), false);
  assert.equal(validPushSubscription({ endpoint: 'https://127.0.0.1/push', keys }), false);
  assert.equal(validPushSubscription({ endpoint: 'https://push.example.com', keys: {} }), false);
});

test('only new basic message inserts trigger a push', () => {
  const record = { id: '21f2cd5c-367c-414e-b518-98059f15acf8' };
  assert.equal(validMessageWebhook({ type: 'INSERT', schema: 'public', table: 'basic_messages', record }), true);
  assert.equal(validMessageWebhook({ type: 'DELETE', schema: 'public', table: 'basic_messages', record }), false);
  assert.equal(validMessageWebhook({ type: 'INSERT', schema: 'public', table: 'messages', record }), false);
});

test('service worker shows a generic notification for every push, even with the app open', async () => {
  const handlers = new Map();
  const shown = [];
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => [{ visibilityState: 'visible' }],
    },
    registration: { showNotification: async (title, options) => shown.push({ title, options }) },
    location: { origin: 'https://samlap.example' },
  };
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL, Date });
  for (let index = 0; index < 2; index++) {
    let done;
    handlers.get('push')({
      data: { json: () => ({ url: '/', tag: `message-${index}`, body: 'private text' }) },
      waitUntil: (promise) => { done = promise; },
    });
    await done;
  }
  assert.equal(shown.length, 2);
  assert.equal(shown[0].title, 'Samlap');
  assert.match(shown[0].options.body, /new message/i);
  assert.doesNotMatch(shown[0].options.body, /private text/);
  assert.equal(shown[0].options.silent, false);
});
