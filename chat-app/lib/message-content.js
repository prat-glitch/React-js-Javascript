const GIF_PREFIX = 'samlap:gif:v1:';

// Match whole emoji sequences, including flags, keycaps, skin tones and ZWJ families.
const EMOJI_ONLY = /^(?:(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)\s*)+$/u;

export function isEmojiOnly(body) {
  return typeof body === 'string' && EMOJI_ONLY.test(body.trim());
}

export function isGiphyGifUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^(media\d*|i)\.giphy\.com$/.test(url.hostname) &&
      !url.username && !url.password && /\.gif$/i.test(url.pathname);
  } catch {
    return false;
  }
}

// Store GIF metadata in the existing message body so no database migration is needed.
export function encodeGifMessage(gif, text = '') {
  if (!isGiphyGifUrl(gif?.url)) throw new Error('Choose a GIF from the search results.');
  return GIF_PREFIX + JSON.stringify({ url: gif.url, title: String(gif.title || 'GIF').slice(0, 200), text: text.trim() });
}

export function parseGifMessage(body) {
  if (typeof body !== 'string' || !body.startsWith(GIF_PREFIX)) return null;
  try {
    const gif = JSON.parse(body.slice(GIF_PREFIX.length));
    return isGiphyGifUrl(gif?.url) && typeof gif.title === 'string' && typeof gif.text === 'string' ? gif : null;
  } catch {
    return null;
  }
}

export function messagePreview(body) {
  const gif = parseGifMessage(body);
  return gif ? (gif.text ? 'GIF · ' + gif.text : 'GIF') : body;
}
