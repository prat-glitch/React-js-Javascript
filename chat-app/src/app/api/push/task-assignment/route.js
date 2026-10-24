import { createHash, timingSafeEqual } from 'node:crypto';
import { adminClient, json } from '../../../../../lib/push-server.js';
import { shouldSendTaskAssignmentPush, validTaskAssignmentWebhook } from '../../../../../lib/push-validation.js';
import { pushConfigured, sendGenericPush } from '../../../../../lib/send-push.js';

export const runtime = 'nodejs';

function secretMatches(received, expected) {
  if (!received || !expected) return false;
  const left = createHash('sha256').update(received).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function POST(request) {
  if (!secretMatches(request.headers.get('x-push-webhook-secret'), process.env.PUSH_WEBHOOK_SECRET)) {
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
  if (!validTaskAssignmentWebhook(event)) return json({ error: 'Unexpected webhook event.' }, 400);

  try {
    const db = adminClient();
    // Only the ID comes from the webhook; all delivery decisions use database rows.
    const { data: notification, error: notificationError } = await db.from('space_task_notifications')
      .select('id,space_id,task_id,recipient_id,read_at').eq('id', event.record.id).maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification || notification.read_at) return json({ sent: 0 });

    const { data: task, error: taskError } = await db.from('space_tasks')
      .select('id,space_id,assignee_id,completed_at').eq('id', notification.task_id).maybeSingle();
    if (taskError) throw taskError;
    if (!task) return json({ sent: 0 });

    const { data: membership, error: membershipError } = await db.from('space_members')
      .select('space_id,user_id,status').eq('space_id', notification.space_id)
      .eq('user_id', notification.recipient_id).eq('status', 'joined').maybeSingle();
    if (membershipError) throw membershipError;
    if (!shouldSendTaskAssignmentPush(notification, task, membership)) return json({ sent: 0 });

    const { data: subscriptions, error: subscriptionError } = await db.from('basic_push_subscriptions')
      .select('endpoint,p256dh,auth_secret').eq('user_id', notification.recipient_id);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return json({ sent: 0 });

    const payload = {
      url: '/?space=' + notification.space_id + '&view=tasks&task=' + notification.task_id,
      tag: 'task-assignment-' + notification.id,
      kind: 'task_assignment',
    };
    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await sendGenericPush(subscription, payload);
        return true;
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await db.from('basic_push_subscriptions').delete()
            .eq('endpoint', subscription.endpoint).eq('user_id', notification.recipient_id);
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
