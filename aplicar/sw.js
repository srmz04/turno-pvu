/**
 * Service Worker para Módulo Aplicar
 * FASE 5 - TURNO-PVU
 */

const CACHE_NAME = 'turno-pvu-aplicar-v3-crossbrowser';
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

// Instalación - cachear assets
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker - Módulo Aplicar v3 (Cross-browser)');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // Activar inmediatamente
    );
});

// Activación - limpiar cachés antiguos
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker v3 (Cross-browser)');

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
            .then(() => self.clients.claim()) // Tomar control inmediato
    );
});

// Fetch - estrategia: Network First para API, Cache First para assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorar requests no-http (chrome-extension://, moz-extension://, etc)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // API requests: Network First (con fallback a error, NO cache)
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

    // Assets: Cache First (con fallback a network)
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then((networkResponse) => {
                        // Cachear respuesta si es exitosa
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

// Background Sync - para sincronizar datos cuando se recupera conexión
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);

    if (event.tag === 'sync-aplicaciones') {
        event.waitUntil(
            // La lógica de sincronización está en SyncManager (shared/sync.js)
            // Este evento solo notifica que hay conectividad
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SYNC_READY',
                        message: 'Conexión recuperada, iniciando sincronización'
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
