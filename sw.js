// HaqSetu AI service worker (classic script).
const CACHE_NAME = 'haqsetu-multilingual-v4';

const PRECACHE_PATHS = [
  './',
  './index.html',
  './app.js',
  './persistence.js',
  './engine.js',
  './style.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
  './data/schemes.json',
  './data/personas.json',
  './data/ui-languages.json',
];

// Absolute URLs (strings) of precached static assets, resolved against the worker location.
const PRECACHE_URLS = new Set(
  PRECACHE_PATHS.map((p) => new URL(p, self.location.href).href)
);

const INDEX_URL = new URL('./index.html', self.location.href).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Add each asset individually so one missing optional file does not fail install.
      for (const p of PRECACHE_PATHS) {
        try {
          await cache.add(p);
        } catch (err) {
          console.warn('[sw] precache skipped:', p, err);
        }
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-http(s) schemes such as chrome-extension:.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // Never touch non-GET or cross-origin requests.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (PRECACHE_URLS.has(url.href)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return offlineFallback(request, err);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback(request, err);
  }
}

async function offlineFallback(request, err) {
  if (request.mode === 'navigate') {
    const index = await caches.match(INDEX_URL);
    if (index) return index;
  }
  throw err;
}
