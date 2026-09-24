import { createHash, timingSafeEqual } from 'node:crypto';
import { adminClient, json } from '../../../../../lib/push-server';
import { shouldSendMessagePush, validMessageWebhook } from '../../../../../lib/push-validation';
import { pushConfigured, sendGenericPush } from '../../../../../lib/send-push';

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
  if (!pushConfigured()) {
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
    // A foreground chat already made its own sound; don't send a stale push later.
    if (!shouldSendMessagePush(message)) return json({ sent: 0 });

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

    const notification = { url: '/?chat=' + message.chat_id, tag: 'message-' + message.id };
    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await sendGenericPush(subscription, notification);
        return true;
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await db.from('basic_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
        console.error('Push delivery failed:', error.statusCode || error.message);
        return false;
      }
    }));
    const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length;
    return json({ sent, failed: results.length - sent }, sent ? 200 : 502);
  } catch (error) {
    console.error('Push webhook failed:', error);
    return json({ error: 'Push delivery failed.' }, 500);
  }
}
