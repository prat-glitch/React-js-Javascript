import { authenticatedUser, json } from '../../../../lib/push-server';
import { searchGifs } from '../../../../lib/gif-search';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return json({ error: 'Sign in to search GIFs.' }, 401);
    const query = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 100);
    return json(await searchGifs(query));
  } catch {
    return json({ error: 'Could not reach GIPHY. Please try again shortly.' }, 502);
  }
}
