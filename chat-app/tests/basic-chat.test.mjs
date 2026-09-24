import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, normalizeMessage } from '../lib/chat-utils.js';

test('phone numbers are normalized for exact lookup', () => {
  assert.equal(normalizePhone('+1 (234) 555-0199'), '+12345550199');
  assert.equal(normalizePhone(' 987 654 '), '987654');
  assert.equal(normalizePhone('abc'), '');
});

test('blank messages are not sent', () => {
  assert.equal(normalizeMessage('   '), '');
  assert.equal(normalizeMessage(' hello\n'), 'hello');
});
