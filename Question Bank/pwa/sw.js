/* Mockaroo service worker â€” local-first, offline-capable. */
const VERSION = 'mockaroo-v5';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app/css/app.css',
  './app/js/app.js',
  './app/js/data.js',
  './app/js/storage.js',
  './app/js/scoring.js',
  './app/js/timer.js',
  './app/js/test.js',
  './app/js/stats.js',
  './app/js/ui.js',
  './app/vendor/chart.umd.min.js',
  './icons/icon.svg',
  './data/questions.json',
  './data/build.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Cache-first for same-origin GETs; network-first for JSON so updates land fast.
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  const isData = url.pathname.includes('/data/');

  e.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(e.request);
      if (cached && !isData) return cached;

      try {
        const fresh = await fetch(e.request);
        if (fresh && fresh.status === 200) {
          cache.put(e.request, fresh.clone()).catch(() => null);
        }
        return fresh;
      } catch (err) {
        if (cached) return cached;
        return new Response('Offline and no cache hit', { status: 503 });
      }
    })()
  );
});
