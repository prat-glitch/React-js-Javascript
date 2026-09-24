import { adminClient, authenticatedUser, json } from '../../../../../lib/push-server';
import { pushConfigured, sendGenericPush } from '../../../../../lib/send-push';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return json({ error: 'Sign in required.' }, 401);
    if (!pushConfigured()) return json({ error: 'Push delivery is not configured on the server.' }, 503);
    if (Number(request.headers.get('content-length')) > 4096) return json({ error: 'Request too large.' }, 413);
    const { endpoint } = await request.json();
    if (typeof endpoint !== 'string' || endpoint.length > 2048) return json({ error: 'Invalid subscription.' }, 400);
    const db = adminClient();
    const { data: subscription, error } = await db.from('basic_push_subscriptions')
      .select('endpoint,p256dh,auth_secret').eq('user_id', user.id).eq('endpoint', endpoint).maybeSingle();
    if (error) throw error;
    if (!subscription) return json({ error: 'This device is not registered. Enable notifications again.' }, 404);
    try {
      await sendGenericPush(subscription, { tag: 'test-' + Date.now() });
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) {
        await db.from('basic_push_subscriptions').delete().eq('endpoint', endpoint);
        return json({ error: 'This subscription expired. Enable notifications again.' }, 410);
      }
      console.error('Test push failed:', error.statusCode || error.message);
      return json({ error: 'Push service rejected the test notification. Check the server logs.' }, 502);
    }
    return json({ sent: true });
  } catch (error) {
    console.error('Test push request failed:', error);
    return json({ error: 'Could not send a test notification.' }, 500);
  }
}
