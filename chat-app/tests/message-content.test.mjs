import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeGifMessage, isEmojiOnly, isGiphyGifUrl, messagePreview, parseGifMessage } from '../lib/message-content.js';

const gif = { url: 'https://media2.giphy.com/media/example/giphy.gif?cid=test', title: 'Hello wave' };

test('emoji-only messages include combined emoji, flags, keycaps and whitespace', () => {
  for (const body of ['😀', '  👋🏽  ', '❤️ 😂', '👨‍👩‍👧‍👦', '👩🏽‍💻', '🇮🇳', '1️⃣ #️⃣', '😊\n🎉', '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}']) {
    assert.equal(isEmojiOnly(body), true, body);
  }
});

test('text, bare digits and incomplete emoji sequences retain message bubbles', () => {
  for (const body of ['', '   ', null, 'Hello 👋', '123', '#', '😂!', '🏽', '🇮', '👩‍', 'https://example.com/😊']) {
    assert.equal(isEmojiOnly(body), false, String(body));
  }
});

test('GIF messages round trip with captions and remain readable in chat previews', () => {
  const body = encodeGifMessage(gif, '  Hello 👋  ');
  assert.deepEqual(parseGifMessage(body), { ...gif, text: 'Hello 👋' });
  assert.equal(messagePreview(body), 'GIF · Hello 👋');
  assert.equal(messagePreview(encodeGifMessage(gif)), 'GIF');
  assert.equal(messagePreview('Ordinary message 👋'), 'Ordinary message 👋');
});

test('untrusted URLs and malformed GIF metadata stay plain text', () => {
  for (const url of ['javascript:alert(1)', 'http://media.giphy.com/a.gif', 'https://media.giphy.com.evil.test/a.gif', 'https://evil.test/a.gif', 'https://media.giphy.com/a.html', 'https://name:password@media.giphy.com/a.gif']) {
    assert.equal(isGiphyGifUrl(url), false, url);
    assert.throws(() => encodeGifMessage({ url }));
    const body = 'samlap:gif:v1:' + JSON.stringify({ url, title: 'GIF', text: '' });
    assert.equal(parseGifMessage(body), null);
    assert.equal(messagePreview(body), body);
  }
  for (const body of ['hello', 'samlap:gif:v1:{', 'samlap:gif:v1:null', 'samlap:gif:v1:' + JSON.stringify({ url: gif.url, text: 42 })]) {
    assert.equal(parseGifMessage(body), null);
  }
});
