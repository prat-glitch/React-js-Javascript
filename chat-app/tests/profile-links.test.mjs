import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionMessage, isProfileToken, parseProfileLink, profileLink, validDisplayName, validPrivatePhone } from '../lib/profile-links.js';

const token = 'fcb1c761-f82b-401a-85e8-0eea80b2b034';
const origin = 'https://chat.example.com';

test('profile links use opaque public tokens without contact details', () => {
  assert.equal(profileLink(token, origin), origin + '/connect/' + token);
  assert.equal(parseProfileLink(profileLink(token, origin), origin), token);
  assert.equal(parseProfileLink(token.toUpperCase(), origin), token);
  assert.equal(parseProfileLink('/connect/' + token, origin), token);
  assert.equal(profileLink('alice@example.com', origin), '');
  assert.equal(isProfileToken('alice@example.com'), false);
});

test('QR and pasted links reject foreign origins, credentials, scripts and extra payloads', () => {
  for (const value of [
    'https://evil.example/connect/' + token,
    'https://chat.example.com.evil.example/connect/' + token,
    'https://attacker@chat.example.com/connect/' + token,
    'https://chat.example.com/connect/' + token + '?accept=true',
    'https://chat.example.com/connect/' + token + '#token=secret',
    'javascript:alert(1)', 'data:text/html,test', '//evil.example/connect/' + token,
    '/connect/' + token + '/extra', '/connect/%66' + token.slice(1), 'a'.repeat(2049), null,
  ]) assert.equal(parseProfileLink(value, origin), null, String(value));
});

test('public names cannot contain email addresses or phone numbers', () => {
  assert.equal(validDisplayName('Ananya'), true);
  assert.equal(validDisplayName('Samlap user'), true);
  for (const name of ['', 'A', 'x'.repeat(61), 'alice@example.com', 'Call +1 234 555 0199', '1234567']) {
    assert.equal(validDisplayName(name), false, name);
  }
  assert.equal(validPrivatePhone('+12345550199'), true);
  assert.equal(validPrivatePhone('1234567'), true);
  for (const number of ['', '123', '1'.repeat(16), 'call1234567']) assert.equal(validPrivatePhone(number), false);
});

test('closed and pending requests have explicit non-connected messages', () => {
  assert.match(connectionMessage('pending_outgoing'), /Waiting/);
  assert.match(connectionMessage('declined'), /cannot send messages/);
  assert.match(connectionMessage('cancelled'), /24 hours/);
  assert.match(connectionMessage('self'), /own profile/);
});
