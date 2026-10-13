// Offline shell: network-first, cache only good same-origin GETs, one versioned cache.
const CACHE = 'jed-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const isPage = e.request.mode === 'navigate';
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Never cache errors, partial responses, or index.html served in place of a missing asset.
        const html = (res.headers.get('content-type') || '').includes('text/html');
        if (res.ok && res.status === 200 && (isPage || !html)) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(isPage ? '/' : e.request, copy)).catch(() => undefined));
        }
        return res;
      })
      .catch(() => caches.match(isPage ? '/' : e.request).then((r) => r || caches.match('/'))),
  );
});
