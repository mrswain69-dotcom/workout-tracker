/* Workout Tracker – Service Worker
   Goal: fast loads + reliable updates.
   Strategy:
   - Navigations (index.html): network-first (so new deployments show up)
   - Static assets: cache-first
*/
const CACHE_NAME = 'kwt-cache-v3';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([
      '/',
      '/index.html',
      '/manifest.webmanifest',
      // Icons (so home-screen install looks right even briefly offline)
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/icon-maskable.png',
      '/icons/apple-touch-icon.png',
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = req.mode === 'navigate';
  const isIndexLike = url.pathname === '/' || url.pathname.endsWith('.html');

  if (isNavigation || isIndexLike) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = (await cache.match(req)) || (await cache.match('/index.html')) || (await cache.match('/'));
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  })());
});
