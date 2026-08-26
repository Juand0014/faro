const CACHE = 'faro-v4';
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
        if (r.ok && new URL(req.url).origin === location.origin) c.put(req, r.clone());
        return r;
      } catch {
        return (await c.match(req)) || Response.error();
      }
    })
  );
});
