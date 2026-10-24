import test from 'node:test';
import assert from 'node:assert/strict';
import { SPACE_FILE_LIMIT, localDateKey, mergeSpaceMessages, safeSpaceUrl, spaceFileType, spaceMessageLinks, taskDueLabel, validateSpaceFile } from '../lib/spaces.js';

test('space uploads validate names, file size, extension and MIME together', () => {
  const valid = { name: 'Train tickets.pdf', size: 1024, type: 'application/pdf' };
  assert.equal(validateSpaceFile(valid), '');
  assert.equal(validateSpaceFile({ ...valid, size: SPACE_FILE_LIMIT }), '');
  for (const change of [{ name: '../tickets.pdf' }, { name: 'bad\nname.pdf' }, { name: 'x'.repeat(181) },
    { size: SPACE_FILE_LIMIT + 1 }, { size: 0 }, { size: NaN }, { name: 'script.svg', type: 'image/svg+xml' },
    { name: 'invoice.html', type: 'text/html' }, { type: 'image/png' }]) assert.ok(validateSpaceFile({ ...valid, ...change }));
  assert.equal(spaceFileType({ ...valid, type: '' }), 'application/pdf');
  assert.equal(spaceFileType({ ...valid, type: 'application/octet-stream' }), 'application/pdf');
});

test('shared links accept only safe web URLs and retain balanced URL punctuation', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://user:secret@example.com',
    'https://example.com/\nsecret', 'https://example.com/a b']) assert.equal(safeSpaceUrl(value), null);
  assert.deepEqual(spaceMessageLinks('See (https://example.com/hotel). And https://example.com/Map_(town)!'),
    ['https://example.com/hotel', 'https://example.com/Map_(town)']);
  assert.deepEqual(spaceMessageLinks('https://example.com/a https://example.com/a'), ['https://example.com/a']);
  assert.deepEqual(spaceMessageLinks('samlap:gif:v1:{"url":"https://media.giphy.com/test.gif"}'), []);
});

test('message pages deduplicate overlapping live events and preserve timestamp ties', () => {
  const a = { id: 'a', created_at: '2026-10-23T12:00:00.000001+00:00', body: 'Earlier' };
  const b = { id: 'b', created_at: a.created_at, body: 'Same microsecond' };
  const c = { id: 'c', created_at: '2026-10-23T12:00:00.000002+00:00', body: 'New' };
  assert.deepEqual(mergeSpaceMessages([b, a], [c, b]).map((item) => item.id), ['a', 'b', 'c']);
  assert.equal(mergeSpaceMessages([a], [{ ...a, body: 'Updated' }])[0].body, 'Updated');
});

test('task dates use local calendar dates and distinguish overdue, today and future', () => {
  assert.equal(localDateKey(new Date(2026, 9, 23, 0, 5)), '2026-10-23');
  assert.equal(taskDueLabel(null, '2026-10-23'), '');
  assert.equal(taskDueLabel('2026-10-23', '2026-10-23'), 'Due today');
  assert.match(taskDueLabel('2026-10-22', '2026-10-23'), /^Overdue/);
  assert.match(taskDueLabel('2026-10-24', '2026-10-23'), /^Due /);
});
