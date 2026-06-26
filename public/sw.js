const CACHE_NAME = 'alphatron-geosnap-mobile-shell-v8';
const TILE_CACHE_NAME = 'alphatron-geosnap-mobile-tiles-v1';
const APP_SHELL = [
  '/',
  '/style.css',
  '/app.js',
  '/js/app-core.js',
  '/js/app-storage.js',
  '/js/app-image.js',
  '/js/app-camera.js',
  '/js/app-sessions.js',
  '/js/app-capture.js',
  '/js/app-gps.js',
  '/js/app-gallery.js',
  '/js/app-export.js',
  '/js/app-map.js',
  '/js/app-bootstrap.js',
  '/vendor/jszip.min.js',
  '/vendor/leaflet/leaflet.css',
  '/vendor/leaflet/leaflet.js',
  '/vendor/leaflet/images/layers.png',
  '/vendor/leaflet/images/layers-2x.png',
  '/vendor/leaflet/images/marker-icon.png',
  '/vendor/leaflet/images/marker-icon-2x.png',
  '/vendor/leaflet/images/marker-shadow.png',
  '/manifest.webmanifest',
  '/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname === 'server.arcgisonline.com' && url.pathname.includes('/World_Imagery/MapServer/tile/')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
