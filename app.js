// NDB Holding AgrÃ­cola Geoportal JavaScript Core (Dynamic)

document.addEventListener('DOMContentLoaded', () => {
    const isTouchDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 1. Initialize Leaflet Map
    const map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true, 
        zoomAnimation: true, // Habilitado para suavidade (canvas freezing evitado por interactive: false nos layers)
        fadeAnimation: true,
        markerZoomAnimation: true,
        wheelPxPerZoomLevel: 120, // Suaviza o zoom no desktop
        rotate: isTouchDevice,
        touchRotate: false // Disabled by default, toggled by compass
    }).setView([-17.8, -40.0], 7);
    window.map = map; // Expose globally for modules

    // Create a custom pane for harvest lines to always appear above other vector layers (zIndex > 400)
    map.createPane('harvestLinesPane');
    map.getPane('harvestLinesPane').style.zIndex = 450;

    // Ocultamento durante zoom removido conforme pedido pelo usuário. As camadas não vão mais piscar.
    
    // Fix map rendering issues when returning from other tools (bfcache)
    window.addEventListener('pageshow', (e) => {
        if (window.map) {
            setTimeout(() => {
                window.map.invalidateSize();
            }, 300);
        }
    });

    // Dispara evento para remover o splash screen quando o mapa estiver pronto
    map.whenReady(() => {
        window.dispatchEvent(new Event('agrogis:ready'));
    });

    // Prevent map interactions when scrolling or clicking the floating panels
    setTimeout(() => {
        ['floating-layers-panel', 'floating-tools-panel', 'measure-result', 'route-panel', 'custom-name-modal', 'clima-farm-panel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                L.DomEvent.disableClickPropagation(el);
                L.DomEvent.disableScrollPropagation(el);
            }
        });
    }, 500);

    
    // Custom Compass Control (Rotation Toggle)
    const CompassControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.style.backgroundColor = 'var(--bg-secondary)';
            container.style.border = '1px solid rgba(255,255,255,0.1)';
            container.style.width = '44px';
            container.style.height = '44px';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
            container.style.cursor = 'pointer';
            container.style.borderRadius = '12px';
            container.style.marginBottom = '10px';
            container.style.marginRight = '10px';
            container.style.backdropFilter = 'blur(12px)';
            container.id = 'btn-compass-control';
            container.title = 'Habilitar/Desabilitar RotaÃ§Ã£o Livre';

            const icon = L.DomUtil.create('div', '', container);
            icon.innerHTML = '<img src="icone_bussola.png" style="width: 28px; height: 28px; border-radius: 4px;">';
            icon.style.display = 'flex';
            icon.style.justifyContent = 'center';
            icon.style.alignItems = 'center';
            icon.style.transition = 'opacity 0.2s';
            icon.style.opacity = '0.5'; // Default locked state (greyed out)
            
            let isUnlocked = false;
            let rafId = null;

            if (typeof map.getBearing === 'function') {
                map.on('rotate', function() {
                    if (rafId) cancelAnimationFrame(rafId);
                    rafId = requestAnimationFrame(() => {
                        const bearing = map.getBearing();
                        icon.style.transform = `rotate(${bearing}deg) translateZ(0)`;
                    });
                });
            }

            window.toggleCompass = function(forceState) {
                if (typeof forceState === 'boolean') {
                    if (isUnlocked === forceState) return;
                    isUnlocked = forceState;
                } else {
                    isUnlocked = !isUnlocked;
                }
                
                if (isUnlocked) {
                    if (map.touchRotate) map.touchRotate.enable();
                    container.classList.add('is-active-compass');
                    icon.style.opacity = '1';
                    container.style.borderColor = '#e85d04';
                    container.style.boxShadow = '0 0 10px rgba(232,93,4,0.3)';
                } else {
                    if (map.touchRotate) map.touchRotate.disable();
                    if (typeof map.setBearing === 'function') map.setBearing(0);
                    container.classList.remove('is-active-compass');
                    icon.style.opacity = '0.5';
                    container.style.borderColor = 'rgba(255,255,255,0.1)';
                    container.style.boxShadow = 'none';
                }
            };
            container.onclick = function(e) {
                L.DomEvent.stopPropagation(e);
                window.toggleCompass();
            };
            return container;
        }
    });
    
    // â”€â”€ Clima Farm Control (BotÃ£o ABAIXO da bÃºssola) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ClimaFarmControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.id = 'btn-clima-farm-control';
            container.title = 'Clima Farm â€” Dados ClimÃ¡ticos por TalhÃ£o';
            container.style.cssText = [
                'background-color: var(--bg-secondary)',
                'border: 1px solid rgba(255,255,255,0.1)',
                'border-radius: 12px',
                'backdrop-filter: blur(12px)',
                'width: 44px',
                'height: 44px',
                'cursor: pointer',
                'display: flex',
                'justify-content: center',
                'align-items: center',
                'margin-bottom: 10px',
                'margin-right: 10px',
                'transition: all 0.25s'
            ].join(';');

            const iconWrap = L.DomUtil.create('div', 'cf-btn-icon', container);
            iconWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;opacity:0.85;transition:opacity 0.2s;';
            // Custom SVG icon requested by the user: Simple blue cloud outline
            iconWrap.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
            </svg>`;

            container.onmouseover = function() {
                if (!window.climaFarmActive) container.style.backgroundColor = 'rgba(255,255,255,0.1)';
            };
            container.onmouseout = function() {
                if (!window.climaFarmActive) container.style.backgroundColor = 'var(--bg-secondary)';
            };

            container.onclick = function(e) {
                L.DomEvent.stopPropagation(e);
                if (window.climaFarmToggle) window.climaFarmToggle();
            };

            return container;
        }
    });
    map.addControl(new ClimaFarmControl());

    if (isTouchDevice) {
        map.addControl(new CompassControl());
    }

    // Fix map rendering bug on mobile
    setTimeout(() => { map.invalidateSize(); }, 500);

    map.zoomControl.setPosition('bottomright');

    // Custom Locate Control
    const LocateControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom-locate');
            container.style.backgroundColor = 'var(--bg-secondary)';
            container.style.border = '1px solid rgba(255,255,255,0.1)';
            container.style.borderRadius = '12px';
            container.style.backdropFilter = 'blur(12px)';
            container.style.width = '44px';
            container.style.height = '44px';
            container.style.cursor = 'pointer';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
            container.style.marginBottom = '10px';
            container.style.marginRight = '10px';
            container.title = 'Minha LocalizaÃ§Ã£o';

            const icon = L.DomUtil.create('span', '', container);
            icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`;

            container.onclick = function(e){
                L.DomEvent.stopPropagation(e);
                
                const compassBtn = document.getElementById('btn-compass-control');
                if (compassBtn && compassBtn.classList.contains('is-active-compass')) {
                    compassBtn.click(); // Desativa a bussola de forma limpa (restaura estilo e reseta rotacao)
                } else if (typeof map.setBearing === 'function') {
                    map.setBearing(0); // Failsafe para alinhar ao Norte
                }
                
                if (window._agrogis_gpsMarker) {
                    map.flyTo(window._agrogis_gpsMarker.getLatLng(), 16, {duration: 1.5});
                } else {
                    alert("Aguardando sinal do GPS...");
                }
            }
            
            container.onmouseover = function() { container.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; };
            container.onmouseout = function() { container.style.backgroundColor = 'var(--bg-secondary)'; };

            return container;
        }
    });
    map.addControl(new LocateControl());

    // Restrict Attribute Table (Popups) for Visualizer Level
    // Restrict Attribute Table (Popups) for Visualizer Level
    map.on('popupopen', function(e) {
        const savedLevel = localStorage.getItem('agrogis_access_level');
        if (!savedLevel || parseInt(savedLevel) === 1) {
            const source = e.popup._source;
            const props = source && source.feature ? source.feature.properties : null;
            const isEquipe = props && (props.atividade || props.ATIVIDADE || props.equipe || props.EQUIPE);
            
            if (!isEquipe) {
                map.closePopup(e.popup);
            }
        }
    });

    // Toggle labels based on zoom level and user preference
    const isMobile = window.innerWidth <= 768;
    const ZOOM_THRESHOLD = 13; // Fazendas (Appears closer)
    const TALHOES_ZOOM_THRESHOLD = 13.5; // TalhÃµes (Appears closer)
    const EQUIPES_ZOOM_THRESHOLD = isMobile ? 10 : 8; // Equipes
    
    // Dynamic Layer Engine Stores
    const loadedLayers = {}; // Store layer objects for toggling/searching
    window.loadedLayers = loadedLayers; // Expose for modules
    const layerLabels = { TALHOES: [] }; // Store markers for viewport culling
    const activeLabelGroups = { TALHOES: L.layerGroup().addTo(map) };
    const layerStyles = {}; // Store generated styles

    // ─── Spatial Grid Index para labels de talhões ──────────────────────
    // Divide o espaço em células de 0.1° × 0.1° para lookup O(1) por viewport
    const GRID_CELL_SIZE = 0.1; // graus
    const _talhaoGrid = {}; // { "lat_lng": [items] }

    function _gridKey(lat, lng) {
        const gLat = Math.floor(lat / GRID_CELL_SIZE);
        const gLng = Math.floor(lng / GRID_CELL_SIZE);
        return `${gLat}_${gLng}`;
    }

    function _addToGrid(item) {
        const key = _gridKey(item.latlng.lat, item.latlng.lng);
        if (!_talhaoGrid[key]) _talhaoGrid[key] = [];
        _talhaoGrid[key].push(item);
    }
    
    function createTalhaoMarker(item) {
        const tooltip = L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'custom-talhao-label-tooltip',
            interactive: false // Tooltips naturally pass clicks and drags to the map
        }).setLatLng(item.latlng).setContent(item.html);
        
        return tooltip;
    }

    function _getGridItemsInBounds(bounds) {
        const minLat = Math.floor(bounds.getSouth() / GRID_CELL_SIZE);
        const maxLat = Math.floor(bounds.getNorth() / GRID_CELL_SIZE);
        const minLng = Math.floor(bounds.getWest() / GRID_CELL_SIZE);
        const maxLng = Math.floor(bounds.getEast() / GRID_CELL_SIZE);
        const result = [];
        for (let gLat = minLat; gLat <= maxLat; gLat++) {
            for (let gLng = minLng; gLng <= maxLng; gLng++) {
                const key = `${gLat}_${gLng}`;
                if (_talhaoGrid[key]) result.push(..._talhaoGrid[key]);
            }
        }
        return result;
    }
    // ────────────────────────────────────────────────────────────────────

    function updateLabelVisibility() {
        if (!map) return;
        const currentZoom = map.getZoom();
        const mapContainer = document.getElementById('map');
        mapContainer.setAttribute('data-zoom', Math.floor(currentZoom));
        if (currentZoom < 15) {
            mapContainer.classList.add('zoom-lt-15');
        } else {
            mapContainer.classList.remove('zoom-lt-15');
        }
        
        // Fazendas logic
        const toggleFazendas = document.getElementById('toggle-labels-fazendas');
        const fazendasEnabled = toggleFazendas ? toggleFazendas.checked : true;
        if (fazendasEnabled && map.getZoom() >= ZOOM_THRESHOLD) {
            document.getElementById('map').classList.add('show-labels');
        } else {
            document.getElementById('map').classList.remove('show-labels');
        }

        // ─── MinZoom para Polígonos de Talhões (Otimização Extrema) ───
        // Só renderiza os milhares de polígonos a partir do zoom 12
        if (loadedLayers && loadedLayers['TALHOES']) {
            const talhoesLayer = loadedLayers['TALHOES'];
            const checkbox = document.querySelector('input[type="checkbox"][data-layer="TALHOES"]');
            const isToggledOn = checkbox ? checkbox.checked : true;
            
            if (isToggledOn) {
                if (currentZoom < 11) {
                    if (map.hasLayer(talhoesLayer)) map.removeLayer(talhoesLayer);
                } else {
                    if (!map.hasLayer(talhoesLayer)) map.addLayer(talhoesLayer);
                }
            }
        }
        // ──────────────────────────────────────────────────────────────

        // Talhões Viewport logic — usa grid espacial para O(k) onde k = talhões visíveis
        if (activeLabelGroups.TALHOES) {
            const toggleTalhoes = document.getElementById('toggle-labels-talhoes');
            const talhoesEnabled = toggleTalhoes ? toggleTalhoes.checked : true;
            const zoom = map.getZoom();
            
            if (talhoesEnabled && zoom >= TALHOES_ZOOM_THRESHOLD) {
                const bounds = map.getBounds().pad(0.15);
                const candidates = _getGridItemsInBounds(bounds);
                const toAdd = [];
                const toRemove = [];

                // Marca itens visíveis para adicionar
                const visibleSet = new Set();
                for (const item of candidates) {
                    if (bounds.contains(item.latlng)) {
                        visibleSet.add(item);
                        const hasLayer = item.marker && activeLabelGroups.TALHOES.hasLayer(item.marker);
                        if (!hasLayer) {
                            if (!item.marker) {
                                item.marker = createTalhaoMarker(item);
                            }
                            toAdd.push(item.marker);
                        }
                    }
                }

                // Remove apenas markers que saíram da tela
                activeLabelGroups.TALHOES.getLayers().forEach(marker => {
                    const item = layerLabels.TALHOES.find(i => i.marker === marker);
                    if (item && !visibleSet.has(item)) {
                        toRemove.push(marker);
                    }
                });

                // Batch DOM — fora do loop
                toAdd.forEach(m => activeLabelGroups.TALHOES.addLayer(m));
                toRemove.forEach(m => activeLabelGroups.TALHOES.removeLayer(m));
            } else {
                if (activeLabelGroups.TALHOES.getLayers().length > 0) {
                    activeLabelGroups.TALHOES.clearLayers();
                }
            }
        }
    }
    
    // Debounce: 200ms — aguarda o mapa parar antes de recalcular labels
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    const debouncedUpdateLabelVisibility = debounce(updateLabelVisibility, 200);

    map.on('zoomend', debouncedUpdateLabelVisibility);
    map.on('moveend', debouncedUpdateLabelVisibility);

    // 2. Map Base Layers Setup
    // Performance tileLayer options to prevent stuttering on mobile
    const tileOptions = {
        maxZoom: 19,
        updateWhenIdle: isTouchDevice, // Load tiles only when pan stops on mobile
        updateWhenZooming: false,
        keepBuffer: 3 // Keep offscreen tiles longer to reduce flashing
    };

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        ...tileOptions,
        zIndex: 1,
        attribution: 'Tiles &copy; Esri'
    });

    const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
        ...tileOptions,
        attribution: '&copy; CartoDB',
        subdomains: 'abcd'
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        ...tileOptions,
        attribution: '&copy; OpenStreetMap contributors'
    });

    // const satelliteGroup = L.layerGroup([satelliteLayer, labelsLayer]).addTo(map); // Will be created later

    // 2.5 Offline Basemap Setup
    // 2. Offline Satellite Layer (ImageOverlays in a LayerGroup)
    let offlineSatelliteLayer = L.layerGroup();
    
    if (typeof OFFLINE_IMAGES_CONFIG !== 'undefined') {
        OFFLINE_IMAGES_CONFIG.forEach(item => {
            L.imageOverlay(item.url, item.bounds, {
                opacity: 1,
                interactive: false,
                pane: 'tilePane', // Put below online tiles
                zIndex: 0,
                className: 'offline-img-layer'
            }).addTo(offlineSatelliteLayer);
        });
    }

    // Add everything to satelliteGroup so offline images act as an automatic fallback underneath
    const satelliteGroup = L.layerGroup([offlineSatelliteLayer, satelliteLayer, labelsLayer]).addTo(map);

    // 3. Basemap Selector Toggle Logic
    const satBtn = document.getElementById('basemap-sat');
    const osmBtn = document.getElementById('basemap-osm');

    // Removido o updateBasemapOfflineStatus para permitir que o Service Worker gerencie o cache dos tiles,
    // garantindo que o BASEMAP WEB continue funcionando offline com as imagens em cache.
    // O offlineSatelliteLayer já está no satelliteGroup como camada de fundo de fallback automático.

    satBtn.addEventListener('click', () => {
        if (!map.hasLayer(satelliteGroup)) {
            map.removeLayer(osmLayer);
            satelliteGroup.addTo(map);
            satBtn.classList.add('active');
            osmBtn.classList.remove('active');
        }
    });

    osmBtn.addEventListener('click', () => {
        if (!map.hasLayer(osmLayer)) {
            map.removeLayer(satelliteGroup);
            osmLayer.addTo(map);
            osmBtn.classList.add('active');
            satBtn.classList.remove('active');
        }
    });

    // Helper to generate dynamic tabular popups from GeoJSON properties
    function createPopupContent(title, properties) {
        let rows = '';
        for (const [key, value] of Object.entries(properties)) {
            if (value !== null && typeof value !== 'object') {
                rows += `
                    <tr>
                        <td style="font-weight: 600; padding-right: 8px;">${key}</td>
                        <td>${value}</td>
                    </tr>
                `;
            }
        }
        return `
            <div class="popup-title">${title}</div>
            <table class="popup-table">
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    let globalBounds = L.latLngBounds();

    // Define some premium colors for known layers or general rotation
    const colorPalette = ['#ff9f1c', '#2ec4b6', '#e71d36', '#2a9d8f', '#e9c46a', '#f4a261', '#8338ec', '#ff006e'];
    let colorIndex = 0;

    const dynamicLayerList = document.getElementById('dynamic-layer-list');

    // Extended palette for categorizing farms in TalhÃµes
    const extendedPalette = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'];
    const farmColors = {};
    let farmColorIndex = 0;
    function getFarmColor(farmName) {
        if (!farmName) return '#2ec4b6';
        if (!farmColors[farmName]) {
            farmColors[farmName] = extendedPalette[farmColorIndex % extendedPalette.length];
            farmColorIndex++;
        }
        return farmColors[farmName];
    }



    function tryInitLayers() {
        if (typeof GEOPORTAL_LAYERS !== 'undefined') {
            
            // --- PROCESS EQUIPES VIA LOCALSTORAGE REMOVIDO ---
        
        for (const layerName in GEOPORTAL_LAYERS) {
            // Ignorar completamente camadas de Grade de Coordenadas que vieram exportadas no GeoJSON
            const upperName = layerName.toUpperCase();
            const blockwords = ['GRADE', 'COORDENAD', 'GRID', 'MALHA', 'RETICULA', 'QUADRICULA', 'MERIDIANO', 'PARALELO', 'GRATICULE'];
            let shouldBlock = false;
            for (const word of blockwords) {
                if (upperName.includes(word)) {
                    shouldBlock = true;
                    break;
                }
            }
            if (shouldBlock) continue;
            
            const data = GEOPORTAL_LAYERS[layerName];
            
            // Assign base color
            let baseColor = colorPalette[colorIndex % colorPalette.length];
            
            // Identify specific layers
            const isFazenda = layerName.toUpperCase().includes('FAZENDA');
            const isTalhao = layerName.toUpperCase().includes('TALHO');
            const isLinhasColheita = layerName.toUpperCase().includes('LINHAS DE COLHEITA');
            
            // EXCLUI CAMADA DE VARIEDADE E ROTAS (Ignora no carregamento dinÃ¢mico)
            if (layerName.toUpperCase().includes('VARIEDADE') || layerName.toUpperCase().includes('ROTAS')) {
                continue;
            }

            if (isFazenda) baseColor = '#ff9f1c'; 
            if (isTalhao) baseColor = '#2ec4b6'; 
            if (isLinhasColheita) baseColor = '#00008b'; // Azul escuro
            colorIndex++;

            const styleFunc = function(feature) {
                let featureColor = baseColor;
                if (isTalhao && feature.properties) {
                    const farmName = feature.properties.NOME_FAZ || feature.properties.FAZENDA || feature.properties.nome_faz;
                    if (farmName) {
                        featureColor = getFarmColor(farmName);
                    }
                }
                
                return {
                    color: isTalhao ? '#b0b0b0' : featureColor,
                    weight: isTalhao ? 0.8 : (isFazenda ? 0 : (isLinhasColheita ? 1.0 : 1.5)),
                    opacity: isLinhasColheita ? 1.0 : (isFazenda ? 0 : 0.9),
                    fillColor: featureColor,
                    fillOpacity: isTalhao ? 0.85 : (isFazenda ? 0 : (isLinhasColheita ? 0 : 0.2))
                };
            };
            
            // Store styles for search logic
            layerStyles[layerName] = {
                default: styleFunc, // use the function directly
                highlight: { weight: 3.5, opacity: 1, fillOpacity: 1.0 }
            };

            // Create Map Layer
            
            
            const geoJsonOptions = {
                interactive: false, // Desativa os listeners padrão do Leaflet (acelera o Canvas 100x), pois usamos o Turf.js espacial
                pane: isLinhasColheita ? 'harvestLinesPane' : 'overlayPane',
                smoothFactor: isLinhasColheita ? 3.0 : (isTalhao ? 2.0 : 1.0),
                style: styleFunc,
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: isFazenda ? 12 : 6,
                        fillColor: baseColor,
                        color: "#ffffff",
                        weight: isFazenda ? 0 : 1,
                        opacity: isFazenda ? 0 : 1,
                        fillOpacity: isFazenda ? 0 : 0.8
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties || {};
                    const getProp = (props, possibleNames) => {
                        if (!props) return '';
                        const keys = Object.keys(props);
                        for (const name of possibleNames) {
                            const upperName = name.toUpperCase();
                            const foundKey = keys.find(k => k.toUpperCase() === upperName);
                            if (foundKey) return props[foundKey];
                        }
                        return '';
                    };
                    const titleRaw = getProp(props, ['NOME', 'NAME', 'FAZENDA', 'NOME_FAZ', 'NOMEPROPRI', 'DESCFUNDOA', 'TALHAO', 'ID', 'LOCAL', 'DESIGNACAO']);
                    const title = titleRaw || 'Elemento';
                    
                    if (!window.allSearchableItems) window.allSearchableItems = new Set();
                    if (isTalhao && props.NOME_FAZ) {
                        window.allSearchableItems.add(String(props.NOME_FAZ));
                    }
                    
                    if (isFazenda) {
                        if (!window.labeledFazendas) window.labeledFazendas = new Set();
                        if (!window.labeledFazendas.has(title)) {
                            // Extrai código e área
                            const cod = getProp(props, ['CODIGO', 'FAZENDA', 'COD_FAZENDA', 'COD', 'ID']) || 'N/A';
                            const areaVal = getProp(props, ['AREA_TOTAL', 'AREA_HA', 'AREA', 'HECTARES', 'DL AREA']);
                            const areaStr = areaVal ? parseFloat(areaVal).toFixed(2).replace('.', ',') : 'N/A';
                            
                            const labelHtml = `<div style="text-align: center; line-height: 1.1; font-size: 7px; font-weight: bold; transform: translateY(-25px);">
                                ${title}<br>
                                Cod.: ${cod}<br>
                                Área Total= ${areaStr}
                            </div>`;
                            
                            layer.bindTooltip(labelHtml, {
                                permanent: true,
                                direction: 'center',
                                className: 'fazenda-transparent-label'
                            });
                            window.labeledFazendas.add(title);
                        }
                    }

                    if (isTalhao) {
                        const cod = getProp(props, ['COD_TALHAO', 'TALHAO', 'CODIGO', 'NOME', 'ID']);
                        const areaVal = getProp(props, ['TALHAO_ARE', 'AREA_TOTAL', 'DL AREA', 'AREA', 'AREA_HA', 'HECTARES']);
                        const area = parseFloat(areaVal || 0).toFixed(2);
                        const varName = getProp(props, ['DL VARIEDADE', 'VARIEDADE', 'VAR', 'CULTURA']);
                        
                        const corteRaw = getProp(props, ['DL CORTE', 'CORTE', 'ESTAGIO', 'CICLO', 'CORTES']);
                        const corte = corteRaw ? (String(corteRaw).toUpperCase().includes('C') ? corteRaw : corteRaw + 'C') : '';
                        
                        if (cod) {
                            const html = `
                                <div class="talhao-complex-label" style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
                                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                        ${corte ? `<div class="tc-corte" style="color: #ff0000; font-size: 8px; font-weight: 900; text-shadow: 1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff;">${corte}</div>` : ''}
                                        <div class="tc-cod" style="font-size: 9px; font-weight: 900;">${cod}</div>
                                    </div>
                                    <div class="tc-area" style="font-size: 8px; font-weight: bold; margin-top: 1px;">${area}</div>
                                    <div class="tc-var" style="font-size: 7.5px; font-weight: bold; opacity: 0.9;">${varName}</div>
                                </div>
                            `;
                            const labelItem = { latlng: layer.getBounds().getCenter(), html: html, marker: null, layer: layer };
                            layerLabels.TALHOES.push(labelItem);
                            _addToGrid(labelItem); // Registra na grade espacial
                        }
                    }
                    layer.on({
                        mouseover: (e) => {
                            if (!isFazenda) {
                                const l = e.target;
                                if (isLinhasColheita && window.selectedHarvestLayer === l) return;
                                l.setStyle(layerStyles[layerName].highlight);
                                l.bringToFront();
                            }
                        },
                        mouseout: (e) => {
                            if (!isFazenda) {
                                const l = e.target;
                                if (isLinhasColheita && window.selectedHarvestLayer === l) return;
                                if (isTalhao && window.selectedTalhaoLayer === l) return;
                                mapLayer.resetStyle(l);
                            }
                        },
                    });
                    // Removed individual bindPopup and click handler to bypass Leaflet Canvas touch interception bugs.
                    // A global map.on('click') spatial intersection handler now manages all interactions centrally.
                }
            };
            
            const mapLayer = L.featureGroup();
            mapLayer.resetStyle = function(l) {
                if (this._realGeoJSON) this._realGeoJSON.resetStyle(l);
            };
            
            if (data === null) {
                if (isTalhao) {
                    // TALHÕES: FlatGeobuf (Carregando para a memória primeiro para evitar bug do Canvas no hit-test)
                    const loadingEl = document.createElement('div');
                    loadingEl.id = 'lazy-loading-indicator-' + layerName.replace(/\s/g, '');
                    loadingEl.innerHTML = 'Carregando ' + layerName + '...';
                    loadingEl.style = 'position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: bold; z-index: 9999; pointer-events: none;';
                    document.body.appendChild(loadingEl);

                    (async () => {
                        try {
                            const response = await fetch('./talhoes.fgb');
                            const buffer = await response.arrayBuffer();
                            
                            geoJsonOptions.renderer = L.canvas({ padding: 0.25 });
                            mapLayer._realGeoJSON = L.geoJSON(null, geoJsonOptions);
                            
                            let count = 0;
                            // new Uint8Array is safer for older browsers with flatgeobuf
                            for await (let feature of flatgeobuf.deserialize(new Uint8Array(buffer))) {
                                mapLayer._realGeoJSON.addData(feature);
                                count++;
                            }
                            
                            mapLayer.addLayer(mapLayer._realGeoJSON);
                            
                            if (isFazenda || isTalhao) {
                                mapLayer.addTo(map);
                            }
                            
                            // Update the UI count safely
                            setTimeout(() => {
                                const ul = document.getElementById('layers-list');
                                if (ul) {
                                    const items = ul.querySelectorAll('.layer-item');
                                    items.forEach(item => {
                                        const nameDiv = item.querySelector('.layer-name');
                                        if (nameDiv && nameDiv.innerText.toUpperCase() === 'TALHOES') {
                                            const subtitle = item.querySelector('.layer-subtitle');
                                            if (subtitle) subtitle.innerText = count + ' objetos';
                                        }
                                    });
                                }
                            }, 200);
                            
                            if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
                        } catch(err) {
                            console.error('Erro ao carregar ' + layerName + ' via FGB:', err);
                            if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
                        }
                    })();
                } else {
                    // LINHAS DE COLHEITA: FlatGeobuf + Canvas (Não precisam ser clicáveis com precisão)
                    mapLayer._isLazy = true;
                    geoJsonOptions.renderer = L.canvas({ padding: 0.25 });
                    mapLayer._lazyOptions = geoJsonOptions;
                    
                    mapLayer.on('add', async function() {
                        if (this._isLazy) {
                            console.log('Lazy loading layer ' + layerName + ' via FlatGeobuf');
                            const loadingEl = document.createElement('div');
                            loadingEl.id = 'lazy-loading-indicator-' + layerName.replace(/\s/g, '');
                            loadingEl.innerHTML = 'Carregando ' + layerName + '...';
                            loadingEl.style = 'position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: bold; z-index: 9999; pointer-events: none;';
                            document.body.appendChild(loadingEl);

                            this._isLazy = false;
                            this._realGeoJSON = L.geoJSON(null, this._lazyOptions);
                            this.addLayer(this._realGeoJSON);
                            
                            try {
                                let fgbFile = './linhas_colheita.fgb';
                                const response = await fetch(fgbFile);
                                const buffer = await response.arrayBuffer();
                                for await (let feature of flatgeobuf.deserialize(new Uint8Array(buffer))) {
                                    this._realGeoJSON.addData(feature);
                                }
                                if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
                            } catch (err) {
                                console.error('Erro lazy load:', err);
                                if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
                            }
                        }
                    });
                }
            } else {
                mapLayer._realGeoJSON = L.geoJSON(data, geoJsonOptions);
                mapLayer.addLayer(mapLayer._realGeoJSON);
            }
            
            const isDefaultActive = isFazenda || isTalhao;
            if (isDefaultActive && !isTalhao) {
                mapLayer.addTo(map);
            }
            
            loadedLayers[layerName] = mapLayer;

            // Expand Bounds safely
            try {
                if (mapLayer.getBounds && typeof mapLayer.getBounds === 'function') {
                    if (mapLayer.getLayers().length > 0) {
                        const b = mapLayer.getBounds();
                        if (b && b.isValid()) globalBounds.extend(b);
                    }
                }
            } catch(e) { console.warn('Bounds error', e); }

            // Create UI Checkbox
            const safeId = layerName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const checkedAttr = isDefaultActive ? 'checked' : '';
            
            const labelStateKey = `agrogis_label_state_${safeId}`;
            const savedLabelState = localStorage.getItem(labelStateKey);
            const isLabelChecked = savedLabelState === null ? true : savedLabelState === 'true';
            const labelCheckedAttrStr = isLabelChecked ? 'checked' : '';

            // Add submenu (accordion)
            let extraControls = `
                <div class="layer-submenu" style="display: none; margin-top: 10px; margin-left: 35px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                    <label class="custom-checkbox" style="font-size: 11px; margin-bottom: 8px; display: flex; align-items: center;">
                        <input type="checkbox" id="toggle-labels-${safeId}" ${labelCheckedAttrStr}>
                        <span class="checkmark" style="--layer-color: #f6ea7c; width: 14px; height: 14px; min-width: 14px;"></span>
                        <span class="layer-name" style="margin-left: 8px; color: var(--text-main);">Exibir RÃ³tulos</span>
                    </label>
                </div>
            `;

            const li = document.createElement('li');
            li.className = 'layer-item';
            li.style.display = 'block'; // Override default flex to allow vertical stacking
            
            const featureCount = (data && data.features && data.features.length) || (isLinhasColheita ? 10700 : 0);
            const subtitleText = featureCount === 1 ? '1 objeto' : featureCount + ' objetos';
            const avenzaIcon = `<div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255, 255, 255, 0.03); display: flex; justify-content: center; align-items: center; margin-right: 12px; flex-shrink: 0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${baseColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg></div>`;

            li.innerHTML = `
                <div class="layer-main-row">
                    ${avenzaIcon}
                    <div class="layer-text-container" style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; text-align: left;">
                        <div class="layer-name" style="font-size: 14px; font-weight: 500; color: var(--text-main); line-height: 1; text-transform: capitalize;">${layerName.replace(/_/g, ' ')}</div>
                        <div class="layer-subtitle" style="font-size: 9px; color: rgba(255, 255, 255, 0.25); margin-top: 0px; line-height: 1;">${subtitleText}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <label class="custom-checkbox" style="margin-bottom: 0;" onclick="event.stopPropagation();">
                            <input type="checkbox" id="toggle-${safeId}" ${checkedAttr} data-layer="${layerName}">
                            <span class="checkmark" style="--layer-color: ${baseColor}"></span>
                        </label>
                        <span class="submenu-arrow" style="font-size: 10px; color: rgba(255,255,255,0.3); font-weight: bold; width: 16px; text-align: center;">â–¼</span>
                    </div>
                </div>
                ${extraControls}
            `;
            dynamicLayerList.appendChild(li);
            
            // Accordion open/close logic for ALL layers
            const mainRow = li.querySelector('.layer-main-row');
            const submenu = li.querySelector('.layer-submenu');
            const arrow = li.querySelector('.submenu-arrow');
            
            mainRow.addEventListener('click', () => {
                if (submenu.style.display === 'none') {
                    submenu.style.display = 'block';
                    arrow.innerHTML = 'â–²';
                } else {
                    submenu.style.display = 'none';
                    arrow.innerHTML = 'â–¼';
                }
            });

            // Wire label toggle immediately if it is Fazenda (for now)
            if (isFazenda || layerName.toUpperCase().includes('TALHOES')) {
                const labelToggle = document.getElementById(`toggle-labels-${safeId}`);
                if (labelToggle) {
                    labelToggle.addEventListener('change', (e) => {
                        localStorage.setItem(`agrogis_label_state_${safeId}`, e.target.checked);
                        updateLabelVisibility();
                    });
                }
            }

            const styleId = `style-${safeId}`;
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
                    #toggle-${safeId}:checked ~ .checkmark { background-color: ${baseColor} !important; border-color: ${baseColor} !important; }
                    #toggle-${safeId}:checked ~ .layer-name { color: #fff !important; }
                `;
                document.head.appendChild(style);
            }
            const checkbox = li.querySelector(`#toggle-${safeId}`);
            checkbox.addEventListener('change', (e) => {
                const targetLayerName = e.target.getAttribute('data-layer');
                const targetLayer = loadedLayers[targetLayerName];
                
                if (e.target.checked) {
                    // Auto-hide other vector layers if this is VARIEDADES
                    if (targetLayerName.toUpperCase().includes('VARIEDADE')) {
                        const allCheckboxes = dynamicLayerList.querySelectorAll('input[type="checkbox"][data-layer]');
                        allCheckboxes.forEach(cb => {
                            const otherLayerName = cb.getAttribute('data-layer');
                            if (otherLayerName !== targetLayerName) {
                                if (cb.checked) {
                                    cb.checked = false;
                                    const otherLayer = loadedLayers[otherLayerName];
                                    if (otherLayer) map.removeLayer(otherLayer);
                                }
                            }
                        });
                        
                        // Hide EQUIPES since it doesn't have a checkbox
                        if (loadedLayers['EQUIPES']) {
                            map.removeLayer(loadedLayers['EQUIPES']);
                        }
                    }
                    map.addLayer(targetLayer);
                } else {
                    map.removeLayer(targetLayer);
                    // Restore EQUIPES when VARIEDADES is unchecked
                    if (targetLayerName.toUpperCase().includes('VARIEDADE')) {
                        if (loadedLayers['EQUIPES']) {
                            // Let updateLabelVisibility handle adding it back if zoom permits
                        }
                    }
                }
                
                // Re-evaluate zoom constraints after any layer toggle
                updateLabelVisibility();
            });
        }

        // Initialize Custom Layers after map layers are ready
        initCustomLayers();
        updateLabelVisibility(); // Call initial check after layers are loaded
    } else {
        // Try again in 200ms
        setTimeout(tryInitLayers, 200);
    }
}

// --- CARREGAMENTO ASSÍNCRONO DOS DADOS ---
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('AgrogisDB', 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('layers')) {
            db.createObjectStore('layers');
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

async function saveImportedLayers(jsonStr) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction('layers', 'readwrite');
        tx.objectStore('layers').put(jsonStr, 'layers_data');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getImportedLayers() {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction('layers', 'readonly');
        const req = tx.objectStore('layers').get('layers_data');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function loadLayersDataAsync() {
    console.log("Iniciando carregamento assíncrono de layers_data...");
    
    const loadingEl = document.createElement('div');
    loadingEl.id = "background-loading-indicator";
    loadingEl.innerHTML = "Carregando dados do mapa...";
    loadingEl.style = "position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #fff; padding: 5px 15px; border-radius: 20px; font-size: 12px; z-index: 1000; pointer-events: none;";
    document.body.appendChild(loadingEl);

    try {
        const importedDataStr = await getImportedLayers();
        if (importedDataStr) {
            console.log("Camadas importadas localizadas no IndexedDB!");
            window.GEOPORTAL_LAYERS = JSON.parse(importedDataStr);
            const indicator = document.getElementById("background-loading-indicator");
            if (indicator) indicator.remove();
            tryInitLayers();
            return;
        }
    } catch(e) {
        console.warn("Erro ao ler IndexedDB, tentando versão nativa...", e);
    }

    const localUrl = new URL('layers_data.js', window.location.href).href;
    const remoteUrl = window.REMOTE_LAYERS_URL || 'https://edinaldoagrogis.github.io/Agrogis_NDB/layers_data.js';
    const targetUrl = window.location.protocol === 'file:' ? remoteUrl : localUrl;
    
    const script = document.createElement('script');
    script.src = targetUrl;
    script.onload = () => {
        console.log("Dados carregados com sucesso via Script!");
        const indicator = document.getElementById("background-loading-indicator");
        if (indicator) indicator.remove();
        tryInitLayers();
    };
    script.onerror = (err) => {
        console.error("Erro ao carregar dados:", err);
        const indicator = document.getElementById("background-loading-indicator");
        if (indicator) indicator.innerHTML = "Erro ao carregar mapa.";
    };
    document.head.appendChild(script);
}

loadLayersDataAsync();

    // --- CUSTOM LAYERS LOGIC ---
    let myLayers = {
        pontos: null,
        areas: null,
        rotas: null,
        medicao_area: null,
        medicao_distancia: null
    };

    function saveCustomFeature(type, geoJsonFeature) {
        const key = `agrogis_custom_${type}`;
        let existing = localStorage.getItem(key);
        let featureCollection = { type: 'FeatureCollection', features: [] };
        if (existing) {
            try { featureCollection = JSON.parse(existing); } catch(e){}
        }
        
        if (!geoJsonFeature.properties.id) {
            geoJsonFeature.properties.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        }
        
        featureCollection.features.push(geoJsonFeature);
        localStorage.setItem(key, JSON.stringify(featureCollection));
        
        // Reload layer
        loadCustomLayer(type, featureCollection);
        renderCustomFeaturesList(type);
    }

    async function deleteCustomFeature(type, id) {
        if (!(await window.agrogisConfirm('Deseja realmente excluir este item?'))) return;
        deleteCustomFeatures(type, [id]);
    }

    function editCustomFeatureName(type, id, oldName) {
        openNameModal(oldName || '', (newName) => {
            if (!newName) return;
            const key = `agrogis_custom_${type}`;
            let existing = localStorage.getItem(key);
            if (existing) {
                try { 
                    let fc = JSON.parse(existing);
                    let feat = fc.features.find(f => f.properties.id === id);
                    if (feat) {
                        feat.properties.NOME = newName;
                        localStorage.setItem(key, JSON.stringify(fc));
                        loadCustomLayer(type, fc);
                        renderCustomFeaturesList(type);
                    }
                } catch(e){}
            }
        });
    }

    // Context Menu Global para Editar/Excluir/Compartilhar
    let activeContextMenu = null;
    function showContextMenu(type, id, name, latlng) {
        if (activeContextMenu) {
            map.removeLayer(activeContextMenu);
        }
        
        let whatsappHtml = '';
        if (type === 'pontos' && latlng) {
            // Encode the coordinates into a Google Maps URL for WhatsApp sharing
            const gmapsUrl = `https://maps.google.com/?q=${latlng.lat},${latlng.lng}`;
            const message = encodeURIComponent(`Veja o ponto "${name}": ${gmapsUrl}`);
            const wappUrl = `https://api.whatsapp.com/send?text=${message}`;
            whatsappHtml = `<a href="${wappUrl}" style="display: block; width: 100%; text-align: left; background: none; border: none; color: #25d366; padding: 6px; cursor: pointer; font-size: 13px; margin-top: 4px; text-decoration: none;">ðŸ“² Compartilhar (WhatsApp)</a>`;
        }

        const content = document.createElement('div');
        content.className = 'custom-context-menu';
        content.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; font-size: 13px;">${name}</div>
            <button id="ctx-edit-btn" style="width: 100%; text-align: left; background: none; border: none; color: #2ec4b6; padding: 6px; cursor: pointer; font-size: 13px;">âœï¸ Editar Nome</button>
            <button id="ctx-del-btn" style="width: 100%; text-align: left; background: none; border: none; color: #e71d36; padding: 6px; cursor: pointer; font-size: 13px; margin-top: 4px;">ðŸ—‘ï¸ Excluir</button>
            ${whatsappHtml}
        `;
        
        const popup = L.popup({
            closeButton: true,
            minWidth: 150,
            className: 'action-context-popup'
        })
        .setLatLng(latlng)
        .setContent(content)
        .openOn(map);
        
        activeContextMenu = popup;
        
        // Wait for DOM
        setTimeout(() => {
            const btnEdit = document.getElementById('ctx-edit-btn');
            const btnDel = document.getElementById('ctx-del-btn');
            if (btnEdit) btnEdit.addEventListener('click', () => {
                map.closePopup(popup);
                editCustomFeatureName(type, id, name);
            });
            if (btnDel) btnDel.addEventListener('click', () => {
                map.closePopup(popup);
                deleteCustomFeature(type, id);
            });
        }, 50);
    }

    function loadCustomLayer(type, featureCollection) {
        if (!featureCollection) {
            const key = `agrogis_custom_${type}`;
            const existing = localStorage.getItem(key);
            if (existing) {
                try { featureCollection = JSON.parse(existing); } catch(e){}
            } else {
                featureCollection = { type: 'FeatureCollection', features: [] };
            }
        }
        
        // Garantir que todos tenham ID
        let updated = false;
        featureCollection.features.forEach(f => {
            if (!f.properties.id) {
                f.properties.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                updated = true;
            }
        });
        if (updated) {
            localStorage.setItem(`agrogis_custom_${type}`, JSON.stringify(featureCollection));
        }
        
        if (myLayers[type]) {
            myLayers[type].clearLayers();
            myLayers[type].addData(featureCollection);
        } else {
            let options = {
                interactive: false,
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        const featureName = feature.properties.NOME || 'Sem Nome';
                        let labelText = featureName;
                        if (type === 'areas' && feature.properties.AREA_HA) {
                            labelText += `<br><span style="font-size: 10px; color: #2ec4b6;">${feature.properties.AREA_HA} ha</span>`;
                        }
                        
                        // Rotulagem Permanente (Sempre visÃ­vel no mapa)
                        layer.bindTooltip(labelText, {
                            permanent: true,
                            direction: 'top',
                            offset: [0, -8],
                            className: 'custom-label-tooltip'
                        });
                        
                        // Clique Simples (Mostra Nome, Ãrea, e BotÃµes de AÃ§Ã£o)
                        layer.on('click', (e) => {
                            let popupHtml = `<div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${featureName}</div>`;
                            
                            if (type === 'areas' && feature.properties.AREA_HA) {
                                popupHtml += `<div style="margin-bottom: 12px; color: #2ec4b6;">Ãrea: ${feature.properties.AREA_HA} ha</div>`;
                            } else if (feature.properties.TIPO) {
                                popupHtml += `<div style="margin-bottom: 12px; color: #a8b8b0;">Tipo: ${feature.properties.TIPO}</div>`;
                            }
                            
                            let whatsappHtml = '';
                            if (type === 'pontos') {
                                const latlng = e.latlng || layer.getLatLng();
                                const gmapsUrl = `https://maps.google.com/?q=${latlng.lat},${latlng.lng}`;
                                const message = encodeURIComponent(`Veja o ponto "${featureName}": ${gmapsUrl}`);
                                const wappUrl = `https://api.whatsapp.com/send?text=${message}`;
                                whatsappHtml = `<button onclick="window.location.href='${wappUrl}'" style="width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none; color: #25d366; padding: 6px; cursor: pointer; font-size: 13px; margin-top: 4px;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>
                                    Compartilhar
                                </button>`;
                            }
                            
                            popupHtml += `
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <button id="inline-edit-btn" style="width: 100%; text-align: left; background: none; border: none; color: #2ec4b6; padding: 6px; cursor: pointer; font-size: 13px;">✏️ Editar Nome</button>
                                    <button id="inline-del-btn" style="width: 100%; text-align: left; background: none; border: none; color: #e71d36; padding: 6px; cursor: pointer; font-size: 13px;">🗑️ Excluir</button>
                                    ${whatsappHtml}
                                </div>
                            `;
                            
                            let popupLatlng = e.latlng;
                            if (!popupLatlng) {
                                popupLatlng = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
                            }
                            
                            const popup = L.popup({ className: 'custom-popup', minWidth: 150 })
                                .setLatLng(popupLatlng)
                                .setContent(popupHtml)
                                .openOn(map);
                                
                            setTimeout(() => {
                                const btnEdit = document.getElementById('inline-edit-btn');
                                const btnDel = document.getElementById('inline-del-btn');
                                if (btnEdit) btnEdit.addEventListener('click', () => {
                                    map.closePopup(popup);
                                    editCustomFeatureName(type, feature.properties.id, featureName);
                                });
                                if (btnDel) btnDel.addEventListener('click', () => {
                                    map.closePopup(popup);
                                    deleteCustomFeature(type, feature.properties.id);
                                });
                            }, 50);
                        });
                    }
                }
            };
            
            if (type === 'pontos') {
                options.pointToLayer = (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: 10,
                        fillColor: '#e71d36',
                        color: '#fff',
                        weight: 3,
                        fillOpacity: 1,
                        pane: 'tooltipPane'
                    });
                };
            } else if (type === 'areas') {
                options.style = {
                    color: '#2ec4b6',
                    weight: 2,
                    fillColor: '#2ec4b6',
                    fillOpacity: 0.4,
                    pane: 'tooltipPane'
                };
            } else if (type === 'medicao_area') {
                options.style = {
                    color: '#2196f3',
                    weight: 2,
                    fillColor: '#2196f3',
                    fillOpacity: 0.4,
                    pane: 'tooltipPane'
                };
            } else if (type === 'rotas') {
                options.style = {
                    color: '#e85d04',
                    weight: 4,
                    pane: 'tooltipPane'
                };
            } else if (type === 'medicao_distancia') {
                options.style = {
                    color: '#9c27b0',
                    weight: 4,
                    pane: 'tooltipPane'
                };
            }
            
            myLayers[type] = L.geoJSON(featureCollection, options);
loadedLayers[type.toUpperCase()] = myLayers[type];
        }
    }

    // â”€â”€ AnÃ¡lise Global (Todas as Fazendas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let globalAnalysisResults = { type: 'FeatureCollection', features: [] };
    let isGlobalAnalysisRunning = false;
    let cancelGlobalAnalysisFlag = false;

    window.cancelGlobalAnalysis = function() {
        if (isGlobalAnalysisRunning) {
            cancelGlobalAnalysisFlag = true;
            const btnCancel = document.getElementById('btn-weed-cancel-general');
            if (btnCancel) btnCancel.innerText = 'Cancelando...';
        }
    };

        window.runGlobalAnalysis = async function() {
            if (isGlobalAnalysisRunning) return;
            cancelGlobalAnalysisFlag = false;
            
            // Coletar todos os IDs de fazendas Ãºnicas que estÃ£o carregadas no mapa
            const seenFarms = new Set();
            const farmsList = [];
            
            if (!window.loadedLayers) {
                alert("O mapa ainda nÃ£o terminou de carregar os dados das fazendas. Tente novamente em instantes.");
                return;
            }

            Object.keys(window.loadedLayers).forEach(layerName => {
                const mapLayer = window.loadedLayers[layerName];
                if (!mapLayer || !mapLayer.eachLayer) return;
                mapLayer.eachLayer(layer => {
                    const props = layer.feature && layer.feature.properties;
                    if (!props) return;
                    const rawName = props.NOME_FAZ || props['DL DESCFUNDOA'] || 'Fazenda Desconhecida';
                    const rawId = props.FAZENDA || props.DL_FUNDOAGRIC || props['DL FUNDOAGRIC'];
                    
                    if (rawId) {
                        const cleanIdStr = String(rawId).split(',')[0].split('.')[0].trim();
                        if (cleanIdStr && !seenFarms.has(cleanIdStr)) {
                            seenFarms.add(cleanIdStr);
                            farmsList.push({ id: cleanIdStr, name: rawName, originalId: rawId });
                        }
                    }
                });
            });

            if (farmsList.length === 0) {
                alert("Nenhuma fazenda encontrada nos dados carregados.");
                return;
            }

            // Setup UI
            isGlobalAnalysisRunning = true;
            cancelGlobalAnalysisFlag = false;
            globalAnalysisResults = { type: 'FeatureCollection', features: [] };
            
            const btn = document.getElementById('btn-weed-analyze-general');
            const btnCancel = document.getElementById('btn-weed-cancel-general');
            const icon = document.getElementById('weed-btn-icon-general');
            const text = document.getElementById('weed-btn-text-general');
            const statusArea = document.getElementById('weed-general-status-area');
            const progressBar = document.getElementById('weed-general-progress-bar');
            const progressText = document.getElementById('weed-general-progress-text');
            const logArea = document.getElementById('weed-general-log');
            const resultArea = document.getElementById('weed-general-result-area');
            const resultMsg = document.getElementById('weed-general-result-msg');

            if(btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
            if(btnCancel) { btnCancel.style.display = 'flex'; btnCancel.innerText = 'ðŸ›‘ Cancelar'; }
            if(icon) icon.innerHTML = '<div style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>';
            if(text) text.innerText = 'AnÃ¡lise em Andamento...';
            if(statusArea) statusArea.style.display = 'block';
            if(resultArea) resultArea.style.display = 'none';
            if(logArea) logArea.innerHTML = '';
            
            const totalFarms = farmsList.length;
            let successCount = 0;
            let failCount = 0;
            let totalHa = 0;

            const addLog = (msg, color = 'rgba(255,255,255,0.6)') => {
                if(!logArea) return;
                const li = document.createElement('li');
                li.style.color = color;
                li.style.marginBottom = '4px';
                li.innerText = msg;
                logArea.appendChild(li);
                logArea.scrollTop = logArea.scrollHeight;
            };

            for (let i = 0; i < totalFarms; i++) {
                if (cancelGlobalAnalysisFlag) {
                    addLog('ðŸ›‘ ANÃLISE CANCELADA PELO USUÃRIO', '#ff9f1c');
                    break;
                }
                
                const farm = farmsList[i];
                
                // Atualizar progresso
                const percent = Math.round((i / totalFarms) * 100);
                if(progressBar) progressBar.style.width = percent + '%';
                if(progressText) progressText.innerText = `${i+1} / ${totalFarms} Fazendas`;
                
                addLog(`Buscando dados da ${farm.name}...`);
                
                // Obter features da fazenda
                const features = getFazendaFeatures(farm.originalId);
                if (features.length === 0) {
                    addLog(`Ignorando ${farm.name}: Sem polÃ­gonos vÃ¡lidos.`, '#ff9f1c');
                    failCount++;
                    continue;
                }

                const payload = {
                    geojson: { type: 'FeatureCollection', features: features },
                    cod_talhao: farm.id,
                    nome_faz: farm.name,
                    days_back: 20,
                    max_cloud: 20
                };

                try {
                    addLog(`Iniciando detecÃ§Ã£o para ${farm.name}...`);
                    const response = await fetch(`${API_URL}/analyze`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        const detail = errData.detail || 'Erro na requisiÃ§Ã£o';
                        addLog(`Erro em ${farm.name}: ${detail}`, '#ff6666');
                        failCount++;
                    } else {
                        const data = await response.json();
                        if (data.success) {
                            const ha = data.total_infested_ha || 0;
                            const rebolCount = (data.reboleiras || []).length;
                            
                            if (rebolCount > 0) {
                                addLog(`Encontrado: ${ha} ha infestados (${rebolCount} focos) na ${farm.name}`, '#4CAF50');
                                totalHa += ha;
                                
                                // Acumular resultados
                                if (data.geojson_collection && data.geojson_collection.features) {
                                    // Adicionar o nome da fazenda nas propriedades de cada reboleira
                                    data.geojson_collection.features.forEach(f => {
                                        if(!f.properties) f.properties = {};
                                        f.properties.FAZENDA = farm.name;
                                        f.properties.FAZENDA_ID = farm.id;
                                    });
                                    globalAnalysisResults.features.push(...data.geojson_collection.features);
                                }
                            } else {
                                addLog(`Limpo: Nenhum foco detectado na ${farm.name} (Nuvens: ${data.cloud_cover}%)`, '#888');
                            }
                            successCount++;
                        } else {
                            addLog(`Falha em ${farm.name}: ${data.message}`, '#ff9f1c');
                            failCount++;
                        }
                    }
                } catch (error) {
                    addLog(`ExceÃ§Ã£o em ${farm.name}: Servidor nÃ£o respondeu.`, '#ff6666');
                    failCount++;
                }
            }

            // Finalizou o loop
            if(progressBar) progressBar.style.width = '100%';
            if(btn) { btn.disabled = false; btn.style.opacity = '1'; }
            if(btnCancel) { btnCancel.style.display = 'none'; }
            if(icon) icon.innerHTML = 'ðŸŒŽ';
            if(text) text.innerText = 'Iniciar AnÃ¡lise Global';

            // Renderizar no mapa se encontrou reboleiras
            if (globalAnalysisResults.features.length > 0) {
                renderWeedLayer(globalAnalysisResults);
            }

            // Exibir resumo
            if(resultArea) resultArea.style.display = 'block';
            if(resultMsg) {
                const cancelText = cancelGlobalAnalysisFlag ? '<span style="color:#ff9f1c;">(Cancelado)</span>' : '';
                resultMsg.innerHTML = `
                    Processamos <strong>${successCount + failCount} de ${totalFarms} fazendas</strong>. ${cancelText}<br>
                    Sucessos: <strong>${successCount}</strong> | Falhas: <strong>${failCount}</strong><br>
                    <div style="margin-top: 8px; padding: 10px; background: rgba(255,23,68,0.1); border: 1px solid rgba(255,23,68,0.3); border-radius: 8px;">
                        Total Infestado Global: <strong style="color: #ff1744; font-size: 14px;">${totalHa.toFixed(2)} ha</strong><br>
                        Total Focos Global: <strong style="color: #ff9f1c; font-size: 14px;">${globalAnalysisResults.features.length}</strong>
                    </div>
                `;
            }

            isGlobalAnalysisRunning = false;
        };

        window.downloadGlobalGeoJSON = function() {
            if (!globalAnalysisResults || !globalAnalysisResults.features || globalAnalysisResults.features.length === 0) {
                alert('NÃ£o hÃ¡ dados de infestaÃ§Ã£o global para exportar.');
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalAnalysisResults));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `Reboleiras_Geral_${new Date().toISOString().slice(0,10)}.geojson`);
            dlAnchorElem.click();
        };

    function initCustomLayers() {
        loadCustomLayer('pontos');
        loadCustomLayer('areas');
        loadCustomLayer('rotas');
        loadCustomLayer('medicao_area');
        loadCustomLayer('medicao_distancia');
        
        const li = document.createElement('li');
        li.className = 'layer-item custom-layers-group';
        li.style.display = 'block';
        li.style.marginTop = '15px';
        li.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        li.style.paddingTop = '15px';
        
        const avenzaIcon = `<div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); display: flex; justify-content: center; align-items: center; margin-right: 12px; flex-shrink: 0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ec4b6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg></div>`;
        
        li.innerHTML = `
            <div class="layer-main-row" style="cursor: pointer;">
                ${avenzaIcon}
                <div class="layer-text-container" style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; text-align: left;">
                    <div class="layer-name" style="font-size: 14px; font-weight: bold; color: #fff; line-height: 1;">Minhas Camadas</div>
                    <div class="layer-subtitle" style="font-size: 9px; color: rgba(255, 255, 255, 0.4); margin-top: 2px;">Meus desenhos e rotas</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="submenu-arrow" style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: bold; width: 16px; text-align: center;">▼</span>
                </div>
            </div>
            <div class="layer-submenu" style="display: none; margin-top: 10px; margin-left: 35px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; padding-bottom: 5px;">
                ${createSubLayerToggle('pontos', 'Pontos Marcados', '#e71d36')}
                ${createSubLayerToggle('areas', 'Áreas Desenhadas', '#2ec4b6')}
                ${createSubLayerToggle('medicao_area', 'Medição (Área)', '#2196f3')}
                ${createSubLayerToggle('medicao_distancia', 'Medição (Distância)', '#9c27b0')}
                ${createSubLayerToggle('rotas', 'Rotas Gravadas', '#ff9f1c')}
            </div>
        `;
        
        dynamicLayerList.appendChild(li);
        
        // Render initial lists
        renderCustomFeaturesList('pontos');
        renderCustomFeaturesList('areas');
        renderCustomFeaturesList('medicao_area');
        renderCustomFeaturesList('medicao_distancia');
        renderCustomFeaturesList('rotas');
        
        const mainRow = li.querySelector('.layer-main-row');
        const submenu = li.querySelector('.layer-submenu');
        const arrow = li.querySelector('.submenu-arrow');
        
        mainRow.addEventListener('click', () => {
            if (submenu.style.display === 'none') {
                submenu.style.display = 'block';
                arrow.innerHTML = '▲';
            } else {
                submenu.style.display = 'none';
                arrow.innerHTML = '▼';
            }
        });
        
        ['pontos', 'areas', 'rotas', 'medicao_area', 'medicao_distancia'].forEach(type => {
            const cb = li.querySelector(`#toggle-custom-${type}`);
            if (cb) {
                if (cb.checked) {
                    map.addLayer(myLayers[type]);
                }
                cb.addEventListener('change', (e) => {
                    localStorage.setItem(`agrogis_custom_toggle_${type}`, e.target.checked);
                    if (e.target.checked) {
                        map.addLayer(myLayers[type]);
                    } else {
                        map.removeLayer(myLayers[type]);
                    }
                });
            }
            
            const expandBtn = li.querySelector(`#expand-custom-${type}`);
            if (expandBtn) {
                expandBtn.addEventListener('click', () => {
                    const listDiv = li.querySelector(`#list-custom-${type}`);
                    if (listDiv.style.display === 'none') {
                        listDiv.style.display = 'block';
                    } else {
                        listDiv.style.display = 'none';
                    }
                });
            }
        });
    }

    function deleteCustomFeatures(type, idsArray) {
        const key = `agrogis_custom_${type}`;
        let existing = localStorage.getItem(key);
        if (existing) {
            try { 
                let fc = JSON.parse(existing);
                fc.features = fc.features.filter(f => !idsArray.includes(f.properties.id));
                localStorage.setItem(key, JSON.stringify(fc));
                loadCustomLayer(type, fc);
                renderCustomFeaturesList(type);
                // Manter a aba aberta
                const listDiv = document.getElementById(`list-custom-${type}`);
                if (listDiv) listDiv.style.display = 'block';
            } catch(e){}
        }
    }

    function renderCustomFeaturesList(type) {
        const listDiv = document.getElementById(`list-custom-${type}`);
        if (!listDiv) return;
        
        listDiv.innerHTML = '';
        
        const key = `agrogis_custom_${type}`;
        let existing = localStorage.getItem(key);
        let fc = { features: [] };
        if (existing) {
            try { fc = JSON.parse(existing); } catch(e){}
        }
        
        if (!fc.features || fc.features.length === 0) {
            listDiv.innerHTML = '<div style="font-style: italic; opacity: 0.5;">Nenhuma feição salva.</div>';
            return;
        }
        
        // Bulk Actions - only delete buttons
        const bulkDiv = document.createElement('div');
        bulkDiv.style.marginBottom = '12px';
        bulkDiv.innerHTML = `
            <div style="display: flex; gap: 8px; width: 100%;">
                <button class="bulk-del-sel" style="flex: 1; padding: 6px; background: rgba(231, 29, 54, 0.2); border: 1px solid #e71d36; color: #fff; border-radius: 4px; cursor: pointer; font-size: 10px;">Apagar Selecionadas</button>
                <button class="bulk-del-all" style="flex: 1; padding: 6px; background: rgba(231, 29, 54, 0.2); border: 1px solid #e71d36; color: #fff; border-radius: 4px; cursor: pointer; font-size: 10px;">Apagar Todas</button>
            </div>
        `;
        listDiv.appendChild(bulkDiv);
        
        bulkDiv.querySelector('.bulk-del-sel').addEventListener('click', async () => {
            const checked = listDiv.querySelectorAll('.feature-cb:checked');
            if (checked.length === 0) return alert('Nenhum item selecionado.');
            if (!(await window.agrogisConfirm(`Deseja apagar ${checked.length} item(ns) selecionado(s)?`))) return;
            const ids = Array.from(checked).map(cb => cb.dataset.id);
            deleteCustomFeatures(type, ids);
        });
        
        bulkDiv.querySelector('.bulk-del-all').addEventListener('click', async () => {
            if (!(await window.agrogisConfirm(`Deseja apagar TODAS as feições desta categoria?`))) return;
            const ids = fc.features.map(f => f.properties.id);
            deleteCustomFeatures(type, ids);
        });
        
        fc.features.forEach(f => {
                const name = f.properties.NOME || 'Sem Nome';
                const id = f.properties.id;
                
                const itemDiv = document.createElement('div');
                itemDiv.style.display = 'flex';
                itemDiv.style.justifyContent = 'space-between';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.padding = '4px 0';
                itemDiv.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                
                let btnWapp = '';
                if (type === 'pontos') {
                    let coord = f.geometry.coordinates;
                    if (coord && coord.length === 2) {
                        const gmapsUrl = `https://maps.google.com/?q=${coord[1]},${coord[0]}`;
                        const message = encodeURIComponent(`Veja o ponto "${name}": ${gmapsUrl}`);
                        const wappUrl = `https://api.whatsapp.com/send?text=${message}`;
                        btnWapp = `<a href="${wappUrl}" style="text-decoration:none; color:#25d366; font-size:16px; margin-right:6px; display:flex; align-items:center;" title="Compartilhar no WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>
                        </a>`;
                    }
                }
                
                itemDiv.innerHTML = `
                    <label class="custom-checkbox" style="font-size: 12px; display: flex; align-items: center; margin: 0 8px 0 0; min-width: 20px;">
                        <input type="checkbox" class="feature-cb" data-id="${id}">
                        <span class="checkmark" style="--layer-color: #e71d36; width: 14px; height: 14px; min-width: 14px;"></span>
                    </label>
                    <span class="feature-name-span" style="flex-grow: 1; cursor: pointer; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; color: #a8b8b0;">${name}</span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        ${btnWapp}
                        <button class="btn-edit" style="background:none; border:none; color:#2ec4b6; cursor:pointer; font-size:14px;" title="Editar Nome">✏️</button>
                        <button class="btn-delete" style="background:none; border:none; color:#e71d36; cursor:pointer; font-size:14px;" title="Excluir">🗑️</button>
                    </div>
                `;
                
                // Pan to feature on name click
                const spanName = itemDiv.querySelector('.feature-name-span');
                spanName.addEventListener('click', () => {
                    let mapLayer;
                    myLayers[type].eachLayer(l => {
                        if (l.feature.properties.id === id) mapLayer = l;
                    });
                    if (mapLayer) {
                        if (mapLayer.getBounds) {
                            map.fitBounds(mapLayer.getBounds());
                        } else if (mapLayer.getLatLng) {
                            map.panTo(mapLayer.getLatLng());
                        }
                        mapLayer.openPopup();
                    }
                });
                
                itemDiv.querySelector('.btn-edit').addEventListener('click', () => {
                    editCustomFeatureName(type, id, name);
                });
                itemDiv.querySelector('.btn-delete').addEventListener('click', async () => {
                    if (!(await window.agrogisConfirm('Deseja realmente excluir este item?'))) return;
                    deleteCustomFeatures(type, [id]);
                });
                
                listDiv.appendChild(itemDiv);
            });
    }

    function createSubLayerToggle(id, label, color) {
        const key = `agrogis_custom_toggle_${id}`;
        const saved = localStorage.getItem(key);
        const isChecked = saved === null ? true : saved === 'true';
        const checkedAttr = isChecked ? 'checked' : '';

        return `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label class="custom-checkbox" style="font-size: 12px; display: flex; align-items: center; margin: 0; min-width: 30px;">
                        <input type="checkbox" id="toggle-custom-${id}" ${checkedAttr}>
                        <span class="checkmark" style="--layer-color: ${color}; width: 16px; height: 16px; min-width: 16px;"></span>
                    </label>
                    <div id="expand-custom-${id}" class="layer-name" style="flex-grow: 1; margin-left: 10px; color: var(--text-main); font-weight: 500; font-size: 12px; cursor: pointer;">
                        ${label}
                    </div>
                </div>
                <div id="list-custom-${id}" style="display: none; padding-left: 26px; margin-top: 8px; font-size: 11px;">
                </div>
            </div>
        `;
    }

    // â”€â”€ Remover InicializaÃ§Ã£o Antiga â”€â”€
    // Foi movida para dentro do tryInitLayers() para rodar apÃ³s carregar as fazendas.

    // Search functionality - Locate Fazenda
    const searchInput = document.getElementById('layer-search');
    const searchIcon = document.querySelector('.search-container.floating .search-icon');
    if (searchIcon && searchInput) {
        let isExpanded = false;
        
        searchIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isExpanded) {
                searchInput.blur();
                isExpanded = false;
            } else {
                searchInput.focus();
                isExpanded = true;
            }
        });

        searchInput.addEventListener('focus', () => {
            isExpanded = true;
        });

        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                isExpanded = false;
            }, 200);
        });
    }
    const autocompleteList = document.getElementById('custom-autocomplete-list');
    
    const showAutocomplete = () => {
        const val = searchInput.value;
        autocompleteList.innerHTML = '';
        
        if (!val) {
            autocompleteList.style.display = 'none';
            return;
        }
        
        let count = 0;
        const normalize = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const queryNorm = normalize(val);
        
        if (!window.allSearchableItems) return;
        
        const sortedItems = Array.from(window.allSearchableItems).sort();
        
        sortedItems.forEach(item => {
            const itemNorm = normalize(item);
            if (itemNorm.includes(queryNorm) && count < 15) {
                count++;
                const div = document.createElement('div');
                div.textContent = item; // Plain text like CAR tool
                
                div.addEventListener('click', function(e) {
                    searchInput.value = item;
                    autocompleteList.style.display = 'none';
                    handleSearch({ target: searchInput });
                });
                autocompleteList.appendChild(div);
            }
        });
        
        if (count > 0) {
            autocompleteList.style.display = 'block';
        } else {
            autocompleteList.style.display = 'none';
        }
    };

    searchInput.addEventListener('input', showAutocomplete);

    document.addEventListener('click', function(e) {
        if (e.target !== searchInput && e.target !== autocompleteList) {
            autocompleteList.style.display = 'none';
        }
    });

    searchInput.addEventListener('change', handleSearch);
    searchInput.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') {
            autocompleteList.style.display = 'none';
            handleSearch(e); 
        }
    });
    function handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        if (!query) return;

        const normalize = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const normalizedQuery = normalize(query);
        
        let foundBounds = L.latLngBounds();
        let matchCount = 0;
        let exactMatchFound = false;

        // Função para testar correspondência de nome
        const isMatch = (nomeFaz) => {
            if (!nomeFaz) return false;
            const norm = normalize(nomeFaz);
            if (norm === normalizedQuery) {
                exactMatchFound = true;
                return true;
            }
            if (!exactMatchFound && norm.includes(normalizedQuery)) {
                return true;
            }
            return false;
        };

        const checkLayer = (layer, layerName) => {
            if (layer.feature) {
                const props = layer.feature.properties || {};
                const nomeFaz = props.NOME_FAZ || props.NOME || props['DL DESCFUNDOA'];
                
                if (isMatch(nomeFaz)) {
                    if (layer.getBounds && typeof layer.getBounds === 'function') {
                        foundBounds.extend(layer.getBounds());
                        matchCount++;
                    } else if (layer.getLatLng && typeof layer.getLatLng === 'function') {
                        foundBounds.extend(layer.getLatLng());
                        matchCount++;
                    }
                }
            } else if (layer.eachLayer) {
                layer.eachLayer(child => checkLayer(child, layerName));
            }
        };

        // 1. Procurar nas Fazendas
        for (const layerName in loadedLayers) {
            if (layerName.toUpperCase().includes('FAZENDAS')) {
                const layerGroup = loadedLayers[layerName];
                if (layerGroup && layerGroup.eachLayer) {
                    layerGroup.eachLayer(child => checkLayer(child, layerName));
                }
            }
        }

        // 2. Se não encontrou nas Fazendas, procura nos Talhões
        if (matchCount === 0) {
            for (const layerName in loadedLayers) {
                if (layerName.toUpperCase().includes('TALHO')) {
                    const layerGroup = loadedLayers[layerName];
                    if (layerGroup && layerGroup.eachLayer) {
                        layerGroup.eachLayer(child => checkLayer(child, layerName));
                    }
                }
            }
        }
        
        if (matchCount > 0 && foundBounds.isValid()) {
            try {
                map.flyToBounds(foundBounds, { padding: [50, 50], duration: 1.5 });
            } catch(err) {
                console.error("Erro no zoom: ", err);
            }
            
            setTimeout(() => {
                searchInput.value = '';
                searchInput.blur();
                if(typeof isExpanded !== 'undefined') isExpanded = false;
            }, 500);
        } else {
            alert('Fazenda não encontrada nas camadas: ' + query);
        }
    }

    // Handle map selection
    window.clearAllSelections = () => {
        if (window.currentSearchedFarmLayer && window.currentSearchedFarmLayerGroup) {
            window.currentSearchedFarmLayerGroup.resetStyle(window.currentSearchedFarmLayer);
            window.currentSearchedFarmLayer = null;
            window.currentSearchedFarmLayerGroup = null;
        }
        
        if (window.selectedTalhaoLayer) {
            // Find the layer group that contains it to reset its style
            Object.values(loadedLayers).forEach(group => {
                if (group.hasLayer) {
                    const hasDirect = group.hasLayer(window.selectedTalhaoLayer);
                    const hasNested = group._realGeoJSON && group._realGeoJSON.hasLayer && group._realGeoJSON.hasLayer(window.selectedTalhaoLayer);
                    if ((hasDirect || hasNested) && group.resetStyle) {
                        group.resetStyle(window.selectedTalhaoLayer);
                    }
                }
            });
            window.selectedTalhaoLayer = null;
        }
        
        if (window.selectedHarvestLayer && window.loadedLayers) {
            const harvestLayer = window.loadedLayers['LINHAS DE COLHEITA'];
            if (harvestLayer) {
                const hasDirect = harvestLayer.hasLayer && harvestLayer.hasLayer(window.selectedHarvestLayer);
                const hasNested = harvestLayer._realGeoJSON && harvestLayer._realGeoJSON.hasLayer && harvestLayer._realGeoJSON.hasLayer(window.selectedHarvestLayer);
                if ((hasDirect || hasNested) && harvestLayer.resetStyle) {
                    harvestLayer.resetStyle(window.selectedHarvestLayer);
                }
            }
            window.selectedHarvestLayer = null;
        }
    };

    // Global Spatial Click Handler (Bypasses all Leaflet path click bugs)
    map.on('click', (e) => {
        // Ignora medição e desenho, pois eles têm seus próprios listeners complexos
        if (window.measureActive || window.drawActive) return;
        
        // Em modo rota, não limpa a seleção
        if (!window.routeSelectionMode) {
            window.clearAllSelections();
        }

        if (!window.loadedLayers) return;

        const latlng = e.latlng;
        const pt = turf.point([latlng.lng, latlng.lat]);
        let foundLayer = null;
        let foundIsTalhao = false;
        let foundIsFazenda = false;
        let foundIsLinhasColheita = false;
        let foundTitle = '';
        let foundProps = null;
        let actualLayerNameFound = '';
        
        // Vamos procurar primeiro em Linhas, depois Talhões, depois Fazendas
        const searchOrder = ['LINHAS DE COLHEITA', 'TALHOES', 'FAZENDAS', 'FAZENDA']; 
        
        for (const layerName of searchOrder) {
            if (foundLayer) break;
            
            let actualLayerName = Object.keys(window.loadedLayers).find(k => k.toUpperCase().includes(layerName));
            if (!actualLayerName) continue;
            
            const group = window.loadedLayers[actualLayerName];
            if (!group || !map.hasLayer(group)) continue; // Só procura se a camada estiver ativada e visível
            
            group.eachLayer(layer => {
                if (foundLayer) return;
                
                // Trata grupos aninhados (L.geoJSON)
                if (layer.eachLayer) {
                    layer.eachLayer(subLayer => checkLayerIntersection(subLayer, actualLayerName));
                } else {
                    checkLayerIntersection(layer, actualLayerName);
                }
            });
        }
        
        function checkLayerIntersection(layer, layerName) {
            if (foundLayer) return;
            if (!layer.feature || !layer.feature.geometry) return;
            
            // Pré-filtro ultra rápido: bounding box
            if (layer.getBounds && !layer.getBounds().contains(latlng)) return;
            
            try {
                let inside = false;
                const geomType = layer.feature.geometry.type;
                
                if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                    inside = turf.booleanPointInPolygon(pt, layer.feature);
                } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                    // Tolerância de ~5 metros para clicar na linha
                    const dist = turf.pointToLineDistance(pt, layer.feature, {units: 'meters'});
                    if (dist < 5) inside = true;
                } else if (geomType === 'Point') {
                    const dist = turf.distance(pt, layer.feature, {units: 'meters'});
                    if (dist < 50) inside = true;
                }
                
                if (inside) {
                    foundLayer = layer;
                    actualLayerNameFound = layerName;
                    foundIsTalhao = layerName.toUpperCase().includes('TALHO');
                    foundIsFazenda = layerName.toUpperCase().includes('FAZENDA');
                    foundIsLinhasColheita = layerName.toUpperCase().includes('LINHAS DE COLHEITA');
                    foundProps = layer.feature.properties || {};
                    
                    const getProp = (props, possibleNames) => {
                        const keys = Object.keys(props);
                        for (const name of possibleNames) {
                            const upperName = name.toUpperCase();
                            const foundKey = keys.find(k => k.toUpperCase() === upperName);
                            if (foundKey) return props[foundKey];
                        }
                        return '';
                    };
                    const titleRaw = getProp(foundProps, ['NOME', 'NAME', 'FAZENDA', 'NOME_FAZ', 'NOMEPROPRI', 'DESCFUNDOA', 'TALHAO', 'ID', 'LOCAL', 'DESIGNACAO']);
                    foundTitle = titleRaw || 'Elemento';
                }
            } catch (err) {}
        }
        
        if (foundLayer) {
            
            // 0. Modo seleção de rota (aproveita o título do polígono)
            if (window.routeSelectionMode) {
                const center = foundLayer.getBounds ? foundLayer.getBounds().getCenter() : latlng;
                window.setRouteWaypoint(foundTitle, center.lat, center.lng);
                // Se Leaflet já ia processar o clique nativo do mapa no listener genérico, 
                // não precisamos nos preocupar, pois ele já vai ser disparado. 
                // Mas para evitar sobreposição, podemos cancelar o modo de rota agora:
                return;
            }
            
            // 1. Linhas de Colheita
            if (foundIsLinhasColheita) {
                window.selectedHarvestLayer = foundLayer;
                foundLayer.setStyle({ color: '#ffffff', weight: 2.0, opacity: 1, fillOpacity: 0 });
                if (foundLayer.bringToFront) foundLayer.bringToFront();
                
                L.popup({ autoPanPadding: [50, 50] })
                 .setLatLng(latlng)
                 .setContent(createPopupContent(foundTitle, foundProps))
                 .openOn(map);
                return;
            }
            
            // 2. Análise de ervas daninhas (Ignora popup, abre painel)
            if (foundIsTalhao && window.openWeedAnalysisPanel && window.weedToolActive) {
                window.openWeedAnalysisPanel({ type: 'Feature', geometry: foundLayer.feature.geometry, properties: foundProps }, foundProps);
                return;
            }
            
            // 3. Clima Farm (Ignora popup, abre painel)
            if (foundIsTalhao && window.climaFarmActive && window.climaFarmFetchData) {
                window.selectedTalhaoLayer = foundLayer;
                foundLayer.setStyle({ color: '#ffeb3b', weight: 3.5, opacity: 1, fillOpacity: 0.5 });
                if (foundLayer.bringToFront) foundLayer.bringToFront();
                
                const center = foundLayer.getBounds ? foundLayer.getBounds().getCenter() : latlng;
                window.climaFarmFetchData(center.lat, center.lng, foundProps);
                return;
            }
            
            // 4. Analisador de Talhão (Ignora popup, abre painel)
            if (foundIsTalhao && window.analyzerActive && window.populateAnalyzer) {
                window.selectedTalhaoLayer = foundLayer;
                foundLayer.setStyle({ color: '#ffeb3b', weight: 3.5, opacity: 1, fillOpacity: 0.5 });
                if (foundLayer.bringToFront) foundLayer.bringToFront();
                
                window.populateAnalyzer(foundProps, foundTitle);
                return;
            }
            
            // 4. Comportamento Padrão: Seleciona e Mostra Popup
            if (foundIsTalhao) {
                window.selectedTalhaoLayer = foundLayer;
                foundLayer.setStyle({ color: '#ffeb3b', weight: 3.5, opacity: 1, fillOpacity: 0.5 });
                if (foundLayer.bringToFront) foundLayer.bringToFront();
            } else if (foundIsFazenda) {
                if (foundLayer.getBounds) map.flyToBounds(foundLayer.getBounds(), { padding: [50, 50], duration: 1.5 });
            }
            
            L.popup({ autoPanPadding: [50, 50] })
             .setLatLng(latlng)
             .setContent(createPopupContent(foundTitle, foundProps))
             .openOn(map);
             
        } else {
            // Clicou no vazio, não interceptou nenhum polígono
            if (window.routeSelectionMode) {
                const label = window.routeSelectionMode === 'origin' ? 'Origem' : 'Destino';
                window.setRouteWaypoint(`${label} (${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)})`, latlng.lat, latlng.lng);
            }
        }
    });



    // --- MEASUREMENT TOOL LOGIC ---
    let measureActive = false;
    let measureFinished = false;
    let measurePoints = [];
    let measureLines = L.polyline([], {color: '#ff9f1c', weight: 4, dashArray: '5, 10', pane: 'tooltipPane'}).addTo(map);
    let measurePolygon = L.polygon([], {color: '#ff9f1c', weight: 3, fillColor: '#ffeb3b', fillOpacity: 0.6, pane: 'tooltipPane'}).addTo(map);
    let measureMarkers = L.layerGroup().addTo(map);
    let tempLine = L.polyline([], {color: '#ff9f1c', weight: 4, dashArray: '5, 10', opacity: 0.8, pane: 'tooltipPane'}).addTo(map);
    
    const btnMeasure = document.getElementById('tool-measure-btn');
    const resultPanel = document.getElementById('measure-result');
    const distEl = document.getElementById('measure-distance');
    const areaEl = document.getElementById('measure-area');
    const btnClear = document.getElementById('tool-measure-clear');

    // Make panel draggable
    if (resultPanel) {
        // const dragHandle = document.getElementById('measure-drag-handle');
        // const draggable = new L.Draggable(resultPanel, dragHandle);
        // draggable.enable();
    }

    function resetMeasure() {
        measurePoints = [];
        measureFinished = false;
        measureLines.setLatLngs([]);
        measurePolygon.setLatLngs([]);
        measureMarkers.clearLayers();
        tempLine.setLatLngs([]);
        distEl.textContent = '0 m';
        areaEl.textContent = '0 ha';
        if (measureActive) {
            map.getContainer().style.cursor = 'crosshair';
        }
    }

    function deactivateMeasure() {
        measureActive = false;
        window.measureActive = false;
        measureFinished = false;
        btnMeasure.style.background = 'rgba(255,255,255,0.05)';
        btnMeasure.style.borderColor = 'rgba(255,255,255,0.1)';
        resultPanel.style.display = 'none';
        map.getContainer().style.cursor = '';
        document.body.classList.remove('hide-equipes', 'disable-map-hover', 'measure-active', 'ui-hidden');
        resetMeasure();
    }

    btnMeasure.addEventListener('click', () => {
        if (measureActive) {
            deactivateMeasure();
        } else {
            measureActive = true;
            window.measureActive = true;
            measureFinished = false;
            btnMeasure.style.background = 'rgba(232, 93, 4, 0.2)';
            btnMeasure.style.borderColor = '#e85d04';
            resultPanel.style.display = 'flex';
            map.getContainer().style.cursor = 'crosshair';
            document.body.classList.add('hide-equipes', 'disable-map-hover', 'measure-active', 'ui-hidden');
            resetMeasure();
            
            // Auto-close tools panel so user can see map clearly
            document.getElementById('floating-tools-panel').style.display = 'none';
        }
    });

    btnClear.addEventListener('click', resetMeasure);
    const measureClearIcon = document.getElementById('tool-measure-clear-icon');
    if (measureClearIcon) measureClearIcon.addEventListener('click', resetMeasure);
    document.getElementById('close-measure-btn').addEventListener('click', deactivateMeasure);

    const btnUndo = document.getElementById('tool-measure-undo');
    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            if (measurePoints.length > 0) {
                if (measureFinished) {
                    measureFinished = false;
                    map.getContainer().style.cursor = 'crosshair';
                }
                measurePoints.pop();
                renderMeasureMarkers();
                updateMeasureDisplay();
                if (measurePoints.length === 0) {
                    tempLine.setLatLngs([]);
                } else if (!measureFinished) {
                    // Temporarily hide temp line if we want, or it will update on next mousemove
                }
            }
        });
    }

    document.getElementById('tool-measure-add-gps').addEventListener('click', () => {
        if (!measureActive || measureFinished) return;
        // Check if gpsMarker exists globally (it's declared lower, but accessible due to var hoisting/closure if we use it, but wait, gpsMarker is declared around line 1747).
        // Let's retrieve it from the global scope or map.
        if (typeof gpsMarker !== 'undefined' && gpsMarker) {
            const latlng = gpsMarker.getLatLng();
            map.setView(latlng);
            measurePoints.push(latlng);
            renderMeasureMarkers();
            updateMeasureDisplay();
        } else {
            alert('Aguardando sinal do GPS para marcar o ponto...');
        }
    });

    document.getElementById('tool-measure-save').addEventListener('click', async () => {
        if (!measureActive || measurePoints.length < 2) {
            alert('Por favor, faÃ§a uma mediÃ§Ã£o no mapa antes de salvar.');
            return;
        }
        
        const confirmSave = await window.agrogisConfirm('Deseja salvar esta mediÃ§Ã£o nas Minhas Camadas?');
        if (!confirmSave) return;
        
        let type, feature, valueStr;
        const coords = measurePoints.map(p => [p.lng, p.lat]);
        
        if (measurePoints.length > 2) {
            // Polygon (Area)
            type = 'medicao_area';
            coords.push([measurePoints[0].lng, measurePoints[0].lat]); // close polygon
            valueStr = document.getElementById('measure-area').textContent;
            feature = {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [coords] },
                properties: {}
            };
        } else {
            // Line (Distance)
            type = 'medicao_distancia';
            valueStr = document.getElementById('measure-distance').textContent;
            feature = {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: {}
            };
        }
        
        feature.properties.NOME = valueStr;
        feature.properties.TIPO = 'MediÃ§Ã£o OCG';
        
        saveCustomFeature(type, feature);
        
        // Also enable the layer in the map if it's not checked
        const cb = document.getElementById(`toggle-custom-${type}`);
        if (cb && !cb.checked) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change'));
        }
        
        alert('MediÃ§Ã£o salva com sucesso em Minhas Camadas!');
        deactivateMeasure(); // Auto-close tool after saving
    });

    const vertexIcon = L.divIcon({
        className: 'measure-vertex-icon',
        html: '<div style="width: 12px; height: 12px; background: #ffeb3b; border: 2px solid #000; border-radius: 50%; margin-top: -6px; margin-left: -6px;"></div>',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
    });

    function renderMeasureMarkers() {
        measureMarkers.clearLayers();
        // Os pontos amarelos foram removidos conforme solicitado.
        // O usuário agora visualiza apenas a linha/polígono da medição.
    }

    function finishMeasurement() {
        measureFinished = true;
        tempLine.setLatLngs([]);
        map.getContainer().style.cursor = '';
    }

    map.on('click', (e) => {
        if (!measureActive) return;

        if (measureFinished) {
            deactivateMeasure();
            return;
        }
        
        const latlng = e.latlng;
        measurePoints.push(latlng);
        
        renderMeasureMarkers();
        updateMeasureDisplay();
    });

    map.on('contextmenu', (e) => {
        if (measureActive && !measureFinished && measurePoints.length > 0) {
            finishMeasurement();
        }
    });

    map.on('mousemove', (e) => {
        if (!measureActive || measureFinished || measurePoints.length === 0) return;
        const currentPoints = [...measurePoints, e.latlng];
        tempLine.setLatLngs(currentPoints);
    });

    // Escape to finish
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && measureActive && !measureFinished) {
            finishMeasurement();
        }
    });

    function updateMeasureDisplay() {
        if (measurePoints.length === 0) {
            distEl.textContent = '0 m';
            areaEl.textContent = '0 ha';
            return;
        }

        measureLines.setLatLngs(measurePoints);
        measureLines.bringToFront();
        
        if (measurePoints.length > 2) {
            measurePolygon.setLatLngs(measurePoints);
            measurePolygon.bringToFront();
        } else {
            measurePolygon.setLatLngs([]);
        }

        // Calculate Distance
        let distance = 0;
        if (measurePoints.length > 1) {
            for (let i = 0; i < measurePoints.length - 1; i++) {
                distance += measurePoints[i].distanceTo(measurePoints[i+1]);
            }
        }
        
        if (distance > 1000) {
            distEl.textContent = (distance / 1000).toFixed(2) + ' km';
        } else {
            distEl.textContent = distance.toFixed(0) + ' m';
        }

        // Calculate Area using Turf.js
        if (measurePoints.length > 2) {
            const coords = measurePoints.map(p => [p.lng, p.lat]);
            // close the polygon
            coords.push([measurePoints[0].lng, measurePoints[0].lat]);
            
            try {
                if (typeof turf !== 'undefined') {
                    const polygon = turf.polygon([coords]);
                    const areaSqMeters = turf.area(polygon);
                    const areaHectares = areaSqMeters / 10000;
                    areaEl.textContent = areaHectares.toFixed(2) + ' ha';
                }
            } catch (err) {
                areaEl.textContent = 'Erro';
            }
        } else {
            areaEl.textContent = '0 ha';
        }
    }

    // --- GPS REAL-TIME TRACKING LOGIC ---
    let gpsActive = true;
    let gpsMarker = null;
    let gpsCircle = null;
    let hasCenteredInitialGps = false;

    // Start tracking by default without forcing continuous centering
    map.locate({setView: false, watch: true, enableHighAccuracy: true});

    map.on('locationfound', (e) => {
        if (!gpsActive) return;
        const radius = e.accuracy / 2;

        if (!gpsMarker) {
            // Pulsating GPS marker
            gpsMarker = L.circleMarker(e.latlng, {
                pane: 'markerPane',
                radius: 8,
                fillColor: '#2196F3',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8,
                className: 'pulse-marker' // Custom CSS class for pulse if defined
            }).addTo(map);
            
            gpsCircle = L.circle(e.latlng, radius, {
                pane: 'markerPane',
                color: '#2196F3',
                fillColor: '#2196F3',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(map);
        } else {
            gpsMarker.setLatLng(e.latlng);
            gpsCircle.setLatLng(e.latlng);
            gpsCircle.setRadius(radius);
        }
        
        // Export to window for the locate control to easily access
        window._agrogis_gpsMarker = gpsMarker;
        
        // Optionally center map on user continuously
        // map.setView(e.latlng);
    });

    map.on('locationerror', (e) => {
        if (gpsActive) {
            console.warn('NÃ£o foi possÃ­vel acessar a localizaÃ§Ã£o do dispositivo: ' + e.message);
        }
    });

    // --- ROUTE TOOL LOGIC ---
    const btnRoute = document.getElementById('tool-route-btn');
    const routePanel = document.getElementById('route-panel');
    const btnRouteOrigin = document.getElementById('route-btn-origin');
    const btnRouteDest = document.getElementById('route-btn-dest');
    let routingControl = null;
    let rotasNdbLayer = null;

    window.routeSelectionMode = null;
    let routeOriginData = null;
    let routeDestData = null;

    function setRouteSelectionMode(mode) {
        window.routeSelectionMode = mode;
        const inputOrig = document.getElementById('route-search-origin');
        if(inputOrig) inputOrig.style.borderColor = mode === 'origin' ? '#e85d04' : 'rgba(255,255,255,0.2)';
        
        const inputDest = document.getElementById('route-search-dest');
        if(inputDest) inputDest.style.borderColor = mode === 'dest' ? '#e85d04' : 'rgba(255,255,255,0.2)';
        
        if (mode) {
            map.getContainer().style.cursor = 'crosshair';
        } else {
            map.getContainer().style.cursor = '';
        }
    }

    const btnRouteMyLoc = document.getElementById('route-btn-myloc');
    if (btnRouteMyLoc) {
        btnRouteMyLoc.addEventListener('click', () => {
            if (window._agrogis_gpsMarker) {
                const latlng = window._agrogis_gpsMarker.getLatLng();
                // Set origin mode to properly update state and text
                window.routeSelectionMode = 'origin';
                window.setRouteWaypoint('Minha Localização', latlng.lat, latlng.lng);
            } else {
                alert('Aguarde o GPS encontrar sua localização primeiro.');
            }
        });
    }

    window.setRouteWaypoint = function(title, lat, lng) {
        if (window.routeSelectionMode === 'origin') {
            routeOriginData = {lat, lng};
            const inputOrig = document.getElementById('route-search-origin');
            if (inputOrig) inputOrig.value = title;
            // Switch to waiting for destination automatically
            setRouteSelectionMode('dest');
        } else if (window.routeSelectionMode === 'dest') {
            routeDestData = {lat, lng};
            const inputDest = document.getElementById('route-search-dest');
            if (inputDest) inputDest.value = title;
            // Finish selection and auto calculate
            setRouteSelectionMode(null);
            calculateRoute();
        }
    };

    function handleRouteSearch(e, mode) {
        const query = e.target.value.toLowerCase().trim();
        if (!query) return;

        const normalize = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const queryNorm = normalize(query);

        // First: search the centroid cache built from FlatGeobuf talhões
        if (window.allRouteItems && window.allRouteItems.length > 0) {
            for (const item of window.allRouteItems) {
                if (normalize(item.title).includes(queryNorm)) {
                    window.routeSelectionMode = mode;
                    window.setRouteWaypoint(item.title, item.lat, item.lng);
                    return;
                }
            }
        }

        // Fallback: iterate any non-FGB loaded layers (Fazendas etc)
        for (const layerName in loadedLayers) {
            if (!layerName.toUpperCase().includes('FAZENDA') && !layerName.toUpperCase().includes('TALHOES')) continue;
            
            const layerGroup = loadedLayers[layerName];
            // Support both direct layers and FGB-backed layers
            const realGroup = (layerGroup._realGeoJSON) ? layerGroup._realGeoJSON : layerGroup;
            if (!realGroup || typeof realGroup.eachLayer !== 'function') continue;

            realGroup.eachLayer(layer => {
                if (!layer.feature) return;
                const props = layer.feature.properties || {};
                const rawName = props.NOME_FAZ || props['DL DESCFUNDOA'];
                const rawId = props.FAZENDA || props.DL_FUNDOAGRIC || props['DL FUNDOAGRIC'];
                let title = '';
                if (rawName) {
                    const cleanIdStr = String(rawId || '').split(',')[0].split('.')[0].trim();
                    title = cleanIdStr ? `${cleanIdStr} - ${rawName}` : rawName;
                }
                if (!title) {
                    title = props.nome || props.NOME || props.NAME || props.Name || props.talhao || props.TALHAO || props.id || props.designacao || '';
                }
                
                if (normalize(title).includes(queryNorm)) {
                    let lat, lng;
                    try {
                        if (typeof turf !== 'undefined') {
                            const centroid = turf.centroid(layer.feature);
                            lat = centroid.geometry.coordinates[1];
                            lng = centroid.geometry.coordinates[0];
                        } else {
                            const center = layer.getBounds().getCenter();
                            lat = center.lat;
                            lng = center.lng;
                        }
                        window.routeSelectionMode = mode;
                        window.setRouteWaypoint(title, lat, lng);
                    } catch(err) { console.warn('Route search center error', err); }
                }
            });
        }
    }

    function setupRouteAutocomplete(inputId, listId, mode) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        if (!input || !list) return;
        
        input.addEventListener('input', () => {
            const val = input.value;
            list.innerHTML = '';
            if (!val) {
                list.style.display = 'none';
                return;
            }
            
            let count = 0;
            const normalize = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const queryNorm = normalize(val);
            
            if (!window.allSearchableItems) return;
            const sortedItems = Array.from(window.allSearchableItems).sort();
            
            sortedItems.forEach(item => {
                if (normalize(item).includes(queryNorm) && count < 15) {
                    count++;
                    const div = document.createElement('div');
                    div.textContent = item;
                    div.addEventListener('click', function(e) {
                        input.value = item;
                        list.style.display = 'none';
                        handleRouteSearch({ target: input }, mode);
                    });
                    list.appendChild(div);
                }
            });
            list.style.display = count > 0 ? 'block' : 'none';
        });
        
        document.addEventListener('click', function(e) {
            if (e.target !== input && e.target !== list) {
                list.style.display = 'none';
            }
        });
    }

    setupRouteAutocomplete('route-search-origin', 'route-autocomplete-orig', 'origin');
    setupRouteAutocomplete('route-search-dest', 'route-autocomplete-dest', 'dest');

    // General map click for route waypoint has been merged into the global spatial click handler.

    if (routePanel) {
        // const routeDragHandle = document.getElementById('route-drag-handle');
        // const draggableRoute = new L.Draggable(routePanel, routeDragHandle);
        // draggableRoute.enable();
    }

    function deactivateRoute() {
        if (routePanel) routePanel.style.display = 'none';
        btnRoute.style.background = 'rgba(255,255,255,0.05)';
        btnRoute.style.borderColor = 'rgba(255,255,255,0.1)';
        setRouteSelectionMode(null);
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
        if (rotasNdbLayer) {
            map.removeLayer(rotasNdbLayer);
            rotasNdbLayer = null;
        }
        const routeInfo = document.getElementById('route-info');
        if (routeInfo) routeInfo.style.display = 'none';
        map.getContainer().classList.remove('route-active');
        document.body.classList.remove('hide-equipes', 'ui-hidden');
        if (typeof window.toggleCompass === 'function') {
            window.toggleCompass(false);
        }
    }

    btnRoute.addEventListener('click', () => {
        if (routePanel.style.display === 'flex' || routePanel.style.display === 'block') {
            deactivateRoute();
        } else {
            if (typeof deactivateMeasure === 'function') deactivateMeasure();
            
            routePanel.style.display = 'flex';
            btnRoute.style.background = 'rgba(232, 93, 4, 0.2)';
            btnRoute.style.borderColor = '#e85d04';
            map.getContainer().classList.add('route-active');
            document.body.classList.add('hide-equipes', 'ui-hidden');
            
            document.getElementById('floating-tools-panel').style.display = 'none';
            
            // Auto-start origin selection mode
            routeOriginData = null;
            routeDestData = null;
            const routeInfo = document.getElementById('route-info');
            if (routeInfo) routeInfo.style.display = 'none';
            setRouteSelectionMode('origin');
            
            // Origin selection active (compass will auto-enable on dest selection)
        }
    });

    document.getElementById('close-route-btn').addEventListener('click', deactivateRoute);
    
    function resetRoute() {
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
        if (rotasNdbLayer) {
            map.removeLayer(rotasNdbLayer);
            rotasNdbLayer = null;
        }
        const routeInfo = document.getElementById('route-info');
        if (routeInfo) routeInfo.style.display = 'none';
        
        routeOriginData = null;
        routeDestData = null;
        
        const origInput = document.getElementById('route-search-origin');
        if (origInput) origInput.value = '';
        
        const destInput = document.getElementById('route-search-dest');
        if (destInput) destInput.value = '';
        
        setRouteSelectionMode('origin');
        
        if (typeof window.toggleCompass === 'function') {
            window.toggleCompass(false);
        }
    }
    
    const routeClearIcon = document.getElementById('tool-route-clear-icon');
    if (routeClearIcon) routeClearIcon.addEventListener('click', resetRoute);
    
    // (Route map click to close removed per user request)





    async function calculateRoute() {
        if (!routeOriginData || !routeDestData) {
            alert('Por favor, selecione origem e destino clicando no mapa.');
            return;
        }
        
        const routeInfo = document.getElementById('route-info');
        const distText = document.getElementById('route-distance-text');
        if (routeInfo) {
            routeInfo.style.display = 'flex';
            if (distText) distText.textContent = 'Calculando...';
        }

        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
        
        // Check if L.Routing is available (Leaflet Routing Machine)
        if (typeof L.Routing === 'undefined') {
            alert('Erro: Sistema de rotas n\u00E3o est\u00E1 carregado.');
            return;
        }

        if (!navigator.onLine) {
            alert('A geração de rotas requer conexão com a internet.');
            if (routeInfo) routeInfo.style.display = 'none';
            if (routingControl) {
                map.removeControl(routingControl);
                routingControl = null;
            }
            if (rotasNdbLayer) {
                map.removeLayer(rotasNdbLayer);
                rotasNdbLayer = null;
            }
            return;
        }

        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(routeOriginData.lat, routeOriginData.lng),
                L.latLng(routeDestData.lat, routeDestData.lng)
            ],
            router: L.Routing.osrmv1({
                timeout: 5000,
                profile: 'driving'
            }),
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: false,
            language: 'pt-BR',
            show: false,
            showAlternatives: false,
            altLineOptions: { styles: [{opacity: 0, weight: 0}] },
            lineOptions: {
                addWaypoints: false,
                styles: [{opacity: 0, weight: 0}], // Hide default line because we draw it manually
                missingRouteStyles: [{opacity: 0, weight: 0}]
            }
        }).addTo(map);

        routingControl.on('routingerror', function(e) {
            alert('Falha ao calcular rota. Verifique sua conexão com a internet.');
            if (routeInfo) routeInfo.style.display = 'none';
            if (routingControl) {
                map.removeControl(routingControl);
                routingControl = null;
            }
            if (rotasNdbLayer) {
                map.removeLayer(rotasNdbLayer);
                rotasNdbLayer = null;
            }
        });

        routingControl.on('routesfound', function(e) {
            map.getContainer().classList.add('route-active');
            const routes = e.routes;
            const summary = routes[0].summary;
            if (distText) {
                if (summary.totalDistance > 1000) {
                    distText.textContent = (summary.totalDistance / 1000).toFixed(2) + ' km';
                } else {
                    distText.textContent = Math.round(summary.totalDistance) + ' m';
                }
            }
            
            // Draw our own route line in tooltipPane to ensure it's ABOVE the talhões layer
            if (rotasNdbLayer) map.removeLayer(rotasNdbLayer);
            const coords = routes[0].coordinates;
            rotasNdbLayer = L.polyline(coords, {
                color: '#e85d04', weight: 7, opacity: 0.95, pane: 'tooltipPane'
            }).addTo(map);
            
            // Hide the default routing control line (it's in overlayPane, below talhões)
            try {
                routingControl.getRouter && routingControl.getPlan && 
                map.eachLayer(function(l) {
                    if (l._routing_line || (l.options && l.options.className === 'leaflet-routing-line')) {
                        l.setStyle({opacity: 0, weight: 0});
                    }
                });
            } catch(ex) { /* ignore */ }
            
            // Fit map to route
            map.fitBounds(rotasNdbLayer.getBounds(), { padding: [50, 50] });
            
            if (typeof window.toggleCompass === 'function') {
                window.toggleCompass(true);
            }
        });

    }

    // GPS is auto-activated above now

    let isPopupActive = false;
    map.on('popupopen', () => { isPopupActive = true; });
    map.on('popupclose', () => { 
        setTimeout(() => { isPopupActive = false; }, 100); 
    });

    // --- DRAWING TOOL LOGIC ---
    let drawActive = false;
    let drawMode = null; // 'point' | 'area'
    let currentPolygonPoints = [];
    let currentPolygonLine = L.polyline([], {color: '#2ec4b6', weight: 3, dashArray: '5, 10'}).addTo(map);
    let currentPolygonFill = L.polygon([], {color: '#2ec4b6', weight: 2, fillColor: '#2ec4b6', fillOpacity: 0.2}).addTo(map);
    let drawMarkers = L.layerGroup().addTo(map);
    let tempDrawLine = L.polyline([], {color: '#2ec4b6', weight: 3, dashArray: '5, 10', opacity: 0.5}).addTo(map);

    const btnDraw = document.getElementById('tool-draw-btn');
    const drawPanel = document.getElementById('draw-panel');
    const btnDrawPoint = document.getElementById('draw-mode-point');
    const btnDrawArea = document.getElementById('draw-mode-area');
    const btnFinishArea = document.getElementById('draw-finish-area');
    const drawStatus = document.getElementById('draw-status');

    if (drawPanel) {
        // new L.Draggable(drawPanel, document.getElementById('draw-drag-handle')).enable();
    }

    function resetDraw() {
        drawActive = false;
        window.drawActive = false;
        drawMode = null;
        currentPolygonPoints = [];
        currentPolygonLine.setLatLngs([]);
        currentPolygonFill.setLatLngs([]);
        tempDrawLine.setLatLngs([]);
        drawMarkers.clearLayers();
        btnDraw.style.background = 'rgba(255,255,255,0.05)';
        btnDraw.style.borderColor = 'rgba(255,255,255,0.1)';
        drawPanel.style.display = 'none';
        btnFinishArea.style.display = 'none';
        drawStatus.style.display = 'none';
        map.getContainer().style.cursor = '';
        btnDrawPoint.style.boxShadow = 'none';
        btnDrawArea.style.boxShadow = 'none';
        document.body.classList.remove('ui-hidden');
        
        const btnShareLoc = document.getElementById('tool-share-loc-btn');
        if (btnShareLoc) {
            btnShareLoc.style.background = 'rgba(255,255,255,0.05)';
            btnShareLoc.style.borderColor = 'rgba(255,255,255,0.1)';
        }
    }

    btnDraw.addEventListener('click', () => {
        if (drawActive) {
            resetDraw();
        } else {
            resetDraw(); // clear state
            drawActive = true;
            window.drawActive = true;
            btnDraw.style.background = 'rgba(46, 196, 182, 0.2)';
            btnDraw.style.borderColor = '#2ec4b6';
            drawPanel.style.display = 'flex';
            document.getElementById('floating-tools-panel').style.display = 'none';
            document.body.classList.add('ui-hidden');
        }
    });

    document.getElementById('close-draw-btn').addEventListener('click', resetDraw);

    btnDrawPoint.addEventListener('click', () => {
        drawMode = 'point';
        btnDrawPoint.style.boxShadow = '0 0 10px #e71d36';
        btnDrawArea.style.boxShadow = 'none';
        drawStatus.textContent = 'Clique no mapa para marcar o ponto';
        drawStatus.style.display = 'block';
        btnFinishArea.style.display = 'none';
        map.getContainer().style.cursor = 'crosshair';
        currentPolygonPoints = [];
        currentPolygonLine.setLatLngs([]);
        currentPolygonFill.setLatLngs([]);
        tempDrawLine.setLatLngs([]);
        drawMarkers.clearLayers();
    });

    btnDrawArea.addEventListener('click', () => {
        drawMode = 'area';
        btnDrawArea.style.boxShadow = '0 0 10px #2ec4b6';
        btnDrawPoint.style.boxShadow = 'none';
        drawStatus.textContent = 'Clique no mapa para marcar os vÃ©rtices (mÃ­n. 3)';
        drawStatus.style.display = 'block';
        btnFinishArea.style.display = 'block';
        map.getContainer().style.cursor = 'crosshair';
        currentPolygonPoints = [];
        currentPolygonLine.setLatLngs([]);
        currentPolygonFill.setLatLngs([]);
        tempDrawLine.setLatLngs([]);
        drawMarkers.clearLayers();
    });

    const btnShareLoc = document.getElementById('tool-share-loc-btn');
    if (btnShareLoc) {
        btnShareLoc.addEventListener('click', () => {
            if (drawActive && drawMode === 'share-loc') {
                resetDraw();
            } else {
                resetDraw();
                drawActive = true;
                window.drawActive = true;
                drawMode = 'share-loc';
                btnShareLoc.style.background = 'rgba(37, 211, 102, 0.2)';
                btnShareLoc.style.borderColor = '#25d366';
                map.getContainer().style.cursor = 'crosshair';
                document.getElementById('floating-tools-panel').style.display = 'none';
            }
        });
    }

    map.on('click', (e) => {
        if (!drawActive || !drawMode) return;

        if (drawMode === 'point') {
            // Save Point Mode
            const latlng = e.latlng;
            openNameModal('PontoMarcado', async (name) => {
                if (name) {
                    const feature = {
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [latlng.lng, latlng.lat] },
                        properties: { NOME: name, TIPO: 'Ponto' }
                    };
                    saveCustomFeature('pontos', feature);
                    
                    // Offer to share immediately
                    if (await window.agrogisConfirm(`Ponto "${name}" salvo com sucesso!\n\nDeseja compartilhar a localizaÃ§Ã£o agora pelo WhatsApp?`)) {
                        const gmapsUrl = `https://maps.google.com/?q=${latlng.lat},${latlng.lng}`;
                        const message = encodeURIComponent(`Veja o ponto "${name}": ${gmapsUrl}`);
                        window.location.href = `https://api.whatsapp.com/send?text=${message}`;
                    }
                }
                resetDraw();
            });
        } else if (drawMode === 'share-loc') {
            const latlng = e.latlng;
            const tempMarker = L.circleMarker(latlng, {
                radius: 8,
                fillColor: '#25d366',
                color: '#fff',
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            setTimeout(() => {
                Swal.fire({
                    title: 'Compartilhar localizaÃ§Ã£o?',
                    text: 'Deseja compartilhar esta localizaÃ§Ã£o no WhatsApp?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#25d366',
                    cancelButtonColor: '#444c56',
                    confirmButtonText: 'Sim',
                    cancelButtonText: 'Cancelar',
                    background: '#1a1d21',
                    color: '#fff'
                }).then((result) => {
                    if (result.isConfirmed) {
                        const gmapsUrl = `https://maps.google.com/?q=${latlng.lat},${latlng.lng}`;
                        const message = encodeURIComponent(`Veja esta localizaÃ§Ã£o: ${gmapsUrl}`);
                        window.location.href = `https://api.whatsapp.com/send?text=${message}`;
                    }
                    map.removeLayer(tempMarker);
                    resetDraw();
                });
            }, 100);
        } else if (drawMode === 'area') {
            const latlng = e.latlng;
            currentPolygonPoints.push(latlng);
            
            L.circleMarker(latlng, { radius: 5, fillColor: '#2ec4b6', color: '#000', weight: 1, fillOpacity: 1 }).addTo(drawMarkers);
            
            currentPolygonLine.setLatLngs(currentPolygonPoints);
            if (currentPolygonPoints.length > 2) {
                currentPolygonFill.setLatLngs(currentPolygonPoints);
            }
        }
    });

    map.on('mousemove', (e) => {
        if (!drawActive || drawMode !== 'area' || currentPolygonPoints.length === 0) return;
        tempDrawLine.setLatLngs([...currentPolygonPoints, e.latlng]);
    });

    btnFinishArea.addEventListener('click', () => {
        if (currentPolygonPoints.length < 3) {
            alert('Um polÃ­gono precisa de no mÃ­nimo 3 pontos!');
            return;
        }
        
        // Add the first point to close the polygon for Turf
        const coords = currentPolygonPoints.map(p => [p.lng, p.lat]);
        coords.push([currentPolygonPoints[0].lng, currentPolygonPoints[0].lat]);
        
        const polygon = turf.polygon([coords]);
        const areaM2 = turf.area(polygon);
        const areaHa = (areaM2 / 10000).toFixed(2);
        
        openNameModal('AreaDesenhada', (name) => {
            if (name) {
                const feature = {
                    type: 'Feature',
                    geometry: { type: 'Polygon', coordinates: [coords] },
                    properties: { NOME: name, AREA_HA: areaHa, TIPO: 'Area' }
                };
                saveCustomFeature('areas', feature);
                alert(`Ãrea "${name}" (${areaHa} ha) salva!`);
            }
            resetDraw();
        });
    });

    // --- RECORDING TOOL LOGIC ---
    const btnRecord = document.getElementById('tool-record-btn');
    const recordPanel = document.getElementById('record-panel');
    const btnStartRecord = document.getElementById('record-start-btn');
    const btnSaveRecord = document.getElementById('record-save-btn');
    const indicator = document.getElementById('record-indicator');
    const distRecordEl = document.getElementById('record-distance');
    const timeRecordEl = document.getElementById('record-time');

    if (recordPanel) {
        // new L.Draggable(recordPanel, document.getElementById('record-drag-handle')).enable();
    }

    let recordActive = false;
    let isRecording = false;
    let watchId = null;
    let recordPoints = [];
    let recordLine = L.polyline([], {color: '#e85d04', weight: 4}).addTo(map);
    let recordStartTime = null;
    let recordTimerInterval = null;

    function resetRecordUI() {
        recordActive = false;
        isRecording = false;
        if (watchId) navigator.geolocation.clearWatch(watchId);
        clearInterval(recordTimerInterval);
        
        btnRecord.style.background = 'rgba(255,255,255,0.05)';
        btnRecord.style.borderColor = 'rgba(255,255,255,0.1)';
        recordPanel.style.display = 'none';
        
        btnStartRecord.textContent = 'INICIAR';
        btnStartRecord.style.background = 'rgba(231, 29, 54, 0.2)';
        btnSaveRecord.disabled = true;
        btnSaveRecord.style.cursor = 'not-allowed';
        indicator.style.opacity = '0.3';
        
        distRecordEl.textContent = '0.00 km';
        timeRecordEl.textContent = '00:00';
        
        recordPoints = [];
        recordLine.setLatLngs([]);
        document.body.classList.remove('ui-hidden');
    }

    btnRecord.addEventListener('click', () => {
        if (recordActive) {
            resetRecordUI();
        } else {
            resetRecordUI();
            recordActive = true;
            btnRecord.style.background = 'rgba(231, 29, 54, 0.2)';
            btnRecord.style.borderColor = '#e71d36';
            recordPanel.style.display = 'flex';
            document.getElementById('floating-tools-panel').style.display = 'none';
            document.body.classList.add('ui-hidden');
        }
    });

    document.getElementById('close-record-btn').addEventListener('click', resetRecordUI);

    btnStartRecord.addEventListener('click', () => {
        if (!isRecording) {
            // Start recording
            if (!navigator.geolocation) {
                alert("Seu navegador/dispositivo nÃ£o suporta gravaÃ§Ã£o de GPS.");
                return;
            }
            
            isRecording = true;
            btnStartRecord.textContent = 'PAUSAR';
            btnStartRecord.style.background = 'rgba(255, 159, 28, 0.2)'; // Orange
            btnSaveRecord.disabled = false;
            btnSaveRecord.style.cursor = 'pointer';
            
            recordStartTime = Date.now() - (recordPoints.length > 0 ? getElapsedTime() : 0);
            
            if (!recordTimerInterval) {
                recordTimerInterval = setInterval(() => {
                    const diff = Math.floor((Date.now() - recordStartTime) / 1000);
                    const m = Math.floor(diff / 60).toString().padStart(2, '0');
                    const s = (diff % 60).toString().padStart(2, '0');
                    timeRecordEl.textContent = `${m}:${s}`;
                    // Pulse indicator
                    indicator.style.opacity = indicator.style.opacity === '1' ? '0.3' : '1';
                }, 1000);
            }
            
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
                    recordPoints.push(latlng);
                    recordLine.setLatLngs(recordPoints);
                    map.panTo(latlng);
                    
                    // Calc distance
                    if (recordPoints.length > 1) {
                        let d = 0;
                        for (let i = 0; i < recordPoints.length - 1; i++) {
                            d += recordPoints[i].distanceTo(recordPoints[i+1]);
                        }
                        distRecordEl.textContent = (d / 1000).toFixed(2) + ' km';
                    }
                },
                (err) => console.warn(err),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
        } else {
            // Pause recording
            isRecording = false;
            btnStartRecord.textContent = 'RETOMAR';
            btnStartRecord.style.background = 'rgba(46, 196, 182, 0.2)';
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            clearInterval(recordTimerInterval);
            recordTimerInterval = null;
            indicator.style.opacity = '1';
        }
    });
    
    function getElapsedTime() {
        if (!timeRecordEl.textContent) return 0;
        const pts = timeRecordEl.textContent.split(':');
        if (pts.length === 2) {
            return (parseInt(pts[0])*60 + parseInt(pts[1])) * 1000;
        }
        return 0;
    }

    btnSaveRecord.addEventListener('click', () => {
        if (recordPoints.length < 2) {
            alert('A rota Ã© muito curta para ser salva.');
            return;
        }
        // Pause first
        if (isRecording) btnStartRecord.click();
        
        let distanceM = 0;
        for (let i = 0; i < recordPoints.length - 1; i++) {
            distanceM += recordPoints[i].distanceTo(recordPoints[i+1]);
        }
        
        openNameModal('Rota_Gravada', (name) => {
            if (name) {
                const coords = recordPoints.map(p => [p.lng, p.lat]);
                const feature = {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: coords },
                    properties: { NOME: name, DISTANCIA_M: Math.round(distanceM), TEMPO: timeRecordEl.textContent, TIPO: 'Rota' }
                };
                saveCustomFeature('rotas', feature);
                alert(`Rota "${name}" salva com sucesso!`);
            }
            resetRecordUI();
        });
    });

    // --- MODAL UTILS ---
    let pendingModalCallback = null;
    const nameModal = document.getElementById('custom-name-modal');
    const nameInput = document.getElementById('custom-name-input');
    
    function openNameModal(defaultName, callback) {
        pendingModalCallback = callback;
        nameInput.value = defaultName;
        nameModal.style.display = 'flex';
        nameInput.focus();
        nameInput.select();
    }
    
    document.getElementById('custom-name-cancel').addEventListener('click', () => {
        nameModal.style.display = 'none';
        if (pendingModalCallback) pendingModalCallback(null);
    });
    
    document.getElementById('custom-name-confirm').addEventListener('click', () => {
        const val = nameInput.value.trim();
        nameModal.style.display = 'none';
        if (pendingModalCallback) pendingModalCallback(val || 'Sem Nome');
    });

});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MÃ“DULO DE DETECÃ‡ÃƒO DE ERVAS DANINHAS â€” Satellite Weed Detection
//  IntegraÃ§Ã£o com FastAPI backend via Microsoft Planetary Computer
//  v2.0 â€” AnÃ¡lise por Fazenda + Pesquisa + BotÃ£o na Aba Ferramentas
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(function() {
    const API_URL = 'http://localhost:8000';

    // Estado
    let selectedFazendaFeatures = [];  // Todos os talhÃµes da fazenda selecionada
    let selectedFazendaName = '';
    let weedResultGeoJSON = null;
    let weedSearchResultGeoJSON = null;
    let weedLayer = null;
    let apiOnline = false;
    let weedToolActive = false;        // Ferramenta ativa via botÃ£o Ferramentas

    // Elementos DOM â€” Painel principal
    const panel        = document.getElementById('weed-analysis-panel');
    const btnClose     = document.getElementById('weed-panel-close');
    const btnAnalyze   = document.getElementById('btn-weed-analyze');
    const talhaoName   = document.getElementById('weed-talhao-name');
    const talhaoInfo   = document.getElementById('weed-talhao-info');
    const fazendaBadge = document.getElementById('weed-fazenda-badge');
    const fazCountEl   = document.getElementById('weed-fazenda-talhoes-count');
    const statusArea   = document.getElementById('weed-status-area');
    const resultArea   = document.getElementById('weed-result-area');
    const resultMsg    = document.getElementById('weed-result-msg');
    const resultStats  = document.getElementById('weed-result-stats');
    const exportBtns   = document.getElementById('weed-export-btns');
    const apiOffline   = document.getElementById('weed-api-offline');
    const statHa       = document.getElementById('weed-stat-ha');
    const statCount    = document.getElementById('weed-stat-count');
    const statDate     = document.getElementById('weed-stat-date');
    const statCloud    = document.getElementById('weed-stat-cloud');
    const btnGeoJSON   = document.getElementById('btn-export-geojson');
    const btnKML       = document.getElementById('btn-export-kml');
    const btnClear     = document.getElementById('btn-clear-weed');
    const toolDot      = document.getElementById('weed-tool-status-dot');
    const toolWeedBtn  = document.getElementById('tool-weed-btn');

    // Elementos DOM â€” Aba Pesquisa
    const weedSearchInput      = document.getElementById('weed-search-input');
    const searchDatalist   = document.getElementById('weed-fazendas-datalist');
    const btnSearchAnalyze = document.getElementById('btn-weed-search-analyze');
    const searchResultArea = document.getElementById('weed-search-result-area');
    const searchResultMsg  = document.getElementById('weed-search-result-msg');
    const searchResultStats= document.getElementById('weed-search-result-stats');
    const searchStatHa     = document.getElementById('weed-search-stat-ha');
    const searchStatCount  = document.getElementById('weed-search-stat-count');
    const btnSearchGeoJSON = document.getElementById('btn-export-search-geojson');
    const btnSearchKML     = document.getElementById('btn-export-search-kml');
    const searchApiOffline = document.getElementById('weed-search-api-offline');
    const btnSearchClear   = document.getElementById('btn-weed-search-clear');

    // â”€â”€ Tab Switcher (acessÃ­vel globalmente para o onclick no HTML) â”€â”€
    window.weedSwitchTab = function(tab) {
        const mapContent    = document.getElementById('weed-tab-content-map');
        const searchContent = document.getElementById('weed-tab-content-search');
        const generalContent = document.getElementById('weed-tab-content-general');
        
        const tabMap        = document.getElementById('weed-tab-map');
        const tabSearch     = document.getElementById('weed-tab-search');
        const tabGeneral    = document.getElementById('weed-tab-general');
        
        // Reset all contents
        if (mapContent) mapContent.style.display = 'none';
        if (searchContent) searchContent.style.display = 'none';
        if (generalContent) generalContent.style.display = 'none';
        
        // Reset all tabs
        const inactiveBg = 'none';
        const inactiveColor = 'rgba(255,255,255,0.4)';
        const inactiveBorder = 'transparent';
        
        const activeBg = 'rgba(255,0,0,0.12)';
        const activeColor = '#ff6666';
        const activeBorder = '#ff1744';

        if (tabMap) { tabMap.style.background = inactiveBg; tabMap.style.color = inactiveColor; tabMap.style.borderBottomColor = inactiveBorder; }
        if (tabSearch) { tabSearch.style.background = inactiveBg; tabSearch.style.color = inactiveColor; tabSearch.style.borderBottomColor = inactiveBorder; }
        if (tabGeneral) { tabGeneral.style.background = inactiveBg; tabGeneral.style.color = inactiveColor; tabGeneral.style.borderBottomColor = inactiveBorder; }

        if (tab === 'map') {
            if (mapContent) mapContent.style.display = 'block';
            if (tabMap) { tabMap.style.background = activeBg; tabMap.style.color = activeColor; tabMap.style.borderBottomColor = activeBorder; }
        } else if (tab === 'search') {
            if (searchContent) searchContent.style.display = 'block';
            if (tabSearch) { tabSearch.style.background = activeBg; tabSearch.style.color = activeColor; tabSearch.style.borderBottomColor = activeBorder; }
            populateFazendaSearch();
        } else if (tab === 'general') {
            if (generalContent) generalContent.style.display = 'block';
            if (tabGeneral) { tabGeneral.style.background = activeBg; tabGeneral.style.color = activeColor; tabGeneral.style.borderBottomColor = activeBorder; }
        }
    };

    // â”€â”€ SaÃºde da API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function checkApiHealth() {
        fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) })
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(() => {
                apiOnline = true;
                if (toolDot) { toolDot.style.background = '#2ec4b6'; toolDot.title = 'Servidor online'; }
                if (apiOffline) apiOffline.style.display = 'none';
                if (searchApiOffline) searchApiOffline.style.display = 'none';
                updateAnalyzeButton();
            })
            .catch(() => {
                apiOnline = false;
                if (toolDot) { toolDot.style.background = '#e71d36'; toolDot.title = 'Servidor offline'; }
                if (panel && panel.style.display !== 'none') {
                    if (apiOffline) apiOffline.style.display = 'block';
                    if (searchApiOffline) searchApiOffline.style.display = 'block';
                }
                updateAnalyzeButton();
            });
    }
    setInterval(checkApiHealth, 10000);
    checkApiHealth();

    // â”€â”€ BotÃ£o na aba Ferramentas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (toolWeedBtn) {
        toolWeedBtn.addEventListener('click', () => {
            weedToolActive = !weedToolActive;
            window.weedToolActive = weedToolActive;
            if (weedToolActive) {
                toolWeedBtn.style.background = 'rgba(255,0,0,0.2)';
                toolWeedBtn.style.borderColor = '#ff1744';
                toolWeedBtn.title = 'Ferramenta ativa â€” Clique em um talhÃ£o para analisar a fazenda';
                // Abrir painel
                if (panel) panel.style.display = 'block';
                document.getElementById('floating-tools-panel').style.display = 'none';
                document.querySelectorAll('.leaflet-right, .leaflet-left').forEach(el => el.style.display = 'none');
                
                // Ligar servidor via pywebview
                if (window.pywebview && window.pywebview.api) {
                    window.pywebview.api.start_server().then(res => console.log(res));
                }
                
                checkApiHealth();
                // O servidor demora alguns segundos para ligar, re-checar em breve:
                setTimeout(checkApiHealth, 3000);
                setTimeout(checkApiHealth, 6000);
            } else {
                deactivateWeedTool();
            }
        });
    }

    function deactivateWeedTool() {
        weedToolActive = false;
        window.weedToolActive = false;
        if (toolWeedBtn) {
            toolWeedBtn.style.background = 'rgba(255,0,0,0.08)';
            toolWeedBtn.style.borderColor = 'rgba(255,0,0,0.3)';
            toolWeedBtn.title = 'Identificar infestaÃ§Ã£o de ervas daninhas por satÃ©lite';
        }
        if (panel) panel.style.display = 'none';
        
        document.querySelectorAll('.leaflet-right, .leaflet-left').forEach(el => el.style.display = '');
        if (window.clearAllSelections) window.clearAllSelections();
        
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.stop_server().then(res => console.log(res));
        }
    }

    // â”€â”€ Coletador de features da fazenda a partir do GeoJSON carregado â”€
    function getFazendaFeatures(fazendaId) {
        const results = [];
        if (!window.loadedLayers) return results;
        // FunÃ§Ã£o para extrair apenas a parte inteira do ID (ex: "9902,0" -> "9902")
        const cleanId = (id) => String(id || '').split(',')[0].split('.')[0].trim();
        const baseTargetId = cleanId(fazendaId);
        if (!baseTargetId) return results;

        const seenPolys = new Set();
        Object.keys(window.loadedLayers).forEach(layerName => {
            const mapLayer = window.loadedLayers[layerName];
            if (!mapLayer || !mapLayer.eachLayer) return;
            mapLayer.eachLayer(layer => {
                const props = layer.feature && layer.feature.properties;
                if (!props) return;
                const fid = props.FAZENDA || props.DL_FUNDOAGRIC || props['DL FUNDOAGRIC'];
                if (fid && cleanId(fid) === baseTargetId) {
                    // Evitar duplicatas se houver mais de uma camada com os mesmos talhÃµes (ex: Variedades)
                    const uniqueKey = props.TALHAO || props.COD_TALHAO || JSON.stringify(layer.feature.geometry.coordinates?.[0]?.[0] || Math.random());
                    if (!seenPolys.has(uniqueKey)) {
                        seenPolys.add(uniqueKey);
                        results.push(layer.feature);
                    }
                }
            });
        });
        return results;
    }

    function getFazendaFeaturesByName(nomeFaz) {
        let matchedId = null;
        if (!window.loadedLayers) return [];
        const searchName = String(nomeFaz || '').trim().toLowerCase();
        
        // Primeiro, encontrar o ID da fazenda que bate com o nome buscado
        Object.keys(window.loadedLayers).forEach(layerName => {
            if (matchedId) return; // already found
            const mapLayer = window.loadedLayers[layerName];
            if (!mapLayer || !mapLayer.eachLayer) return;
            mapLayer.eachLayer(layer => {
                if (matchedId) return;
                const props = layer.feature && layer.feature.properties;
                if (!props) return;
                
                const nameStr = String(props.NOME_FAZ || props['DL DESCFUNDOA'] || '').trim().toLowerCase();
                const rawId = props.FAZENDA || props.DL_FUNDOAGRIC || props['DL FUNDOAGRIC'];
                const cleanIdStr = String(rawId || '').split(',')[0].split('.')[0].trim().toLowerCase();
                const combinedStr = cleanIdStr ? `${cleanIdStr} - ${nameStr}` : nameStr;
                
                // Tenta combinar nome, string combinada ou ser exatamente igual ao cÃ³digo
                if ((nameStr && (nameStr.includes(searchName) || searchName.includes(nameStr))) ||
                    (combinedStr && (combinedStr.includes(searchName) || searchName.includes(combinedStr))) ||
                    (cleanIdStr && cleanIdStr === searchName)) {
                    matchedId = rawId;
                }
            });
        });

        // Se encontrou o ID, retorna todos os talhÃµes dessa fazenda pelo ID
        if (matchedId) {
            return getFazendaFeatures(matchedId);
        }
        return [];
    }

    // â”€â”€ Popula o datalist de pesquisa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function populateFazendaSearch() {
        if (!searchDatalist) return;
        searchDatalist.innerHTML = '';
        const seen = new Set();
        if (!window.loadedLayers) return;
        Object.keys(window.loadedLayers).forEach(layerName => {
            const mapLayer = window.loadedLayers[layerName];
            if (!mapLayer || !mapLayer.eachLayer) return;
            mapLayer.eachLayer(layer => {
                const props = layer.feature && layer.feature.properties;
                if (!props) return;
                const rawName = props.NOME_FAZ || props['DL DESCFUNDOA'];
                const rawId = props.FAZENDA || props.DL_FUNDOAGRIC || props['DL FUNDOAGRIC'];
                
                if (rawName) {
                    const cleanIdStr = String(rawId || '').split(',')[0].split('.')[0].trim();
                    const combinedStr = cleanIdStr ? `${cleanIdStr} - ${rawName}` : rawName;
                    
                    if (!seen.has(combinedStr)) {
                        seen.add(combinedStr);
                        const opt = document.createElement('option');
                        opt.value = combinedStr;
                        searchDatalist.appendChild(opt);
                    }
                }
            });
        });
    }

    // â”€â”€ Abre o painel ao clicar no talhÃ£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    window.openWeedAnalysisPanel = function(feature, props) {
        const codTal  = props.COD_TALHAO || props.TALHAO || '';
        const nomeFaz = props.NOME_FAZ || props['DL DESCFUNDOA'] || 'Fazenda';
        const fazId   = props.FAZENDA || props['DL FUNDOAGRIC'] || '';

        // Quando clica no mapa, analisa APENAS o talhÃ£o clicado
        selectedFazendaFeatures = [feature];
        selectedFazendaName = nomeFaz;

        // Atualizar UI
        if (talhaoName) talhaoName.textContent = `TalhÃ£o ${codTal} â€” ${nomeFaz}`;
        if (talhaoInfo) talhaoInfo.textContent = `Fazenda ID: ${fazId} Â· Apenas este talhÃ£o`;
        if (fazendaBadge) {
            fazendaBadge.style.display = 'inline-flex';
            if (fazCountEl) fazCountEl.textContent = '1';
        }

        resetPanel();
        if (panel) panel.style.display = 'block';
        window.weedSwitchTab('map');
        checkApiHealth();
        updateAnalyzeButton();
    };

    function updateAnalyzeButton() {
        if (!btnAnalyze) return;
        const can = selectedFazendaFeatures.length > 0 && apiOnline;
        btnAnalyze.disabled = !can;
        btnAnalyze.style.opacity = can ? '1' : '0.5';
        btnAnalyze.style.cursor = can ? 'pointer' : 'not-allowed';
    }

    function resetPanel() {
        if (statusArea) statusArea.style.display = 'none';
        if (resultArea) resultArea.style.display = 'none';
        if (resultStats) resultStats.style.display = 'none';
        if (exportBtns) exportBtns.style.display = 'none';
        if (apiOffline) apiOffline.style.display = 'none';
        const icon = document.getElementById('weed-btn-icon');
        const text = document.getElementById('weed-btn-text');
        if (icon) icon.textContent = 'ðŸ”';
        if (text) text.textContent = 'Identificar InfestaÃ§Ã£o na Fazenda';
        ['step-search','step-download','step-ndvi','step-detect'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.color = 'rgba(255,255,255,0.3)'; el.style.fontWeight = 'normal'; const ico = el.querySelector('.step-icon'); if(ico) ico.textContent = {'step-search':'â³','step-download':'â¬‡ï¸','step-ndvi':'ðŸ“Š','step-detect':'ðŸ”'}[id] || 'â³'; }
        });
    }

    function activateStep(id) { const el = document.getElementById(id); if(el){el.style.color='#ff9f1c';el.style.fontWeight='600';}}
    function completeStep(id) { const el = document.getElementById(id); if(el){el.style.color='#2ec4b6'; const ic=el.querySelector('.step-icon'); if(ic) ic.textContent='âœ…';}}

    // â”€â”€ Cria GeoJSON union da fazenda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function buildFazendaUnionGeoJSON(features) {
        // Retorna um GeoJSON GeometryCollection / Feature simples com bbox da fazenda
        if (features.length === 1) return features[0];
        // Cria um Feature com GeometryCollection para enviar Ã  API
        return {
            type: 'Feature',
            properties: features[0].properties || {},
            geometry: {
                type: 'GeometryCollection',
                geometries: features.map(f => f.geometry)
            }
        };
    }

    // â”€â”€ AnÃ¡lise pelo Mapa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async function runAnalysis() {
        if (!selectedFazendaFeatures.length || !apiOnline) return;
        const firstProps = selectedFazendaFeatures[0].properties || {};

        if (statusArea) statusArea.style.display = 'block';
        if (resultArea) resultArea.style.display = 'none';
        if (btnAnalyze) {
            btnAnalyze.disabled = true;
            document.getElementById('weed-btn-icon').textContent = 'â³';
            document.getElementById('weed-btn-text').textContent = `Analisando ${selectedFazendaFeatures.length} talhÃ£o(Ãµes)...`;
        }

        activateStep('step-search');
        const t1 = setTimeout(() => { completeStep('step-search'); activateStep('step-download'); }, 2000);
        const t2 = setTimeout(() => { completeStep('step-download'); activateStep('step-ndvi'); }, 7000);
        const t3 = setTimeout(() => { completeStep('step-ndvi'); activateStep('step-detect'); }, 12000);

        try {
            const unionFeature = buildFazendaUnionGeoJSON(selectedFazendaFeatures);
            const payload = {
                geojson: unionFeature,
                cod_talhao: String(firstProps.FAZENDA || ''),
                nome_faz: selectedFazendaName,
                corte: String(firstProps['DL CORTE'] || ''),
                area_ha: selectedFazendaFeatures.reduce((sum, f) => sum + parseFloat(f.properties.TALHAO_ARE || f.properties['DL AREA'] || 0), 0),
                days_back: 20, max_cloud: 20
            };

            const response = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
            completeStep('step-search'); completeStep('step-download'); completeStep('step-ndvi'); completeStep('step-detect');

            if (!response.ok) throw new Error((await response.json()).detail || 'Erro na anÃ¡lise');
            const result = await response.json();

            if (resultArea) resultArea.style.display = 'block';
            if (resultMsg) resultMsg.textContent = result.message;

            if (result.success && result.reboleiras && result.reboleiras.length > 0) {
                weedResultGeoJSON = result.geojson_collection;
                renderWeedLayer(result.geojson_collection);
                if (resultStats) resultStats.style.display = 'block';
                if (statHa)    statHa.textContent    = result.total_infested_ha;
                if (statCount) statCount.textContent = result.reboleiras.length;
                if (statDate)  statDate.textContent  = result.satellite_date || 'â€”';
                if (statCloud) statCloud.textContent = result.cloud_cover ? result.cloud_cover.toFixed(0) : 'â€”';
                if (exportBtns) exportBtns.style.display = 'flex';
            } else {
                weedResultGeoJSON = null;
                if (resultStats) resultStats.style.display = 'none';
                if (exportBtns) exportBtns.style.display = 'none';
            }
        } catch(err) {
            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
            if (resultArea) resultArea.style.display = 'block';
            if (resultMsg) { resultMsg.textContent = `âŒ ${err.message}`; resultMsg.style.borderLeftColor = '#ff9f1c'; }
        } finally {
            if (btnAnalyze) {
                btnAnalyze.disabled = false;
                document.getElementById('weed-btn-icon').textContent = 'ðŸ”„';
                document.getElementById('weed-btn-text').textContent = 'Analisar Novamente';
                updateAnalyzeButton();
            }
        }
    }

    // â”€â”€ AnÃ¡lise pela pesquisa de fazenda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async function runSearchAnalysis() {
        if (!weedSearchInput || !weedSearchInput.value.trim()) {
            alert('Digite o nome de uma fazenda para analisar.'); return;
        }
        if (!apiOnline) {
            if (searchApiOffline) searchApiOffline.style.display = 'block'; return;
        }

        const nomeBusca = weedSearchInput.value.trim();
        const features = getFazendaFeaturesByName(nomeBusca);

        if (features.length === 0) {
            if (searchResultArea) searchResultArea.style.display = 'block';
            if (searchResultMsg) searchResultMsg.textContent = `âŒ Nenhum talhÃ£o encontrado para: "${nomeBusca}"`;
            return;
        }

        if (btnSearchAnalyze) {
            btnSearchAnalyze.disabled = true;
            btnSearchAnalyze.textContent = `â³ Analisando ${features.length} talhÃ£o(Ãµes)...`;
        }
        if (searchResultArea) searchResultArea.style.display = 'block';
        if (searchResultMsg) searchResultMsg.textContent = `ðŸ›°ï¸ Buscando imagens para "${nomeBusca}" (${features.length} talhÃµes)...`;
        if (searchResultStats) searchResultStats.style.display = 'none';

        try {
            const unionFeature = buildFazendaUnionGeoJSON(features);
            const firstProps = features[0].properties || {};
            const payload = {
                geojson: unionFeature,
                cod_talhao: String(firstProps.FAZENDA || ''),
                nome_faz: nomeBusca,
                corte: String(firstProps['DL CORTE'] || ''),
                area_ha: features.reduce((s, f) => s + parseFloat(f.properties.TALHAO_ARE || 0), 0),
                days_back: 20, max_cloud: 20
            };

            const response = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error((await response.json()).detail || 'Erro');
            const result = await response.json();

            if (searchResultMsg) searchResultMsg.textContent = result.message;

            if (result.success && result.reboleiras && result.reboleiras.length > 0) {
                weedSearchResultGeoJSON = result.geojson_collection;
                renderWeedLayer(result.geojson_collection);
                if (searchResultStats) searchResultStats.style.display = 'block';
                if (searchStatHa) searchStatHa.textContent = result.total_infested_ha;
                if (searchStatCount) searchStatCount.textContent = result.reboleiras.length;
                
                const searchStatDate = document.getElementById('weed-search-stat-date');
                const searchStatCloud = document.getElementById('weed-search-stat-cloud');
                if (searchStatDate) searchStatDate.textContent = result.satellite_date || 'â€”';
                if (searchStatCloud) searchStatCloud.textContent = (result.cloud_cover !== undefined && result.cloud_cover !== null) ? Number(result.cloud_cover).toFixed(0) : 'â€”';
                // Voar para a fazenda
                if (weedLayer && weedLayer.getBounds().isValid()) {
                    window.map.flyToBounds(weedLayer.getBounds(), { padding: [80, 80], duration: 2 });
                }
            } else {
                weedSearchResultGeoJSON = null;
                if (searchResultStats) searchResultStats.style.display = 'none';
            }
        } catch(err) {
            if (searchResultMsg) { searchResultMsg.textContent = `âŒ ${err.message}`; }
        } finally {
            if (btnSearchAnalyze) {
                btnSearchAnalyze.disabled = false;
                btnSearchAnalyze.textContent = 'ðŸ” Analisar Esta Fazenda';
            }
        }
    }

    // â”€â”€ Renderizar e limpar camada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function renderWeedLayer(geojsonCollection) {
        if (!window.map) return;
        clearWeedLayer();
        weedLayer = L.geoJSON(geojsonCollection, {
            style: { color: '#D32F2F', weight: 2, fillColor: '#FF0000', fillOpacity: 0.75 },
            onEachFeature: (feature, layer) => {
                const p = feature.properties || {};
                const m2 = p.area_m2 ? p.area_m2.toLocaleString('pt-BR') : 'â€”';
                layer.bindPopup(`
                    <div style="font-family:'Inter',sans-serif; min-width:160px;">
                        <div style="font-weight:700;color:#FF0000;margin-bottom:8px;font-size:13px;">ðŸŒ¿ Foco de InfestaÃ§Ã£o</div>
                        <div style="font-size:12px;display:flex;justify-content:space-between;margin-bottom:4px;"><span>Ãrea:</span><strong>${m2} mÂ²</strong></div>
                        <div style="font-size:12px;display:flex;justify-content:space-between;"><span>Hectares:</span><strong>${p.area_ha || 'â€”'} ha</strong></div>
                    </div>`, { className: 'weed-popup' });
            }
        }).addTo(window.map);
        if (weedLayer.getBounds().isValid()) {
            window.map.flyToBounds(weedLayer.getBounds(), { padding: [60, 60], duration: 1.5 });
        }
        // Permitir limpar clicando no mapa
        window.map.once('click', () => {
            clearWeedLayer();
            weedResultGeoJSON = null;
            weedSearchResultGeoJSON = null;
            resetPanel();
            if (searchResultArea) searchResultArea.style.display = 'none';
        });
    }

    function clearWeedLayer() {
        if (weedLayer && window.map) { window.map.removeLayer(weedLayer); weedLayer = null; }
    }

    // â”€â”€ Exportadores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function downloadBlob(content, filename, mime) {
        // Strategy 1: Try Blob URL (works in modern WebViews and browsers)
        try {
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
            return;
        } catch(e1) { /* try next */ }

        // Strategy 2: Try data URI (older WebViews)
        try {
            const blob = new Blob([content], { type: mime });
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const a = document.createElement('a');
                    a.href = ev.target.result;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } catch(e2) {
                    // Strategy 3: Open raw data URI in new tab/window
                    window.open(ev.target.result, '_blank');
                }
            };
            reader.readAsDataURL(blob);
            return;
        } catch(e3) { /* try next */ }

        // Strategy 4: Show copy-paste modal as last resort
        showKmlCopyModal(content, filename);
    }

    function showKmlCopyModal(content, filename) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = `
            <div style="background:#1a2420;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;max-width:400px;width:100%;max-height:80vh;display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#fff;font-weight:700;font-size:14px;">📁 ${filename}</span>
                    <button id="kml-modal-close" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <p style="color:#a8b8b0;font-size:12px;margin:0;">Copie o conteúdo abaixo e salve em um arquivo .kml no seu celular:</p>
                <textarea id="kml-content-area" style="flex:1;background:#0d1a14;color:#2ec4b6;border:1px solid rgba(46,196,182,0.3);border-radius:8px;padding:10px;font-size:10px;font-family:monospace;min-height:200px;resize:none;">${content}</textarea>
                <button id="kml-copy-btn" style="padding:12px;background:linear-gradient(135deg,#2ec4b6,#20998e);border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">📋 Copiar KML</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('kml-modal-close').onclick = () => document.body.removeChild(overlay);
        document.getElementById('kml-copy-btn').onclick = () => {
            const ta = document.getElementById('kml-content-area');
            ta.select();
            try { document.execCommand('copy'); alert('KML copiado! Cole no app de sua escolha.'); }
            catch(e) { alert('Selecione o texto manualmente e copie.'); }
        };
    }

    function doExportGeoJSON(data, prefix) {
        if (!data) return;
        const name = prefix || selectedFazendaName || 'fazenda';
        downloadBlob(JSON.stringify(data, null, 2), `reboleiras_${name.replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.geojson`, 'application/json');
    }

    function doExportKML(data, prefix) {
        if (!data) return;
        const features = data.features || [];
        const placemarks = features.map((f, i) => {
            const area = f.properties.area_m2 || 0;
            const coordStr = geomToKML(f.geometry);
            return `<Placemark><name>Foco ${i+1} (${area.toLocaleString('pt-BR')} mÂ²)</name><Style><LineStyle><color>ff0000ff</color><width>2</width></LineStyle><PolyStyle><color>bf0000ff</color></PolyStyle></Style>${coordStr}</Placemark>`;
        }).join('');
        const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Reboleiras ${prefix}</name>${placemarks}</Document></kml>`;
        downloadBlob(kml, `reboleiras_${(prefix||'').replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.kml`, 'application/vnd.google-earth.kml+xml');
    }

    function geomToKML(geometry) {
        if (geometry.type === 'Polygon') {
            const ring = geometry.coordinates[0].map(c=>`${c[0]},${c[1]},0`).join(' ');
            return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
        } else if (geometry.type === 'MultiPolygon') {
            return `<MultiGeometry>${geometry.coordinates.map(poly=>{const r=poly[0].map(c=>`${c[0]},${c[1]},0`).join(' ');return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${r}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;}).join('')}</MultiGeometry>`;
        } else if (geometry.type === 'LineString') {
            const ring = geometry.coordinates.map(c=>`${c[0]},${c[1]},0`).join(' ');
            return `<LineString><coordinates>${ring}</coordinates></LineString>`;
        } else if (geometry.type === 'Point') {
            return `<Point><coordinates>${geometry.coordinates[0]},${geometry.coordinates[1]},0</coordinates></Point>`;
        }
        return '';
    }

    // â”€â”€ Listeners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (btnAnalyze)      btnAnalyze.addEventListener('click', runAnalysis);
    if (weedSearchInput) {
        weedSearchInput.addEventListener('focus', populateFazendaSearch);
        weedSearchInput.addEventListener('click', populateFazendaSearch);
        
        // Add zoom logic when a farm is selected in the Weed tool search
    weedSearchInput.addEventListener('change', handleSearch);
    weedSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e); });
    function handleSearch(e) {
            const query = e.target.value.toLowerCase().trim();
            if (!query || !window.loadedLayers) return;
            
            let bounds = L.latLngBounds();
            let matchCount = 0;
            let foundLayer = null;

            const checkLayer = (layer) => {
                if (layer.feature) {
                    const props = layer.feature.properties || {};
                    const getProp = (props, possibleNames) => {
                        const keys = Object.keys(props);
                        for (const name of possibleNames) {
                            const upperName = name.toUpperCase();
                            const foundKey = keys.find(k => k.toUpperCase() === upperName);
                            if (foundKey) return props[foundKey];
                        }
                        return '';
                    };
                    
                    const titleRaw = getProp(props, ['NOME', 'NAME', 'FAZENDA', 'NOME_FAZ', 'NOMEPROPRI', 'DESCFUNDOA', 'TALHAO', 'ID', 'LOCAL', 'DESIGNACAO']);
                    const rawName = props.NOME_FAZ || props['DL DESCFUNDOA'] || '';
                    const rawId = props.FAZENDA || props.DL_FUNDOAGRIC || props['DL FUNDOAGRIC'] || '';
                    
                    let title = titleRaw || '';
                    if (rawName && rawId) {
                        const cleanIdStr = String(rawId).split(',')[0].split('.')[0].trim();
                        if (cleanIdStr) title = `${cleanIdStr} - ${rawName}`;
                    }
                    
                    const normalize = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                    if (normalize(title).includes(normalize(query)) || normalize(rawName).includes(normalize(query)) || normalize(titleRaw).includes(normalize(query))) {
                        matchCount++;
                        foundLayer = layer;
                        if (layer.getBounds) {
                            bounds.extend(layer.getBounds());
                        } else if (layer.getLatLng) {
                            bounds.extend(layer.getLatLng());
                        }
                    }
                } else if (layer.eachLayer) {
                    layer.eachLayer(child => checkLayer(child));
                }
            };

            for (const layerName in window.loadedLayers) {
                if (!layerName.toUpperCase().includes('FAZENDA') && !layerName.toUpperCase().includes('TALHOES')) continue;
                
                const layerGroup = window.loadedLayers[layerName];
                if (layerGroup && layerGroup.eachLayer) {
                    layerGroup.eachLayer(child => checkLayer(child));
                }
            }
            
            if (matchCount > 0 && bounds.isValid()) {
                if (matchCount > 1 || !foundLayer.getLatLng) {
                    map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
                } else {
                    map.flyTo(foundLayer.getLatLng(), 15, { duration: 1.5 });
                }
            }
        }
    }
    if (btnClose) {
        btnClose.addEventListener('click', deactivateWeedTool);
    }
    if (btnGeoJSON)      btnGeoJSON.addEventListener('click', () => doExportGeoJSON(weedResultGeoJSON, selectedFazendaName));
    if (btnKML)          btnKML.addEventListener('click', () => doExportKML(weedResultGeoJSON, selectedFazendaName));
    if (btnClear)        btnClear.addEventListener('click', () => { clearWeedLayer(); weedResultGeoJSON = null; resetPanel(); });
    if (btnSearchAnalyze) btnSearchAnalyze.addEventListener('click', runSearchAnalysis);
    if (btnSearchGeoJSON) btnSearchGeoJSON.addEventListener('click', () => doExportGeoJSON(weedSearchResultGeoJSON, weedSearchInput?.value));
    if (btnSearchKML)     btnSearchKML.addEventListener('click', () => doExportKML(weedSearchResultGeoJSON, weedSearchInput?.value));
    if (btnSearchClear) {
        btnSearchClear.addEventListener('click', () => {
            if (weedSearchInput) weedSearchInput.value = '';
            if (searchResultArea) searchResultArea.style.display = 'none';
            weedSearchResultGeoJSON = null;
            clearWeedLayer();
        });
    }

    // Toggle tractor layer button
    setTimeout(() => {
        const tractorBtn = document.getElementById('floating-tractor-btn');
        if (tractorBtn) {
            tractorBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.loadedLayers && window.loadedLayers['LINHAS DE COLHEITA']) {
                    const layer = window.loadedLayers['LINHAS DE COLHEITA'];
                    // Toggle visibility check correctly by checking if map has it
                    if (window.map.hasLayer(layer)) {
                        window.map.removeLayer(layer);
                        tractorBtn.style.background = 'rgba(5, 8, 7, 0.85)';
                        tractorBtn.style.borderColor = 'rgba(255,255,255,0.1)';
                    } else {
                        window.map.addLayer(layer);
                        tractorBtn.style.background = 'rgba(0, 0, 139, 0.4)'; // Highlight color (dark blue)
                        tractorBtn.style.borderColor = '#00008b';
                    }
                }
            });
        }
    }, 1000);

    // Analisador de Talhão Logic
    setTimeout(() => {
        const analyzerBtn = document.getElementById('analyzer-btn');
        const analyzerPanel = document.getElementById('analyzer-panel');
        const closeAnalyzerBtn = document.getElementById('close-analyzer-btn');
        const minAnalyzerBtn = document.getElementById('minimize-analyzer-btn');
        const maxAnalyzerBtn = document.getElementById('maximize-analyzer-btn');
        const analyzerContent = document.getElementById('analyzer-content');
        const analyzerPlaceholder = document.getElementById('analyzer-placeholder');
        const analyzerData = document.getElementById('analyzer-data');
        let isMaximized = false;
        
        window.analyzerActive = false;

        if (analyzerBtn) {
            analyzerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.analyzerActive = !window.analyzerActive;
                if (window.analyzerActive) {
                    analyzerPanel.style.display = 'flex';
                    analyzerBtn.style.background = 'rgba(0, 200, 100, 0.4)';
                    analyzerBtn.style.borderColor = '#00c864';
                    
                    // Fechar outros painéis bottom
                    ['draw-panel', 'measure-result', 'route-panel', 'record-panel', 'clima-farm-panel'].forEach(id => {
                        const p = document.getElementById(id);
                        if (p) p.style.display = 'none';
                    });
                    if (window.climaFarmDeactivate) window.climaFarmDeactivate();
                    window.routeSelectionMode = false;
                    window.measureActive = false;
                } else {
                    analyzerPanel.style.display = 'none';
                    analyzerBtn.style.background = 'rgba(5, 8, 7, 0.85)';
                    analyzerBtn.style.borderColor = 'rgba(255,255,255,0.1)';
                    if (window.clearAllSelections) window.clearAllSelections();
                }
            });
        }

        if (closeAnalyzerBtn) {
            closeAnalyzerBtn.addEventListener('click', () => {
                window.analyzerActive = false;
                analyzerPanel.style.display = 'none';
                analyzerBtn.style.background = 'rgba(5, 8, 7, 0.85)';
                analyzerBtn.style.borderColor = 'rgba(255,255,255,0.1)';
                if (window.clearAllSelections) window.clearAllSelections();
            });
        }

        if (minAnalyzerBtn) {
            minAnalyzerBtn.addEventListener('click', () => {
                isMaximized = false;
                analyzerPanel.style.height = 'auto';
                analyzerContent.style.maxHeight = '35vh';
                analyzerContent.style.display = analyzerContent.style.display === 'none' ? 'flex' : 'none';
            });
        }

        if (maxAnalyzerBtn) {
            maxAnalyzerBtn.addEventListener('click', () => {
                isMaximized = !isMaximized;
                analyzerContent.style.display = 'flex'; // Ensure it's visible when maximizing
                if (isMaximized) {
                    analyzerPanel.style.height = '85vh';
                    analyzerContent.style.maxHeight = 'calc(85vh - 70px)';
                } else {
                    analyzerPanel.style.height = 'auto';
                    analyzerContent.style.maxHeight = '35vh';
                }
            });
        }

        window.populateAnalyzer = (props, title) => {
            analyzerPlaceholder.style.display = 'none';
            analyzerData.style.display = 'flex';
            analyzerContent.style.display = 'flex'; // Ensure panel is expanded when a talhão is clicked
            
            const getProp = (keys) => {
                const k = Object.keys(props);
                for (const name of keys) {
                    const found = k.find(x => x.toUpperCase() === name.toUpperCase());
                    if (found) return { key: found, val: props[found] };
                }
                return null;
            };

            const nomeFazObj = getProp(['NOME_FAZ', 'FAZENDA', 'NOMEPROPRI']);
            const areaFazObj = getProp(['AREA_FAZ', 'AREA_TOTAL', 'AREA_TOTAL_FAZ', 'HECTARES_FAZ']);
            const codFazObj = getProp(['COD_FAZ', 'COD_FAZENDA', 'ID_FAZENDA', 'COD_FAZEN']);
            const codTalObj = getProp(['COD_TALHAO', 'TALHAO', 'CODIGO', 'ID']);
            const areaTalObj = getProp(['TALHAO_ARE', 'AREA', 'AREA_HA', 'DL AREA']);
            const corteObj = getProp(['DL CORTE', 'CORTE', 'ESTAGIO', 'CICLO', 'CORTES']);
            const varObj = getProp(['DL VARIEDADE', 'VARIEDADE', 'VAR', 'CULTURA']);
            
            const nomeFaz = nomeFazObj ? nomeFazObj.val : title;
            const areaFaz = areaFazObj ? areaFazObj.val : '';
            
            let html = `<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 12px;">
                            <div style="font-weight: bold; color: #fff; font-size: 15px; text-transform: uppercase;">${nomeFaz}</div>
                            ${areaFaz ? `<div style="font-size: 12px; color: #2ec4b6; font-weight: bold; background: rgba(46, 196, 182, 0.1); padding: 4px 8px; border-radius: 4px;">ÁREA TOTAL: ${areaFaz}</div>` : ''}
                        </div>`;
            
            const skipKeys = ['style', 'stroke', 'fill', 'opacity', 'fill-opacity'];
            if (nomeFazObj) skipKeys.push(nomeFazObj.key.toLowerCase());
            if (areaFazObj) skipKeys.push(areaFazObj.key.toLowerCase());
            if (codFazObj) skipKeys.push(codFazObj.key.toLowerCase());
            if (codTalObj) skipKeys.push(codTalObj.key.toLowerCase());
            if (areaTalObj) skipKeys.push(areaTalObj.key.toLowerCase());
            if (corteObj) skipKeys.push(corteObj.key.toLowerCase());
            if (varObj) skipKeys.push(varObj.key.toLowerCase());

            html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
            
            const drawCard = (label, val, highlight = false) => {
                if (val === undefined || val === null) val = '-';
                const bg = highlight ? 'rgba(46, 196, 182, 0.1)' : 'rgba(255,255,255,0.05)';
                const color = highlight ? '#2ec4b6' : '#fff';
                return `
                    <div style="background: ${bg}; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 10px; color: #a8b8b0; margin-bottom: 4px; text-transform: uppercase;">${label}</div>
                        <div style="font-size: 14px; color: ${color}; word-break: break-all; font-weight: bold;">${val}</div>
                    </div>
                `;
            };

            if (codFazObj) html += drawCard(codFazObj.key, codFazObj.val, true);
            if (codTalObj) html += drawCard(codTalObj.key, codTalObj.val, true);
            if (areaTalObj) html += drawCard(areaTalObj.key, areaTalObj.val, true);
            if (corteObj) html += drawCard(corteObj.key, corteObj.val, true);
            if (varObj) html += drawCard(varObj.key, varObj.val, true);
            
            for (let key in props) {
                if (skipKeys.includes(key.toLowerCase())) continue;
                html += `
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.02);">
                        <div style="font-size: 10px; color: #a8b8b0; margin-bottom: 2px;">${key}</div>
                        <div style="font-size: 12px; color: #fff; word-break: break-all;">${props[key]}</div>
                    </div>
                `;
            }
            html += `</div>`;
            
            analyzerData.innerHTML = html;
        };

        // --- LÓGICA DE IMPORTAÇÃO DE CAMADAS ---
        const btnImport = document.getElementById('tool-import-layers-btn');
        const fileImport = document.getElementById('import-layers-file');
        
        if (btnImport && fileImport) {
            btnImport.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileImport.click();
            });
            
            fileImport.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (await window.agrogisConfirm(`Deseja importar e substituir as camadas do mapa com o arquivo "${file.name}"?\n\nIsso carregará as novas fazendas e talhões instantaneamente.`)) {
                    try {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            const jsonStr = event.target.result;
                            
                            // Validação básica do JSON
                            const parsed = JSON.parse(jsonStr);
                            if (!parsed.FAZENDAS && !parsed.TALHOES) {
                                alert("Arquivo inválido. O JSON deve conter 'FAZENDAS' ou 'TALHOES'.");
                                return;
                            }
                            
                            await saveImportedLayers(jsonStr);
                            alert("Camadas importadas com sucesso! O aplicativo será reiniciado para aplicar as mudanças.");
                            window.location.reload();
                        };
                        reader.readAsText(file);
                    } catch(err) {
                        console.error(err);
                        alert("Erro ao ler ou salvar o arquivo: " + err.message);
                    }
                }
                
                // Limpa o input para poder importar o mesmo arquivo novamente se quiser
                fileImport.value = '';
            });
        }
        
        // --- LÓGICA DE ATUALIZAÇÃO ONLINE ---
        const btnUpdate = document.getElementById('tool-update-layers-btn');
        if (btnUpdate) {
            btnUpdate.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!navigator.onLine) {
                    alert("Você precisa estar conectado à internet para baixar a atualização!");
                    return;
                }
                
                if (await window.agrogisConfirm("Deseja verificar e baixar a última versão das camadas do servidor (GitHub)?")) {
                    try {
                        const originalText = btnUpdate.innerHTML;
                        btnUpdate.innerHTML = `<span style="font-size: 13px; font-weight: 500;">Baixando... (Aguarde)</span>`;
                        btnUpdate.style.opacity = '0.5';
                        btnUpdate.style.pointerEvents = 'none';
                        
                        // Busca o arquivo JSON remoto adicionando timestamp para quebrar cache
                        const remoteUrl = window.REMOTE_LAYERS_URL || 'https://edinaldoagrogis.github.io/Agrogis_NDB/layers_data.json';
                        const response = await fetch(`${remoteUrl}?t=${new Date().getTime()}`);
                        
                        if (!response.ok) {
                            throw new Error("Servidor retornou " + response.status);
                        }
                        
                        const jsonStr = await response.text();
                        const parsed = JSON.parse(jsonStr);
                        if (!parsed.FAZENDAS && !parsed.TALHOES) {
                            throw new Error("O arquivo baixado não contém as camadas necessárias.");
                        }
                        
                        await saveImportedLayers(jsonStr);
                        alert("Camadas baixadas com sucesso! O aplicativo será reiniciado para aplicar as mudanças.");
                        window.location.reload();
                    } catch(err) {
                        console.error(err);
                        alert("Erro ao baixar atualização: " + err.message + "\n\nVerifique se o arquivo layers_data.json já foi gerado no GitHub.");
                        btnUpdate.innerHTML = `<span style="font-size: 13px; font-weight: 500;">Atualizar Camadas (Online)</span>`;
                        btnUpdate.style.opacity = '1';
                        btnUpdate.style.pointerEvents = 'auto';
                    }
                }
            });
        }

    }, 1000);

})();


