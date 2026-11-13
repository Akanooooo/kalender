// Hülle der App offline bereithalten und zuletzt geladene Dateien behalten.
// Termine selbst legt die App in localStorage ab, nicht hier.
const CACHE = 'kalender-shell-v1';

const PRECACHE = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) await cache.put(url, response);
          } catch {
            // Eine fehlende Datei soll die Installation nicht abbrechen.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

function isHashedAsset(url) {
  return url.pathname.includes('/assets/');
}

async function fromCache(cache, request) {
  return (
    (await cache.match(request)) ||
    (await cache.match(request, { ignoreSearch: true })) ||
    null
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isHashedAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await fromCache(cache, request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await fromCache(cache, request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return (
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }
        return new Response('', { status: 503 });
      }
    })(),
  );
});
