/**
 * Lifinance service worker.
 *
 * Deliberately small and conservative — a service worker is the one file that
 * can brick a site for returning visitors, so every rule here fails open:
 * anything unexpected falls through to the network untouched.
 *
 * Strategy per request type:
 *   navigations      → network-first, cache fallback, then the offline page.
 *                      Network-first matters: cache-first would pin users to a
 *                      stale build until they cleared storage.
 *   /_next/static/*  → cache-first. Next fingerprints these filenames, so a
 *                      given URL's contents never change.
 *   other same-origin GET → stale-while-revalidate.
 *   everything else  → straight to the network.
 */

// Bump on any change to the caching rules — `activate` drops every cache whose
// name doesn't match, so a version bump is also the cache-invalidation switch.
const VERSION = "v3";
const RUNTIME = `lifinance-runtime-${VERSION}`;
const PRECACHE = `lifinance-precache-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  // The app shell. start_url is "/", so precaching it means an installed app
  // opens fully offline on the very first launch after install — before the
  // runtime cache has seen anything.
  "/",
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      // Individual failures must not abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
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
            .filter((key) => key !== RUNTIME && key !== PRECACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the manifest route or anything explicitly no-store.
  if (request.cache === "no-store") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

/**
 * `ignoreVary` is not optional here.
 *
 * Next's App Router responds with `Vary: RSC, Next-Router-State-Tree,
 * Next-Router-Prefetch, Next-Url`. The Cache API honours Vary, so a page
 * cached during a normal navigation will NOT match a later request whose RSC
 * headers differ — every offline lookup silently misses and the user gets the
 * offline page instead of the app they already have cached.
 */
function matchCache(request) {
  return caches.match(request, { ignoreVary: true });
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await matchCache(request);
    if (cached) return cached;
    // Deliberately NOT falling back to "/" here: serving the dashboard's HTML
    // under /debts would hydrate the wrong page against the wrong URL. An
    // installed app always launches at start_url ("/"), which is precached, so
    // this path only happens on a hard reload of a deep link while offline.
    const offline = await matchCache(new Request(OFFLINE_URL));
    if (offline) return offline;
    return offlineResponse();
  }
}

async function cacheFirst(request) {
  const cached = await matchCache(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await matchCache(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        // Clone SYNCHRONOUSLY. Doing it inside `caches.open().then()` would
        // run after the response has already been handed to respondWith and
        // its body started streaming — clone() then throws "body is already
        // used" and the write is silently lost.
        const copy = response.clone();
        caches.open(RUNTIME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    // Swallow here so the floating promise below can't become an unhandled
    // rejection when the user is offline.
    .catch(() => null);

  // Serve the cached copy instantly and let the refresh land in the background.
  if (cached) {
    void network;
    return cached;
  }

  // Never resolve to undefined: respondWith(undefined) surfaces to the page as
  // a thrown TypeError, which is far harder to debug than a 503.
  return (await network) || offlineResponse();
}

function offlineResponse() {
  return new Response("", {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Lets the page trigger an immediate update instead of waiting for a reload. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
