import { getSupabase } from '../config/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convert a base64 string to Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

/**
 * Request notification permission and subscribe to push
 * @param {string} userId - The user's Firebase UID
 * @returns {PushSubscription|null}
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission denied');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Store subscription in Supabase
    const subscriptionJSON = subscription.toJSON();
    await getSupabase()
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscriptionJSON.endpoint,
        keys: subscriptionJSON.keys,
      }, {
        onConflict: 'user_id,endpoint',
      });

    console.log('Push subscription stored successfully');
    return subscription;
  } catch (err) {
    console.error('Failed to subscribe to push:', err);
    return null;
  }
}

/**
 * Unsubscribe from push notifications and remove from Supabase
 * @param {string} userId - The user's Firebase UID
 */
export async function unsubscribeFromPush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // Remove from Supabase
      await getSupabase()
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);
    }
  } catch (err) {
    console.error('Failed to unsubscribe from push:', err);
  }
}

/**
 * Get current notification permission status
 * @returns {'default'|'granted'|'denied'}
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}
