// Agrilux Service Worker v1.0
const CACHE_NAME = 'agrilux-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
];

// Instalar y cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Limpiar cachés viejas al activar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: Network First, fallback a caché
self.addEventListener('fetch', (event) => {
  // Solo manejar GET requests
  if (event.request.method !== 'GET') return;

  // No cachear requests a APIs externas (OpenRouter, Firebase, etc.)
  const url = new URL(event.request.url);
  const externalHosts = [
    'openrouter.ai',
    'firebaseapp.com',
    'firebase.googleapis.com',
    'firebasestorage.googleapis.com',
    'identitytoolkit.googleapis.com',
  ];
  if (externalHosts.some((host) => url.hostname.includes(host))) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cachear respuestas válidas
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin red: servir desde caché
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback para navegación: servir index.html (SPA)
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
