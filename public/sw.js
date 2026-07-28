/* Wiqus service worker.
 *
 * Two jobs:
 *
 * 1. INSTANT OPEN. Navigations are served stale-while-revalidate: the cached
 *    HTML paints immediately and a fresh copy is fetched in the background.
 *    The old network-first strategy meant every cold start blocked on the
 *    network, which is exactly the white screen an installed PWA shouldn't
 *    have. Static Next chunks stay cache-first (their URLs are hashed, so a
 *    cached one can never be stale).
 *
 * 2. CONTROLLED UPDATES. This worker no longer calls skipWaiting() on install.
 *    A new deploy therefore parks in "waiting" instead of swapping chunks under
 *    a running game, and the page can offer an explicit "update" prompt. The
 *    client asks for the swap by posting SKIP_WAITING.
 */
const VERSION = "wq-v4"; // v4: new app icon
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

/** Minimal shell precached on install, so the very first offline open works. */
const SHELL = ["/", "/icon.svg", "/icon-192.png", "/manifest.webmanifest"];

const STATIC_RE =
  /\/(_next\/static|icon\.svg|icon(-maskable)?-\d+\.png|og-\d+\.png|favicon-32\.png|apple-touch-icon\.png|manifest\.webmanifest)/;

/** Never cache: personal pages, admin, and anything under /api. */
const NO_CACHE_RE = /^\/(api|admin|me|auth)(\/|$)/;

self.addEventListener("install", (e) => {
  // NOTE: no skipWaiting() — see the header comment. The first ever install
  // still activates right away because there's no controller to wait for.
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // allSettled: one bad URL must not fail the whole install
      Promise.allSettled(SHELL.map((u) => cache.add(u))),
    ),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** The page asks us to take over now (user accepted the update prompt). */
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // Commons images: leave to the browser
  if (NO_CACHE_RE.test(url.pathname)) return; // auth/admin/API always go to the network

  // hashed build assets — safe to serve from cache forever
  if (STATIC_RE.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // pages — stale-while-revalidate
  if (request.mode === "navigate") {
    e.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fresh = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);

        // cached copy first (instant paint), network refreshes it for next time
        if (cached) return cached;
        const res = await fresh;
        // offline and never seen this URL — fall back to the cached shell
        return res ?? (await caches.match("/")) ?? Response.error();
      }),
    );
  }
});
