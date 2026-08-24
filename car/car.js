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
    // 1. Controle de Camadas (APP e Reserva Legal) - Topo Esquerdo
    const overlayMaps = {};
    
    if (GEOPORTAL_LAYERS["APP"]) {
        const appLayer = L.geoJSON(GEOPORTAL_LAYERS["APP"], {
            style: { color: '#10b981', weight: 2, fillOpacity: 0.3 },
            interactive: false
        });
        overlayMaps["APP (Área de Preservação)"] = appLayer;
    }
    
    const rlData = GEOPORTAL_LAYERS["RESERVA_LEGAL"] || GEOPORTAL_LAYERS["RESERVA"];
    if (rlData) {
        const rlLayer = L.geoJSON(rlData, {
            style: { color: '#059669', weight: 2, fillOpacity: 0.3 },
            interactive: false
        });
        overlayMaps["Reserva Legal"] = rlLayer;
    }

    // Só adiciona o controle se tiver camadas
    if (Object.keys(overlayMaps).length > 0) {
        L.control.layers(null, overlayMaps, { position: 'topleft', collapsed: true }).addTo(map);
    }

    // 2. Controle de Tela Cheia (CSS) - Topo Direito
    // Usa CSS em vez de requestFullscreen para evitar a mensagem do navegador
    L.Control.FullscreenCustom = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const btn = L.DomUtil.create('a', '', container);
            btn.innerHTML = '⛶';
            btn.href = '#';
            btn.title = 'Expandir Mapa';
            btn.style.fontSize = '18px';
            btn.style.lineHeight = '30px';
            btn.style.textAlign = 'center';
            btn.style.textDecoration = 'none';

            let isExpanded = false;
            const mapDiv = document.getElementById('car-map');
            const dashboardGrid = document.querySelector('.dashboard-grid');

            L.DomEvent.disableClickPropagation(container);
            
            L.DomEvent.on(btn, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                isExpanded = !isExpanded;
                if (isExpanded) {
                    // Expande: esconde coluna esquerda e torna mapa tela toda
                    document.querySelector('.left-column').style.display = 'none';
                    dashboardGrid.style.gridTemplateColumns = '1fr';
                    mapDiv.style.height = 'calc(100vh - 80px)';
                    btn.innerHTML = '⊠'; // ícone de minimizar
                    btn.title = 'Minimizar Mapa';
                } else {
                    // Minimiza: volta ao normal
                    document.querySelector('.left-column').style.display = '';
                    dashboardGrid.style.gridTemplateColumns = '';
                    mapDiv.style.height = '';
                    btn.innerHTML = '⛶';
                    btn.title = 'Expandir Mapa';
                }
                // Força Leaflet a recalcular o tamanho do mapa
                setTimeout(() => map.invalidateSize(), 100);
            });
            return container;
        }
    });
    new L.Control.FullscreenCustom({ position: 'topright' }).addTo(map);

    // 3. Rastreamento da Localização do Usuário (aparecer localização dentro do mapa)
    map.locate({ watch: true, enableHighAccuracy: true });
    
    map.on('locationfound', function(e) {
        lastKnownLocation = e.latlng;
        const radius = e.accuracy / 2;
        
        if (!userLocationMarker) {
            // Criação do marcador de ponto azul
            userLocationMarker = L.circleMarker(e.latlng, {
                radius: 6,
                fillColor: "#2196F3",
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(map);
            
            userLocationCircle = L.circle(e.latlng, {
                radius: radius,
                color: "#2196F3",
                weight: 1,
                fillOpacity: 0.1
            }).addTo(map);
        } else {
            userLocationMarker.setLatLng(e.latlng);
            userLocationCircle.setLatLng(e.latlng);
            userLocationCircle.setRadius(radius);
        }
    });

    // 4. Controle GPS / Zoom - Canto Inferior Direito (Ícone de navegação igual ao print)
    L.Control.GpsZoom = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const btn = L.DomUtil.create('a', '', container);
            btn.href = '#';
            btn.title = 'Minha Localização';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:4px;background:#fff;width:30px;height:30px;';
            
            // Ícone de seta de navegação (igual ao print 2)
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="#2196F3" stroke="none">
                <path d="M12 2L4.5 20.3l.7.7L12 18l6.8 3 .7-.7z"/>
            </svg>`;
            
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(btn, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                if (lastKnownLocation) {
                    map.setView(lastKnownLocation, 16);
                } else {
                    map.locate({setView: true, maxZoom: 16, enableHighAccuracy: true});
                }
            });
            return container;
        }
    });
    new L.Control.GpsZoom({ position: 'bottomright' }).addTo(map);

    // 5. Botão para centralizar na feição do CAR - Canto Inferior Esquerdo
    L.Control.CenterCAR = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const btn = L.DomUtil.create('a', '', container);
            btn.href = '#';
            btn.title = 'Centralizar no Limite do CAR';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:4px;background:#fff;width:30px;height:30px;font-size:14px;';
            // Ícone de quadrado com seta (centralizar/enquadrar)
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
            </svg>`;
            
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(btn, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                // Pega todos os layers do carLayerGroup e faz fitBounds
                const layers = carLayerGroup.getLayers();
                if (layers.length > 0) {
                    const group = L.featureGroup(layers);
                    map.fitBounds(group.getBounds(), { padding: [30, 30] });
                }
            });
            return container;
        }
    });
    new L.Control.CenterCAR({ position: 'bottomleft' }).addTo(map);
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
