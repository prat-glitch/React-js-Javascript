self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const visible = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .some((client) => client.visibilityState === 'visible');
    if (visible) return;
    let data = {};
    try { data = event.data?.json() || {}; } catch { /* Show a generic notification. */ }
    await self.registration.showNotification('Samlap', {
      body: 'You have a new message.',
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      tag: typeof data.tag === 'string' ? data.tag : 'new-message',
      data: { url: typeof data.url === 'string' ? data.url : '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const requested = new URL(event.notification.data?.url || '/', self.location.origin);
    const destination = requested.origin === self.location.origin ? requested.href : self.location.origin;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(destination);
      await existing.focus();
    } else {
      await self.clients.openWindow(destination);
    }
  })());
});
