const CACHE_NAME = 'pvu-registro-v3-crossbrowser';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
    './app.js',
    '../shared/styles-base.css',
    '../shared/config.js',
    '../shared/utils.js',
    '../shared/api.js',
    '../shared/auth.js',
    '../shared/db.js',
    '../shared/sync.js',
    '../shared/monitoring.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker - Módulo Registro v3 (Cross-browser)');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Cacheando assets');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker v3 (Cross-browser)');
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Eliminando caché antiguo:', key);
                    return caches.delete(key);
                }
            })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ignorar requests no-http (chrome-extension://, moz-extension://, etc)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Strategy: Network First for API, Cache First for Assets
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // API offline handling usually done in app via db.js, 
                // but explicit 503 or failure here can be useful.
                // For now, let it fail so app catches it.
                return new Response(JSON.stringify({ error: 'Offline' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 503
                });
            })
        );
    } else {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});
