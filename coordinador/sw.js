/**
 * Service Worker para Módulo Coordinador
 * FASE 6 - TURNO-PVU
 */

const CACHE_NAME = 'turno-pvu-coordinador-v4-crossbrowser';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    '../shared/config.js',
    '../shared/api.js',
    '../shared/auth.js',
    '../shared/db.js',
    '../shared/sync.js',
    '../shared/utils.js',
    '../shared/monitoring.js',
    '../shared/styles-base.css'
];

// Instalación
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker - Módulo Coordinador v4 (Cross-browser)');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activación
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker v4 (Cross-browser)');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Eliminando caché antiguo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorar requests no-http (ej: chrome-extension://, moz-extension://)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // API requests: Network First (siempre)
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .catch((error) => {
                    console.error('[SW] API request failed:', error);
                    return new Response(
                        JSON.stringify({ error: 'Sin conexión', offline: true }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }

    // Helper: detectar si es un asset crítico (HTML, JS, CSS)
    // Compatible con Chrome, Firefox, Safari
    const isCriticalAsset = () => {
        // Navegación (HTML)
        if (request.mode === 'navigate') return true;

        // Detección por destination (Chrome, Firefox moderno)
        if (request.destination === 'script' ||
            request.destination === 'style' ||
            request.destination === 'document') return true;

        // Detección por extensión (fallback para navegadores sin destination)
        const urlPath = url.pathname.toLowerCase();
        if (urlPath.endsWith('.js') ||
            urlPath.endsWith('.css') ||
            urlPath.endsWith('.html')) return true;

        // Detección por tipo de solicitud
        if (request.url.includes('.js') || request.url.includes('.css')) return true;

        return false;
    };

    // Assets criticos (HTML, JS, CSS): Network First -> Falling back to Cache
    // Esto asegura que siempre busquemos la version mas nueva
    if (isCriticalAsset()) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Si la red responde bien, actualizamos cache
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Si falla la red, usamos cache
                    console.log('[SW] Network failed, serving from cache:', request.url);
                    return caches.match(request);
                })
        );
        return;
    }

    // Imagenes/Fuentes/Otros: Cache First
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return networkResponse;
                    });
            })
    );
});

// Background Sync
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);

    if (event.tag === 'sync-cortes') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SYNC_READY',
                        message: 'Conexión recuperada, sincronizando cortes'
                    });
                });
            })
        );
    }
});

// Mensajes del cliente
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
