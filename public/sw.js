// SW mínimo: habilita "instalar app" y arranque offline del cascarón.
const CACHE = 'faro-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok && new URL(req.url).origin === location.origin) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })
  );
});
