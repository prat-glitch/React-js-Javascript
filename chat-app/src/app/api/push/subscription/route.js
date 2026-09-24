import { adminClient, authenticatedUser, json } from '../../../../../lib/push-server';
import { validPushSubscription } from '../../../../../lib/push-validation';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return json({ error: 'Sign in required.' }, 401);
    if (Number(request.headers.get('content-length')) > 8192) return json({ error: 'Subscription too large.' }, 413);
    const subscription = await request.json();
    if (!validPushSubscription(subscription)) return json({ error: 'Invalid push subscription.' }, 400);
    const { error } = await adminClient().from('basic_push_subscriptions').upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_secret: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return json({ ok: true });
  } catch {
    return json({ error: 'Could not save the push subscription.' }, 500);
  }
}

export async function DELETE(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return json({ error: 'Sign in required.' }, 401);
    const { endpoint } = await request.json();
    if (typeof endpoint !== 'string' || endpoint.length > 2048) return json({ error: 'Invalid endpoint.' }, 400);
    const { error } = await adminClient().from('basic_push_subscriptions')
      .delete().eq('user_id', user.id).eq('endpoint', endpoint);
    if (error) throw error;
    return json({ ok: true });
  } catch {
    return json({ error: 'Could not remove the push subscription.' }, 500);
  }
}
