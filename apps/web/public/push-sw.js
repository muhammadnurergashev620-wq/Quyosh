/* Quyosh: brauzer push (Web Push) xizmat skripti. Firebase Cloud Messaging yuborgan xabarni ko‘rsatadi va bosilganda sahifani ochadi. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || 'Quyosh';
  const isCall = data.kind === 'call';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Sayt ochiq va ko‘rinib turgan bo‘lsa, ilovaning o‘zi ko‘rsatadi — takror bildirishnoma chiqarilmaydi.
      if (windows.some((client) => client.visibilityState === 'visible' && client.focused)) return undefined;
      return self.registration.showNotification(title, {
        body: notification.body || '',
        icon: '/brand/mark.png',
        badge: '/brand/mark.png',
        tag: data.callId || data.conversationId || data.orderId || undefined,
        renotify: Boolean(data.callId || data.conversationId || data.orderId),
        requireInteraction: isCall,
        data,
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      if (open) {
        open.postMessage({ source: 'gm-push', data });
        return open.focus();
      }
      // Sayt yopiq edi: ochilgach, ilova `push` parametridan sahifaga o‘tadi.
      return self.clients.openWindow('/?push=' + encodeURIComponent(JSON.stringify(data)));
    }),
  );
});
