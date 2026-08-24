// car.js
let map;
let baseLayersGroup = L.layerGroup();
let carLayerGroup = L.layerGroup();
let selectedFazendaCoords = null;
let allFazendas = [];

// Initialize Map
function initMap() {
    map = L.map('car-map', {
        zoomControl: true,
        maxZoom: 20
    }).setView([-18.1, -40.1], 10);

    // Google Satellite Layer
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google'
    }).addTo(map);

    baseLayersGroup.addTo(map);
    carLayerGroup.addTo(map);

    loadBaseLayers();
    setupFazendaSearch();
}

// Load base layers (Talhões, etc.) but make them unclickable and hide labels
function loadBaseLayers() {
    if (typeof GEOPORTAL_LAYERS === 'undefined') {
        console.error("Camadas não encontradas. Verifique layers_data.js");
        return;
    }

    const styleUnselectable = {
        color: '#ffffff',
        weight: 1,
        fillOpacity: 0.1,
        interactive: false // Não permite clique
    };

    // Load Talhões (usually the main polygons)
    if (GEOPORTAL_LAYERS["TALHOES"]) {
        L.geoJSON(GEOPORTAL_LAYERS["TALHOES"], {
            style: styleUnselectable,
            interactive: false // Make sure they are not selectable
        }).addTo(baseLayersGroup);
    }
    
    // Any other polygon layers could be added here
    if (GEOPORTAL_LAYERS["HIDROGRAFIA"]) {
        L.geoJSON(GEOPORTAL_LAYERS["HIDROGRAFIA"], {
            style: { ...styleUnselectable, color: '#3b82f6' },
            interactive: false
        }).addTo(baseLayersGroup);
    }

    // Extract Fazendas for search
    if (GEOPORTAL_LAYERS["FAZENDAS"] && GEOPORTAL_LAYERS["FAZENDAS"].features) {
        allFazendas = GEOPORTAL_LAYERS["FAZENDAS"].features.map(f => {
            return {
                name: f.properties.NAME || f.properties.Fazenda || 'Desconhecido',
                coords: f.geometry.coordinates // [lon, lat]
            };
        }).filter(f => f.coords && f.coords.length >= 2);
    }

    // Adiciona as camadas sobre o mapa usando o controle nativo do Leaflet no canto superior esquerdo
    setupMapControls();
}

let userLocationMarker = null;
let userLocationCircle = null;
let lastKnownLocation = null;

function setupMapControls() {
    // Estilo base para todos os botões de controle (igual ao app principal)
    const btnStyle = `
        display:flex; align-items:center; justify-content:center;
        width:44px; height:44px; border-radius:12px;
        background:rgba(5,8,7,0.85); backdrop-filter:blur(12px);
        border:1px solid rgba(255,255,255,0.1);
        color:#fff; cursor:pointer; text-decoration:none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    // ─── 1. Controle de Camadas (APP e Reserva Legal) ─ Topo Esquerdo ───────────
    // Usa um controle personalizado com o ícone de camadas igual ao app (print 2)
    L.Control.LayersCAR = L.Control.extend({
        onAdd: function(map) {
            const wrapper = L.DomUtil.create('div', '');
            wrapper.style.cssText = 'position:relative;';

            const btn = L.DomUtil.create('div', 'leaflet-bar', wrapper);
            btn.style.cssText = btnStyle + 'margin:0;';
            btn.title = 'Camadas';
            // Ícone de camadas em stack (mesmo do app principal - print 2)
            btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 12 12 17 22 12"></polyline>
                <polyline points="2 17 12 22 22 17"></polyline>
            </svg>`;

            // Painel flutuante de camadas
            const panel = L.DomUtil.create('div', '', wrapper);
            panel.style.cssText = `
                display:none; position:absolute; top:52px; left:0;
                width:200px; background:rgba(5,8,7,0.95); backdrop-filter:blur(20px);
                border:1px solid rgba(255,255,255,0.1); border-radius:12px;
                box-shadow:0 8px 32px rgba(0,0,0,0.5); padding:12px; z-index:9999;
                color:#fff; font-family:inherit; font-size:14px;
            `;

            const appLayer = GEOPORTAL_LAYERS["APP"] ? L.geoJSON(GEOPORTAL_LAYERS["APP"], { style: { color: '#10b981', weight: 2, fillOpacity: 0.3 }, interactive: false }) : null;
            const rlData = GEOPORTAL_LAYERS["RESERVA_LEGAL"] || GEOPORTAL_LAYERS["RESERVA"];
            const rlLayer = rlData ? L.geoJSON(rlData, { style: { color: '#059669', weight: 2, fillOpacity: 0.3 }, interactive: false }) : null;

            const mkRow = (label, layer, color) => {
                const row = document.createElement('label');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);';
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.style.cssText = 'width:16px;height:16px;cursor:pointer;';
                chk.disabled = !layer;
                const dot = document.createElement('span');
                dot.style.cssText = `width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0;`;
                const txt = document.createElement('span');
                txt.textContent = label;
                txt.style.color = chk.disabled ? '#666' : '#fff';
                chk.onchange = () => {
                    if (!layer) return;
                    if (chk.checked) layer.addTo(map); else map.removeLayer(layer);
                };
                row.append(chk, dot, txt);
                return row;
            };

            panel.appendChild(mkRow('APP (Preservação)', appLayer, '#10b981'));
            panel.appendChild(mkRow('Reserva Legal', rlLayer, '#059669'));

            L.DomEvent.disableClickPropagation(wrapper);
            L.DomEvent.disableScrollPropagation(wrapper);
            btn.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
            document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) panel.style.display = 'none'; });

            return wrapper;
        }
    });
    new L.Control.LayersCAR({ position: 'topleft' }).addTo(map);

    // ─── 2. Controle de Expandir Mapa (ícone print 3) ─ Topo Direito ────────────
    L.Control.FullscreenCustom = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', '');
            const btn = L.DomUtil.create('div', 'leaflet-bar', container);
            btn.style.cssText = btnStyle + 'margin:0;';
            btn.title = 'Expandir Mapa';
            // Ícone print 3: seta diagonal + retângulo pequeno no canto
            btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9V3h6"/>
                <path d="M3 3l7 7"/>
                <rect x="13" y="13" width="8" height="8" rx="1"/>
            </svg>`;

            let isExpanded = false;
            const mapDiv = document.getElementById('car-map');
            const dashboardGrid = document.querySelector('.dashboard-grid');

            L.DomEvent.disableClickPropagation(container);
            btn.onclick = () => {
                isExpanded = !isExpanded;
                if (isExpanded) {
                    document.querySelector('.left-column').style.display = 'none';
                    dashboardGrid.style.gridTemplateColumns = '1fr';
                    mapDiv.style.height = 'calc(100vh - 80px)';
                    btn.title = 'Minimizar Mapa';
                    // Ícone de minimizar
                    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 3H3v6"/><path d="M10 10L3 3"/>
                        <rect x="13" y="13" width="8" height="8" rx="1"/>
                    </svg>`;
                } else {
                    document.querySelector('.left-column').style.display = '';
                    dashboardGrid.style.gridTemplateColumns = '';
                    mapDiv.style.height = '';
                    btn.title = 'Expandir Mapa';
                    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9V3h6"/>
                        <path d="M3 3l7 7"/>
                        <rect x="13" y="13" width="8" height="8" rx="1"/>
                    </svg>`;
                }
                setTimeout(() => map.invalidateSize(), 100);
            };
            return container;
        }
    });
    new L.Control.FullscreenCustom({ position: 'topright' }).addTo(map);

    // ─── 3. Rastreamento GPS (ponto azul no mapa) ─────────────────────────────
    map.locate({ watch: true, enableHighAccuracy: true });
    map.on('locationfound', function(e) {
        lastKnownLocation = e.latlng;
        const radius = e.accuracy / 2;
        if (!userLocationMarker) {
            userLocationMarker = L.circleMarker(e.latlng, {
                radius: 6, fillColor: "#2196F3", color: "#fff",
                weight: 2, opacity: 1, fillOpacity: 1
            }).addTo(map);
            userLocationCircle = L.circle(e.latlng, {
                radius: radius, color: "#2196F3", weight: 1, fillOpacity: 0.1
            }).addTo(map);
        } else {
            userLocationMarker.setLatLng(e.latlng);
            userLocationCircle.setLatLng(e.latlng).setRadius(radius);
        }
    });

    // ─── 4. Botão GPS / Localização ─ Canto Inferior Direito (ícone print 1) ──
    L.Control.GpsZoom = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', '');
            const btn = L.DomUtil.create('div', 'leaflet-bar', container);
            btn.style.cssText = btnStyle + 'margin:0;margin-bottom:10px;margin-right:10px;';
            btn.title = 'Minha Localização';
            // Ícone de seta de navegação - exatamente igual ao app principal (print 1)
            btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>`;
            L.DomEvent.disableClickPropagation(container);
            btn.onclick = () => {
                if (lastKnownLocation) {
                    map.flyTo(lastKnownLocation, 16, { duration: 1.5 });
                } else {
                    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
                }
            };
            return container;
        }
    });
    new L.Control.GpsZoom({ position: 'bottomright' }).addTo(map);

    // ─── 5. Botão Centralizar no CAR ─ Canto Inferior Direito ─────────────────
    L.Control.CenterCAR = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', '');
            const btn = L.DomUtil.create('div', 'leaflet-bar', container);
            btn.style.cssText = btnStyle + 'margin:0;margin-right:10px;';
            btn.title = 'Centralizar no Limite do CAR';
            // Ícone de enquadrar/zoom to fit
            btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffff00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            </svg>`;
            L.DomEvent.disableClickPropagation(container);
            btn.onclick = () => {
                const layers = carLayerGroup.getLayers();
                if (layers.length > 0) {
                    map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [30, 30] });
                }
            };
            return container;
        }
    });
    new L.Control.CenterCAR({ position: 'bottomright' }).addTo(map);
}



// Setup Farm Search Autocomplete
function setupFazendaSearch() {
    const input = document.getElementById('fazenda-select');
    const dropdown = document.getElementById('fazenda-dropdown');
    const btnBuscar = document.getElementById('btn-buscar-car');

    input.addEventListener('input', function() {
        const val = this.value.toLowerCase();
        dropdown.innerHTML = '';
        if (!val) {
            dropdown.style.display = 'none';
            btnBuscar.disabled = true;
            return;
        }

        const matches = allFazendas.filter(f => f.name.toLowerCase().includes(val)).slice(0, 10);
        
        if (matches.length > 0) {
            dropdown.style.display = 'block';
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.textContent = match.name;
                div.onclick = function() {
                    input.value = match.name;
                    dropdown.style.display = 'none';
                    selectedFazendaCoords = match.coords; // [lon, lat]
                    btnBuscar.disabled = false;
                    
                    // Center map on farm
                    map.setView([match.coords[1], match.coords[0]], 14);
                };
                dropdown.appendChild(div);
            });
        } else {
            dropdown.style.display = 'none';
        }
    });

    // Hide dropdown on click outside
    document.addEventListener('click', function(e) {
        if (e.target !== input && e.target !== dropdown) {
            dropdown.style.display = 'none';
        }
    });
}

// Form Submit -> Fetch CAR
document.getElementById('car-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!selectedFazendaCoords) return;

    fetchCARData(selectedFazendaCoords[0], selectedFazendaCoords[1]);
});

// Fetch CAR Data from Web (SICAR or mock)
async function fetchCARData(lon, lat) {
    const btnBuscar = document.getElementById('btn-buscar-car');
    const loading = document.getElementById('loading-indicator');
    const infoPanel = document.getElementById('car-info-panel');
    const infoContent = document.getElementById('car-info-content');

    btnBuscar.disabled = true;
    loading.style.display = 'block';
    infoPanel.style.display = 'none';
    carLayerGroup.clearLayers();

    try {
        // Busca na API pública (WFS) do SICAR (Web)
        const states = ['es', 'ba', 'mg'];
        let carFeature = null;

        for (let uf of states) {
            const wfsUrl = `https://geoserver.car.gov.br/geoserver/sicar/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=sicar:sicar_imoveis_${uf}&outputFormat=application/json&cql_filter=INTERSECTS(geo_area_imovel,%20POINT(${lon}%20${lat}))`;
            
            try {
                const response = await fetch(wfsUrl);
                if (!response.ok) continue;
                
                const data = await response.json();
                if (data && data.features && data.features.length > 0) {
                    carFeature = data.features[0];
                    break; // Encontrou o polígono
                }
            } catch (err) {
                console.warn(`Erro CORS ou rede ao buscar no estado ${uf}:`, err);
            }
        }

        if (carFeature) {
            renderCARFeature(carFeature);
        } else {
            alert("Não foi possível encontrar o limite do CAR para esta localização no SICAR (buscado em ES, BA e MG). O servidor pode estar fora do ar.");
        }

    } catch (error) {
        console.error("Erro geral ao buscar dados do CAR:", error);
        alert("Ocorreu um erro ao buscar os limites do CAR na Web.");
    } finally {
        btnBuscar.disabled = false;
        loading.style.display = 'none';
    }
}

function renderCARFeature(feature) {
    const infoPanel = document.getElementById('car-info-panel');
    const infoContent = document.getElementById('car-info-content');

    const carGeoJSON = L.geoJSON(feature, {
        style: {
            color: '#ffff00', // Linha amarela como no print
            weight: 4,
            fillOpacity: 0.1,
            interactive: true // Esta será a ÚNICA camada selecionável
        },
        onEachFeature: function(feat, layer) {
            const props = feat.properties;
            // Popup simplificado
            layer.bindPopup(`<strong>CAR:</strong> ${props.cod_imovel || 'N/A'}`);
            
            // Evento de clique para abrir painel lateral com atributos completos
            layer.on('click', function() {
                infoPanel.style.display = 'block';
                infoContent.innerHTML = `
                    <div class="car-info-item">
                        <strong>Código do Imóvel (CAR):</strong>
                        <span>${props.cod_imovel || 'N/A'}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Município/UF:</strong>
                        <span>${props.municipio || ''} - ${props.uf || ''}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Área (ha):</strong>
                        <span>${props.area || 'N/A'}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Situação:</strong>
                        <span style="color: var(--success);">${props.condicao || props.status_imovel || 'N/A'}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Módulos Fiscais:</strong>
                        <span>${props.m_fiscal || 'N/A'}</span>
                    </div>
                `;
            });
        }
    }).addTo(carLayerGroup);

    // Ajustar zoom para a feição do CAR
    map.fitBounds(carGeoJSON.getBounds(), { padding: [30, 30] });
    
    // Abre popup do limite do CAR automaticamente
    carGeoJSON.getLayers()[0].fire('click');

    // Rola a tela suavemente para as informações do CAR em dispositivos móveis
    setTimeout(() => {
        infoPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Inicializar na carga da página
window.onload = initMap;
