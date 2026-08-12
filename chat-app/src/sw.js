import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache all assets built by Vite
precacheAndRoute(self.__WB_MANIFEST);

// Cache static assets (JS, CSS, images) with CacheFirst
registerRoute(
  ({request}) => request.destination === 'style' || request.destination === 'script' || request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Cache Google Fonts
registerRoute(
  ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// Offline fallback for navigation requests
const OFFLINE_URL = '/offline.html';

// Cache the offline page on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('offline-fallback').then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Navigation fallback to offline page
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// ── Push Notification Handler ──
self.addEventListener('push', (event) => {
  let data = { title: 'Samlap', body: 'New message received' };
  try {
    data = event.data?.json() || data;
  } catch {
    data.body = event.data?.text() || data.body;
  }

  const isCall = data.isCall;

  const options = {
    body: data.body,
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag: isCall ? 'samlap-call' : (data.chatId || 'samlap-message'),
    vibrate: isCall ? [500, 1000, 500, 1000, 500] : [200, 100, 200],
    requireInteraction: isCall ? true : false,
    data: { 
      chatId: data.chatId, 
      url: isCall ? `/call/${data.chatId}?type=${data.callType}&role=callee` : '/chat' 
    },
  };

  if (isCall) {
    options.actions = [
      { action: 'answer', title: 'Answer Call' },
      { action: 'decline', title: 'Decline' }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click Handler ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'decline') {
    return; // Just close the notification
  }

  const urlToOpen = new URL(event.notification.data?.url || '/chat', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate to the target URL
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // If it's a call, force navigation to the call screen
          if (event.notification.data?.url?.includes('/call/')) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});
