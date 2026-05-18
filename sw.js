// ===================================================
// sw.js — Service Worker SinCola
// Cache offline, actualización en background
// SinCola · Producción v2.0
// ===================================================

const CACHE_NAME    = 'sincola-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/js/firebase.js',
  '/js/modules/statusEngine.js',
  '/js/modules/antiSpam.js',
  '/js/modules/cookies.js',
  '/js/modules/reputation.js',
  '/js/modules/geolocation.js',
  '/js/app.js',
  '/pwa/manifest.json',
  '/pwa/offline.html',
];

// ── Instalación ─────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activación (limpiar caches viejos) ───────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Network First para API, Cache First para assets ─

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones no GET y extensiones Chrome
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Firebase Firestore: siempre network, sin caché SW
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('gstatic')) {
    return; // Dejar pasar al navegador
  }

  // Google Fonts: Cache First
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached ?? fetch(request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Assets propios: Network First con fallback a cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached ?? caches.match('/pwa/offline.html')
        )
      )
  );
});
