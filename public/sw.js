// Offline shell. Hashed /assets/* never change → cache-first; pages → network-first.
const CACHE = 'jed-v3';
self.addEventListener('install', (e) => {
  // Pre-cache the app shell so the very first visit already works offline later.
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => undefined).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

const goodAsset = (res) => res.ok && res.status === 200 && !(res.headers.get('content-type') || '').includes('text/html');

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (goodAsset(res)) {
              const copy = res.clone();
              e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined));
            }
            return res;
          }),
      ),
    );
    return;
  }

  const isPage = e.request.mode === 'navigate';
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Never cache errors, partial responses, or index.html served in place of a missing file.
        if (isPage ? res.ok && res.status === 200 : goodAsset(res)) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(isPage ? '/' : e.request, copy)).catch(() => undefined));
        }
        return res;
      })
      .catch(() => caches.match(isPage ? '/' : e.request).then((r) => r || caches.match('/'))),
  );
});
