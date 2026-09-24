import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncomingTracker, noticeLoadedMessages, noticeRealtimeMessage } from '../lib/incoming-alerts.js';

const incoming = (id) => ({ id, chat_id: 'chat-1', sender_id: 'other' });

test('a live incoming message sounds immediately and not again after history reload', () => {
  const tracker = createIncomingTracker('chat-1');
  assert.equal(noticeLoadedMessages(tracker, [incoming('old')], 'me'), false);
  assert.equal(noticeRealtimeMessage(tracker, incoming('new'), 'me'), true);
  assert.equal(noticeRealtimeMessage(tracker, incoming('new'), 'me'), false);
  assert.equal(noticeLoadedMessages(tracker, [incoming('old'), incoming('new')], 'me'), false);
});

test('polling fallback sounds once when a live event is missed', () => {
  const tracker = createIncomingTracker('chat-1');
  assert.equal(noticeLoadedMessages(tracker, [], 'me'), false);
  assert.equal(noticeLoadedMessages(tracker, [incoming('new')], 'me'), true);
  assert.equal(noticeRealtimeMessage(tracker, incoming('new'), 'me'), false);
  assert.equal(noticeLoadedMessages(tracker, [incoming('new')], 'me'), false);
});

test('a stale history response cannot replay an already sounded live message', () => {
  const tracker = createIncomingTracker('chat-1');
  assert.equal(noticeLoadedMessages(tracker, [incoming('old')], 'me'), false);
  assert.equal(noticeRealtimeMessage(tracker, incoming('new'), 'me'), true);
  assert.equal(noticeLoadedMessages(tracker, [incoming('old')], 'me'), false);
  assert.equal(noticeLoadedMessages(tracker, [incoming('old'), incoming('new')], 'me'), false);
});

test('the sender and older messages never trigger an incoming sound', () => {
  const tracker = createIncomingTracker('chat-1');
  assert.equal(noticeRealtimeMessage(tracker, { id: 'mine', chat_id: 'chat-1', sender_id: 'me' }, 'me'), false);
  assert.equal(noticeLoadedMessages(tracker, [incoming('old')], 'me'), false);
});
