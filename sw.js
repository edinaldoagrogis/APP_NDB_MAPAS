const CACHE_NAME = 'agrogis-v169';

// Core assets to pre-cache when the Service Worker installs
try {
    importScripts('./offline_images_config.js');
} catch (e) {
    console.warn('[ServiceWorker] offline_images_config.js not found, skipping pre-cache list.');
}

self.addEventListener('install', event => {
    // Skip waiting ensures the new service worker takes over immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('[ServiceWorker] Pre-caching core assets');
                
                // 1. Array de assets base
                let coreAssets = [
                    './',
                    './index.html',
                    './style.css',
                    './app.js',
                    './pathfinder.js',
                    './rotas_offline.geojson',
                    
                    './clima_farm.js',
                    './auth.js',
                    './layers_data.js',
                    './fazendas_data.js',
                    './maturador.html',
                    './maturador.css',
                    './maturador.js',
                    './manifest.json',
                    './app_icon_192.png',
                    './app_icon_512.png'
                ];
                
                if (typeof OFFLINE_IMAGES_CONFIG !== 'undefined') {
                    const imageAssets = OFFLINE_IMAGES_CONFIG.map(item => item.url);
                    coreAssets = coreAssets.concat(imageAssets);
                }

                await Promise.all(
                    coreAssets.map(url => fetch(url).then(r => { 
                        if(r.ok) {
                            return cache.put(url, r); 
                        } else {
                            throw new Error('Failed to fetch ' + url);
                        }
                    }))
                );
                console.log('[ServiceWorker] Install complete');
            })
    );
});

self.addEventListener('activate', event => {
    // Delete old caches when a new version activates
    const currentCaches = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
        }).then(cachesToDelete => {
            return Promise.all(cachesToDelete.map(cacheToDelete => {
                console.log('[ServiceWorker] Deleting old cache', cacheToDelete);
                return caches.delete(cacheToDelete);
            }));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Cache-First Strategy para as fatias do mapa offline (extrema fluidez)
    if (url.pathname.includes('/offline_images/')) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse; // Retorna imediatamente do celular, zero delay
                }
                // Se não estiver no cache (ainda baixando), tenta a rede
                return fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                }).catch(() => {
                    return new Response('', { status: 404, statusText: 'Offline' });
                });
            })
        );
        return;
    }
    
    // Bypass cache for API calls, admin page, and SICAR GeoServer
    if (url.pathname.startsWith('/api/') || url.pathname.includes('admin.html') || url.hostname === 'geoserver.car.gov.br') {
        event.respondWith(fetch(event.request));
        return;
    }

    // Network-First para arquivos principais do app (index.html, auth.js, app.js)
    // Garante que atualizações apareçam imediatamente, sem depender de cache antigo
    const alwaysFreshFiles = ['/', '/index.html', '/auth.js', '/app.js', '/pathfinder.js', '/style.css', '/sw.js'];
    if (alwaysFreshFiles.some(f => url.pathname === f || url.pathname.endsWith(f))) {
        event.respondWith(
            fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return response;
            }).catch(() => {
                // Se offline, serve do cache
                return caches.match(event.request);
            })
        );
        return;
    }

    // Cache-First Strategy para todo o resto (app.js, index.html, etc) - Extrema velocidade na inicialização
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse; // Retorna imediatamente do celular, zero tela de splash demorada
            }
            // Se não estiver no cache, tenta a rede
            return fetch(event.request).then(response => {
                if (response && (response.status === 200 || response.type === 'opaque')) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            }).catch(() => {
                return new Response('', { status: 404, statusText: 'Offline' });
            });
        })
    );
});

// Sincronização em background removida, pois as 25 imagens estáticas são baixadas no install event
