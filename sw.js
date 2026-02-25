/**
 * ════════════════════════════════════════════
 * INFINIVERSAL · sw.js  (Service Worker)
 *
 * Estrategia Cache-First:
 * - En install: precachea todos los assets.
 * - En fetch:   sirve desde caché si existe,
 *               si no va a red y lo cachea.
 * - En activate: elimina cachés antiguas.
 *
 * IMPORTANTE: cambiar CACHE_NAME al hacer
 * actualizaciones para forzar refresco.
 * ════════════════════════════════════════════
 */

const CACHE_NAME = 'infiniversal-v1';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ── INSTALL: precaché ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés antiguas ─────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first ────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Sin red: devolver index.html para navegación
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
