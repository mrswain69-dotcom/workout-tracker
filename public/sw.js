/* public/sw.js - Workout Tracker */
const CACHE_VERSION = "wt-v7";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        "/",
        "/index.html",
        "/manifest.webmanifest",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/icon-maskable.png",
        "/icons/apple-touch-icon.png",
      ])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) =>
          (k.startsWith("static-") || k.startsWith("runtime-")) &&
          k !== STATIC_CACHE &&
          k !== RUNTIME_CACHE
            ? caches.delete(k)
            : null
        )
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Network-first for navigations so new deploys are discovered quickly.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Account APIs must always reach the network. Never persist authenticated
  // responses or cross-origin Supabase reads in the offline app-shell cache.
  if (req.method !== "GET" || url.origin !== self.location.origin ||
      req.headers.has("authorization")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          if (fresh.ok) await cache.put("/", fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(RUNTIME_CACHE);
          return (await cache.match("/")) || (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  const staticAsset = url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest";
  if (staticAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((fresh) => {
            if (fresh.ok) return cache.put(req, fresh.clone()).then(() => fresh);
            return fresh;
          })
          .catch(() => cached || Response.error());
        event.waitUntil(fetchPromise.then(() => {}));
        return cached || fetchPromise;
      })()
    );
  }
});
