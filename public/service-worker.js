const CACHE_NAME = 'stockcell-v50';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/variables.css',
    '/css/base.css',
    '/css/components.css',
    '/css/layout.css',
    '/css/login.css',
    '/css/dashboard.css',
    '/css/pdv.css',
    '/css/cashregister.css',
    '/css/animations.css',
    '/js/utils.js',
    '/js/api.js',
    '/js/auth.js',
    '/js/app.js',
    '/js/components/toast.js',
    '/js/components/modal.js',
    '/js/components/sidebar.js',
    '/js/components/header.js',
    '/js/offline/db.js',
    '/js/offline/api-offline.js',
    '/js/offline/sync.js',
    '/js/pages/login.js',
    '/js/pages/dashboard.js',
    '/js/pages/categories.js',
    '/js/pages/products.js',
    '/js/pages/customers.js',
    '/js/pages/suppliers.js',
    '/js/pages/pdv.js',
    '/js/pages/cashregister.js',
    '/js/pages/stock.js',
    '/js/pages/os.js',
    '/js/pages/finance.js',
    '/js/pages/settings.js',
    '/js/pages/reports.js',
    '/js/pages/logs.js',
    '/assets/logo.svg',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network first for JS/CSS/API, cache for offline fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API calls - Bypass Service Worker Completely
    if (url.pathname.startsWith('/api/')) {
        return; // Retorna sem chamar respondWith, o navegador faz a requisição nativamente
    }

    // All assets - Stale-While-Revalidate com Timeout forçado (Evita travamentos de rede no 4G)
    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
            
            // Promise customizada com timeout de 3s
            const fetchPromise = new Promise((resolve) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    resolve(null);
                }, 3000);

                fetch(request, { signal: controller.signal }).then((networkResponse) => {
                    clearTimeout(timeoutId);
                    if (networkResponse && networkResponse.ok && !request.url.startsWith('chrome-extension')) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    resolve(networkResponse);
                }).catch(() => {
                    clearTimeout(timeoutId);
                    resolve(null);
                });
            });

            // Retorna o cache IMEDIATAMENTE (0ms) se existir. Senão, aguarda a rede (máximo 3s).
            return cachedResponse || fetchPromise.then(res => {
                if (res) return res;
                if (request.mode === 'navigate') {
                    return caches.match('/index.html', { ignoreSearch: true });
                }
                return new Response('Offline', { status: 408, headers: { 'Content-Type': 'text/plain' } });
            });
        })
    );
});
