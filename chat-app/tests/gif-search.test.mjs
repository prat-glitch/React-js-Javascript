import test from 'node:test';
import assert from 'node:assert/strict';
import { searchGifLibrary } from '../lib/gif-library.js';
import { searchGifs } from '../lib/gif-search.js';
import { isGiphyGifUrl, encodeGifMessage, parseGifMessage } from '../lib/message-content.js';

test('missing or blank API keys provide usable, searchable reaction GIFs', async () => {
  for (const apiKey of ['', '   ']) {
    const result = await searchGifs('', { apiKey });
    assert.equal(result.source, 'library');
    assert.ok(result.gifs.length >= 10);
    assert.ok(result.gifs.every((gif) => isGiphyGifUrl(gif.url)));
    assert.equal(new Set(result.gifs.map((gif) => gif.id)).size, result.gifs.length);
  }
  for (const query of ['hello', ' LOVE ', 'happy', 'thank you', 'cat']) {
    const { gifs } = await searchGifs(query, { apiKey: '' });
    assert.ok(gifs.length > 0, query);
    assert.equal(parseGifMessage(encodeGifMessage(gifs[0], 'Hello')).url, gifs[0].url);
  }
  assert.deepEqual(searchGifLibrary('no-such-reaction-xyz'), []);
});

test('provider failures, invalid responses and timeouts fall back to reactions', async () => {
  const clients = [
    { search: async () => { throw new Error('Invalid key or rate limited'); } },
    { search: async () => ({ data: null }) },
    { search: () => new Promise(() => {}) },
  ];
  for (const client of clients) {
    const result = await searchGifs('hello', { apiKey: 'test-key', client, timeoutMs: 10 });
    assert.equal(result.source, 'library');
    assert.ok(result.gifs.length > 0);
  }
});

test('live search handles missing renditions and retains genuine empty search results', async () => {
  const image = { url: 'https://media.giphy.com/media/test/giphy.gif', width: '200', height: '150' };
  const client = { search: async (query, options) => {
    assert.equal(query, 'hello');
    assert.equal(options.rating, 'pg');
    return { data: [{ id: 'original-only', title: 'Hello', images: { original: image } }, { id: 'missing-images' }] };
  } };
  const result = await searchGifs('hello', { apiKey: 'test-key', client });
  assert.equal(result.source, 'giphy');
  assert.equal(result.gifs.length, 1);
  assert.equal(result.gifs[0].width, 200);
  assert.equal(result.gifs[0].url, image.url);
  assert.deepEqual(await searchGifs('none', { apiKey: 'test-key', client: { search: async () => ({ data: [] }) } }), { gifs: [], source: 'giphy' });
  const trending = await searchGifs('', { apiKey: 'test-key', client: { trending: async () => ({ data: [{ id: 'trending', images: { fixed_width: image } }] }) } });
  assert.equal(trending.gifs[0].id, 'trending');
});
