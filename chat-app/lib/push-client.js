import { getSupabase } from './supabase';

export function pushSupported() {
  return typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

function publicKeyBytes() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('Push notifications are not configured yet.');
  const padded = key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function subscriptionRequest(method, subscription) {
  const { data: { session } } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Sign in to manage notifications.');
  const response = await fetch('/api/push/subscription', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token,
    },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Could not save notification settings.');
  }
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() || null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser needs HTTPS and Web Push support.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Allow notifications in your browser settings first.');
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  // A newly installed worker cannot subscribe until it controls this origin.
  const registration = await navigator.serviceWorker.ready;
  const desiredKey = publicKeyBytes();
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const oldKey = new Uint8Array(subscription.options.applicationServerKey || []);
    if (oldKey.length !== desiredKey.length || oldKey.some((byte, index) => byte !== desiredKey[index])) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  let created = false;
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: desiredKey,
      });
    } catch (error) {
      if (error?.name === 'AbortError' || /push service/i.test(error?.message || '')) {
        throw new Error('Your browser could not connect to its push service. Check the browser push setting and internet connection, then try again. (' + (error.message || error.name) + ')');
      }
      throw error;
    }
    created = true;
  }
  try {
    await subscriptionRequest('POST', subscription.toJSON());
  } catch (error) {
    if (created) await subscription.unsubscribe();
    throw error;
  }
}

export async function disablePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const removed = await subscription.unsubscribe();
  if (!removed) throw new Error('Could not turn off this browser subscription.');
  // An unreachable server may leave a stale DB row; the push sender prunes it on 404/410.
  try {
    await subscriptionRequest('DELETE', { endpoint: subscription.endpoint });
  } catch {
    // The browser no longer has a valid endpoint, so signing out remains safe.
  }
}
