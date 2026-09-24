import webpush from 'web-push';

export function pushConfigured() {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_SUBJECT);
}

export async function sendGenericPush(subscription, { url = '/', tag }) {
  await webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
  }, JSON.stringify({ url, tag }), {
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT,
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    },
    TTL: 3600,
    urgency: 'high',
    timeout: 10000,
  });
}
