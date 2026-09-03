const CACHE_NAME = 'agrogis-v185';

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
                    './linhas_colheita.fgb',
                    'https://unpkg.com/flatgeobuf/dist/flatgeobuf-geojson.min.js',
                    './fazendas_data.js',
                    './maturador.html',
                    './maturador.css',
                    './maturador.js',
                    './incra/incra.html',
                    './incra/incra.css',
                    './incra/incra.js',
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
                        if(r.ok || r.type === 'opaque') {
                            return cache.put(url, r); 
                        } else {
                            console.warn('[ServiceWorker] Failed to fetch ' + url + ' status: ' + r.status);
                        }
                    }).catch(e => console.warn('[ServiceWorker] Network error for ' + url, e)))
                );
                console.log('[ServiceWorker] Install complete');
            })
    );
});

self.addEventListener('activate', event => {
    // IMPORTANTE: Manter o cache antigo disponível enquanto o novo carrega.
    // Isso evita a tela preta quando o SW atualiza e os tiles do mapa ficam sem cache.
    // Só deleta caches MUITO antigos (> 2 versões atrás) para liberar espaço.
    event.waitUntil(
        caches.keys().then(cacheNames => {
            const currentVersion = parseInt((CACHE_NAME.match(/v(\d+)/) || [0, 0])[1]);
            return Promise.all(
                cacheNames
                    .filter(name => {
                        const match = name.match(/agrogis-v(\d+)/);
                        if (!match) return false;
                        const version = parseInt(match[1]);
                        // Deleta apenas caches com mais de 3 versões atrás
                        return version < currentVersion - 3;
                    })
                    .map(oldCache => {
                        console.log('[ServiceWorker] Removendo cache muito antigo:', oldCache);
                        return caches.delete(oldCache);
                    })
            );
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
    const alwaysFreshFiles = ['/', '/index.html', '/auth.js', '/app.js', '/style.css', '/sw.js'];
    if (alwaysFreshFiles.some(f => url.pathname === f || url.pathname.endsWith(f))) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5 seconds timeout

        event.respondWith(
            fetch(event.request, { signal: controller.signal }).then(async response => {
                clearTimeout(timeoutId);
                // Se a resposta for ruim (ex: portal cativo, 404, 500), tenta usar o cache
                if (!response || !response.ok) {
                    let cached = await caches.match(event.request, { ignoreSearch: true });
                    if (!cached && event.request.mode === 'navigate') {
                        cached = await caches.match('./index.html') || await caches.match('./');
                    }
                    if (cached) return cached;
                }
                
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return response;
            }).catch(async () => {
                clearTimeout(timeoutId);
                // Se offline ou Timeout (AbortError), serve do cache ignorando parametros
                let cached = await caches.match(event.request, { ignoreSearch: true });
                if (!cached && event.request.mode === 'navigate') {
                    cached = await caches.match('./index.html', { ignoreSearch: true }) || await caches.match('./', { ignoreSearch: true });
                }
                
                if (cached) return cached;
                
                if (event.request.mode === 'navigate') {
                    return new Response('<html><head><meta charset="utf-8"><title>Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#1e1e1e;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;flex-direction:column;"><h2>Modo Offline</h2><p>O aplicativo est&aacute; sem conex&atilde;o e a p&aacute;gina inicial ainda n&atilde;o foi cacheada com sucesso.</p><p style="font-size: 12px; color: #888;">Por favor, conecte-se &agrave; internet e tente novamente.</p><button onclick="window.location.reload()" style="padding:10px 20px;border-radius:20px;border:none;background:#2ec4b6;color:white;font-weight:bold;margin-top:20px;">Tentar Novamente</button></body></html>', { status: 200, headers: {'Content-Type': 'text/html'} });
                }
                
                return new Response('', { status: 503, statusText: 'Offline' });
            })
        );
        return;
    }

    // ─── Cache de Tiles de Mapa (Fase 2 — Offline Avançado) ───────────────
    // Tiles ArcGIS, OSM e CartoDB são salvos conforme o usuário navega.
    // Da próxima vez offline, os tiles visitados carregam do cache.
    const TILE_CACHE = 'agrogis-tiles-v1';
    const isTileRequest = (
        url.hostname.includes('arcgisonline.com') ||
        url.hostname.includes('tile.openstreetmap.org') ||
        url.hostname.includes('basemaps.cartocdn.com')
    );

    if (isTileRequest) {
        event.respondWith(
            caches.open(TILE_CACHE).then(async tileCache => {
                const cached = await tileCache.match(event.request);
                if (cached) return cached;
                try {
                    const response = await fetch(event.request);
                    if (response && (response.status === 200 || response.type === 'opaque')) {
                        tileCache.put(event.request, response.clone());
                    }
                    return response;
                } catch {
                    // Offline e tile não cacheado — retorna pixel transparente 1×1
                    return new Response(
                        new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,1,0,0,0,1,0,8,6,0,0,0,92,114,168,110,0,0,0,11,73,68,65,84,120,156,98,0,0,0,0,2,0,0,0,5,0,1,13,10,45,180,0,0,0,0,73,69,78,68,174,66,96,130]).buffer,
                        { status: 200, headers: { 'Content-Type': 'image/png' } }
                    );
                }
            })
        );
        return;
    }
    // ──────────────────────────────────────────────────────────────────────

    // Cache-First Strategy para todo o resto - Extrema velocidade na inicialização
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
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
