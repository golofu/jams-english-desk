// Offline shell. Hashed /assets/* never change → cache-first; pages → network-first.
const CACHE = 'jed-v4';
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

// The page sends the asset list of the build it is running: cache those, drop older builds' files.
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-assets' || !Array.isArray(e.data.assets)) return;
  const keep = new Set(e.data.assets.filter((p) => typeof p === 'string' && p.startsWith('/assets/')));
  if (!keep.size) return;
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await Promise.all([...keep].map((p) => c.match(p).then((hit) => hit || c.add(p)).catch(() => undefined)));
      for (const req of await c.keys()) {
        const p = new URL(req.url).pathname;
        // Lazy chunks never loaded on this page are kept; only files no longer on the server go.
        if (p.startsWith('/assets/') && !keep.has(p)) {
          fetch(req, { method: 'HEAD' }).then((r) => r.status === 404 && c.delete(req)).catch(() => undefined);
        }
      }
    }),
  );
});

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
  // Weak 05:00 connection: don't stare at a blank screen — after 4 s show the cached app instead.
  const net = fetch(e.request);
  const slow = isPage
    ? new Promise((_, reject) => setTimeout(() => caches.match('/').then((hit) => (hit ? reject(new Error('slow')) : undefined)), 4000))
    : new Promise(() => undefined);
  e.respondWith(
    Promise.race([net, slow])
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
