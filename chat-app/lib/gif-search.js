import { GiphyFetch } from '@giphy/js-fetch-api';
import { searchGifLibrary } from './gif-library.js';
import { isGiphyGifUrl } from './message-content.js';

export async function searchGifs(query, { apiKey = process.env.GIPHY_API_KEY, client, timeoutMs = 5000 } = {}) {
  const fallback = () => ({ gifs: searchGifLibrary(query), source: 'library' });
  if (!apiKey?.trim()) return fallback();
  let timer;
  try {
    const giphy = client || new GiphyFetch(apiKey.trim());
    const options = { limit: 24, rating: 'pg' };
    const { data } = await Promise.race([
      query ? giphy.search(query, options) : giphy.trending(options),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('GIF search timed out')), timeoutMs); }),
    ]);
    if (!Array.isArray(data)) throw new Error('Invalid GIF search response');
    const gifs = data.flatMap((gif) => {
      const image = [gif?.images?.fixed_width, gif?.images?.original].find((image) => isGiphyGifUrl(image?.url));
      return image ? [{ id: gif.id, title: gif.title || 'GIF', url: image.url, width: Number(image.width) || 200, height: Number(image.height) || 200 }] : [];
    });
    if (data.length && !gifs.length) return fallback();
    return { gifs, source: 'giphy' };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
