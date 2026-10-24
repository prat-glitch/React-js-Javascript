import { isIP } from 'node:net';

export function validPushSubscription(value) {
  if (!value || typeof value !== 'object') return false;
  const { endpoint, keys } = value;
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !keys) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (isIP(url.hostname) || url.hostname === 'localhost' || url.hostname.endsWith('.local')) return false;
  } catch {
    return false;
  }
  return ['p256dh', 'auth'].every((key) =>
    typeof keys[key] === 'string' &&
    keys[key].length >= 20 && keys[key].length <= 512 &&
    /^[A-Za-z0-9_-]+$/.test(keys[key])
  );
}

export function validMessageWebhook(value) {
  return value?.type === 'INSERT' &&
    value?.schema === 'public' &&
    value?.table === 'basic_messages' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value?.record?.id || '');
}

export function shouldSendMessagePush(message) {
  return Boolean(message && !message.read_at);
}

function validUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validTaskAssignmentWebhook(value) {
  return value?.type === 'INSERT' &&
    value?.schema === 'public' &&
    value?.table === 'space_task_notifications' &&
    validUuid(value?.record?.id);
}

// Membership is a single trusted space_members row, not a webhook field.
export function shouldSendTaskAssignmentPush(notification, task, membership) {
  return Boolean(
    notification && task && membership &&
    ['id', 'space_id', 'task_id', 'recipient_id'].every((key) => validUuid(notification[key])) &&
    !notification.read_at && !task.completed_at &&
    task.id === notification.task_id &&
    task.space_id === notification.space_id &&
    task.assignee_id === notification.recipient_id &&
    membership.space_id === notification.space_id &&
    membership.user_id === notification.recipient_id &&
    membership.status === 'joined'
  );
}
