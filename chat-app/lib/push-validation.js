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
