import { createHash, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { adminClient, json } from '../../../../../lib/push-server';
import { validMessageWebhook } from '../../../../../lib/push-validation';

export const runtime = 'nodejs';

function secretMatches(received, expected) {
  if (!received || !expected) return false;
  const left = createHash('sha256').update(received).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function POST(request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secretMatches(request.headers.get('x-push-webhook-secret'), secret)) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  if (!secret || !process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return json({ error: 'Push delivery is not configured.' }, 503);
  }
  let event;
  try {
    event = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (!validMessageWebhook(event)) return json({ error: 'Unexpected webhook event.' }, 400);

  try {
    const db = adminClient();
    const { data: message, error: messageError } = await db.from('basic_messages')
      .select('id,chat_id,sender_id,read_at').eq('id', event.record.id).maybeSingle();
    if (messageError) throw messageError;
    if (!message || message.read_at) return json({ sent: 0 });

    const { data: chat, error: chatError } = await db.from('basic_chats')
      .select('member_a,member_b').eq('id', message.chat_id).maybeSingle();
    if (chatError) throw chatError;
    if (!chat || ![chat.member_a, chat.member_b].includes(message.sender_id)) {
      return json({ error: 'Invalid chat message.' }, 400);
    }
    const recipient = chat.member_a === message.sender_id ? chat.member_b : chat.member_a;
    const { data: subscriptions, error: subscriptionError } = await db.from('basic_push_subscriptions')
      .select('endpoint,p256dh,auth_secret').eq('user_id', recipient);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return json({ sent: 0 });

    const payload = JSON.stringify({
      title: 'Samlap',
      body: 'You have a new message.',
      url: '/?chat=' + message.chat_id,
      tag: 'chat-' + message.chat_id,
    });
    const vapidDetails = {
      subject: process.env.VAPID_SUBJECT,
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
        }, payload, { vapidDetails, TTL: 3600, urgency: 'high', timeout: 10000 });
        return true;
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await db.from('basic_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
        return false;
      }
    }));
    return json({ sent: results.filter((result) => result.status === 'fulfilled' && result.value).length });
  } catch {
    return json({ error: 'Push delivery failed.' }, 500);
  }
}
