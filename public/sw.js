// SabiBook service worker. Hand-written, no Workbox.
//
// Strategy:
// - Install: precache /offline.html and skip waiting.
// - Activate: delete every cache that is not the current version, then claim clients.
// - Fetch (GET, same origin only):
//   - Navigations: network first, fall back to /offline.html when offline.
//   - /_next/static/* and app icons: cache first, fill the cache on miss.
//   - Everything else (including the Convex backend on another origin): not handled.
// Bump CACHE_VERSION whenever this file's caching rules change.

const CACHE_VERSION = "v1";
const CACHE_PREFIX = "sabibook-";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL];

const ICON_PATHS = new Set([
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/icon.png",
  "/apple-icon.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheFirstRequest(url) {
  return url.pathname.startsWith("/_next/static/") || ICON_PATHS.has(url.pathname);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch writes, such as Convex mutations.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache or intercept other origins (the Convex backend lives elsewhere).
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheFirstRequest(url)) {
    event.respondWith(cacheFirst(request));
  }
});
