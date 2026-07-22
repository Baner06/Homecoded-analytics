const CACHE = 'coded-sports-v45';
const SHELL = [
  '/',
  '/index.html',
  '/CodedSportsLogo.png',
  '/CodedSportsLogo-icon.png',
  '/manifest.webmanifest',
  '/assets/styles/tokens.css?v=15',
  '/assets/styles/base.css?v=15',
  '/assets/styles/layout.css?v=15',
  '/assets/styles/components.css?v=17',
  '/assets/styles/tools.css?v=15',
  '/assets/styles/live-tracker.css?v=2',
  '/assets/styles/match-stats.css?v=5',
  '/assets/styles/visual-fx.css?v=1',
  '/assets/styles/gesture.css?v=1',
  '/assets/styles/leagues.css?v=1',
  '/assets/js/user-tools.js?v=14',
  '/assets/js/gesture-utils.js?v=1',
  '/assets/js/visual-fx.js?v=1',
  '/assets/js/leagues.js?v=1',
  '/assets/js/standings.js?v=1',
  '/assets/js/live-tracker.js?v=5',
  '/assets/js/match-stats.js?v=10',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
