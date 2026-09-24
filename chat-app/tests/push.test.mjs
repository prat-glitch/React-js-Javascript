import test from 'node:test';
import assert from 'node:assert/strict';
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
