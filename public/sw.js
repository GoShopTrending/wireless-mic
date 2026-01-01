/**
 * Service Worker para Wireless Microphone PWA
 */
const CACHE_NAME = 'wireless-mic-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/host.html',
  '/mic.html',
  '/css/styles.css',
  '/js/shared/socket-client.js',
  '/js/host/main.js',
  '/js/host/audio-mixer.js',
  '/js/host/room-manager.js',
  '/js/mic/main.js',
  '/js/mic/audio-capture.js',
  '/js/mic/webrtc-client.js',
  '/manifest.json',
  '/assets/icons/icon.svg'
];

// Instalar - cachear assets estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installed');
        return self.skipWaiting();
      })
  );
});

// Activar - limpiar caches viejas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activated');
        return self.clients.claim();
      })
  );
});

// Fetch - estrategia Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests de socket.io y API
  if (url.pathname.startsWith('/socket.io') ||
      url.pathname.startsWith('/api')) {
    return;
  }

  // Ignorar requests externos (CDN)
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clonar respuesta para guardar en cache
        const responseClone = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(request, responseClone);
          });

        return response;
      })
      .catch(() => {
        // Fallback a cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Si es navegación, devolver index
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }

            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
