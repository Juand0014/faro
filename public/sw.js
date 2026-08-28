const CACHE = 'faro-v16';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      try {
        const r = await fetch(req);
        if (r.ok && new URL(req.url).origin === location.origin) await c.put(req, r.clone());
        return r;
      } catch {
        return (await c.match(req)) || Response.error();
      }
    })
  );
});

self.addEventListener('push', (e) => {
  let data = { title: 'Desde faro', body: 'Tu pareja piensa en ti', tag: 'faro-ping', url: './#/home' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch { /* keep default */ }
  e.waitUntil(self.registration.showNotification(data.title || 'Desde faro', {
    body: data.body || 'Tu pareja piensa en ti',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'faro-ping',
    renotify: true,
    data: { url: data.url || './#/home' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let dest = new URL('./#/home', self.location.origin).href;
  try {
    const requested = new URL(e.notification.data?.url || './#/home', self.location.origin);
    if (requested.origin === self.location.origin) dest = requested.href;
  } catch { /* keep safe home destination */ }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { w.postMessage({ type: 'faro-open', url: dest }); return w.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(dest);
  })());
});
