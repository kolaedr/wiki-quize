/* Wiqus service worker — PWA basics:
 * - static assets (Next chunks, fonts, icons): cache-first
 * - pages/API: network-first with cache fallback, so an active game
 *   survives a network hiccup after first load
 */
const CACHE = "wq-v2";
const STATIC_RE =
  /\/(_next\/static|icon\.svg|icon-\d+\.png|favicon-32\.png|apple-touch-icon\.png|manifest\.webmanifest)/;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // Commons images: let the browser handle

  if (STATIC_RE.test(url.pathname)) {
    // cache-first for immutable static assets
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // network-first for pages
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(request);
        if (res.ok && request.mode === "navigate") cache.put(request, res.clone());
        return res;
      } catch {
        const hit = await cache.match(request);
        return hit ?? Response.error();
      }
    }),
  );
});
