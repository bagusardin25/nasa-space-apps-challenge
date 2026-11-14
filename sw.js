// Service worker: keeps a copy of everything the game has loaded, so it still runs when the
// network drops (for example a judge on hotel Wi-Fi). Network-first: while online every file
// comes fresh from the server, so edits and new releases show up on a normal reload; the cached
// copy is only used when the network fails or takes too long.
// Bump VERSION on each release so old copies are dropped.
const VERSION = 'gonogo-v1';
const SLOW_MS = 5000;
// NASA imagery that is requested with CORS (the Blue Marble texture). Opaque responses are never stored.
const REMOTE_HOSTS = ['gibs.earthdata.nasa.gov'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    } catch {
      // Storage unavailable: nothing to clean up.
    }
    await self.clients.claim();
  })());
});

const cacheable = (url) => url.origin === self.location.origin || REMOTE_HOSTS.includes(url.hostname);
const storable = (res) => res.status === 200 && (res.type === 'basic' || res.type === 'cors');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !cacheable(new URL(req.url))) return;
  event.respondWith(networkFirst(req));
});

// Cache Storage can fail (corrupted profile, storage disabled); then the game simply uses the network.
const openCache = () => caches.open(VERSION).catch(() => null);

async function networkFirst(req) {
  const cache = await openCache();
  if (!cache) return fetch(req);
  const cached = async () => {
    try {
      return (await cache.match(req, { ignoreSearch: req.mode === 'navigate' }))
        ?? (req.mode === 'navigate' ? await cache.match('./') : undefined);
    } catch {
      return undefined;
    }
  };
  const network = fetch(req).then((res) => {
    if (storable(res)) cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  // On a slow connection, answer from the cache after SLOW_MS; with nothing cached, keep waiting.
  const slow = new Promise((resolve) => { setTimeout(resolve, SLOW_MS); }).then(async () => (await cached()) ?? network);
  try {
    return await Promise.race([network, slow]);
  } catch {
    return (await cached()) ?? Response.error();
  }
}

// The page sends the files it loaded before this worker took control (first visit), plus assets
// it may need later offline. Store any that are not cached yet.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'warm' || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await openCache();
    if (!cache) return;
    for (const href of new Set(event.data.urls)) {
      try {
        const url = new URL(href, self.location.href);
        if (!cacheable(url) || await cache.match(url.href)) continue;
        const res = await fetch(url.href, { mode: url.origin === self.location.origin ? 'same-origin' : 'cors' });
        if (storable(res)) await cache.put(url.href, res);
      } catch {
        // Offline or blocked: skip this one.
      }
    }
  })());
});
