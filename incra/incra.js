// car.js
let map;
let baseLayersGroup = L.layerGroup();
let incraLayerGroup = L.layerGroup();
let selectedFazendaCoords = null;
let allFazendas = [];

// Initialize Map
function initMap() {
    map = L.map('incra-map', {
        zoomControl: true,
        maxZoom: 20
    }).setView([-18.1, -40.1], 10);

    // Google Satellite Layer
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google'
    }).addTo(map);

    baseLayersGroup.addTo(map);
    incraLayerGroup.addTo(map);

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
let incraAppLayer = null;
let incraReservaLayer = null;
let lastIncraCodImovel = null;
let lastIncraUf = null;

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
            const mapDiv = document.getElementById('incra-map');
            const dashboardGrid = document.querySelector('.dashboard-grid');

            L.DomEvent.disableClickPropagation(container);
            btn.onclick = () => {
                isExpanded = !isExpanded;
                if (isExpanded) {
                    document.querySelector('.left-column').style.display = 'none';
                    dashboardGrid.style.gridTemplateColumns = '1fr';
                    mapDiv.style.height = 'calc(100vh - 80px)';
                    btn.title = 'Minimizar Mapa';
                    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 3H3v6"/><path d="M10 10L3 3"/>
                        <rect x="13" y="13" width="8" height="8" rx="1"/>
                    </svg>`;
                } else {
                    // Salvar centro e zoom ANTES de mudar o layout
                    const centro = map.getCenter();
                    const zoom = map.getZoom();
                    document.querySelector('.left-column').style.display = '';
                    dashboardGrid.style.gridTemplateColumns = '';
                    mapDiv.style.height = '';
                    btn.title = 'Expandir Mapa';
                    btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9V3h6"/>
                        <path d="M3 3l7 7"/>
                        <rect x="13" y="13" width="8" height="8" rx="1"/>
                    </svg>`;
                    // Restaurar centro/zoom após recalcular tamanho
                    setTimeout(() => { map.setView(centro, zoom, { animate: false }); }, 150);
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

    // ─── 5. Botão Centralizar no INCRA ─ Canto Inferior Direito ─────────────────
    L.Control.CenterINCRA = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', '');
            const btn = L.DomUtil.create('div', 'leaflet-bar', container);
            btn.style.cssText = btnStyle + 'margin:0;margin-right:10px;';
            btn.title = 'Centralizar no Limite do INCRA';
            // Ícone de enquadrar/zoom to fit
            btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffff00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            </svg>`;
            L.DomEvent.disableClickPropagation(container);
            btn.onclick = () => {
                const layers = incraLayerGroup.getLayers();
                if (layers.length > 0) {
                    map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [30, 30] });
                }
            };
            return container;
        }
    });
    new L.Control.CenterINCRA({ position: 'bottomright' }).addTo(map);
}



// Setup Farm Search Autocomplete
function setupFazendaSearch() {
    const input = document.getElementById('fazenda-select');
    const dropdown = document.getElementById('fazenda-dropdown');
    const btnBuscar = document.getElementById('btn-buscar-incra');

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

// Form Submit -> Fetch INCRA
document.getElementById('incra-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!selectedFazendaCoords) return;

    fetchINCRAData(selectedFazendaCoords[0], selectedFazendaCoords[1]);
});

// Fetch INCRA Data from Web (INCRA WFS)
async function fetchINCRAData(lon, lat) {
    const btnBuscar = document.getElementById('btn-buscar-incra');
    const loading = document.getElementById('loading-indicator');
    const infoPanel = document.getElementById('incra-info-panel');
    const infoContent = document.getElementById('incra-info-content');

    btnBuscar.disabled = true;
    loading.style.display = 'block';
    infoPanel.style.display = 'none';
    incraLayerGroup.clearLayers();

    try {
        const states = ['es', 'ba', 'mg'];
        const layers = ['certificada_sigef_particular', 'imoveiscertificados_privado'];
        let incraFeature = null;
        let foundUf = null;

        for (let uf of states) {
            for (let layer of layers) {
                const typeName = `${layer}_${uf}`;
                
                // INCRA WFS i3geo ignora cql_filter no WFS 1.0.0, então usamos BBOX com pequena tolerância
                const tol = 0.01;
                const bbox = `${lon-tol},${lat-tol},${lon+tol},${lat+tol}`;
                const wfsUrl = `https://acervofundiario.incra.gov.br/i3geo/ogc.php?tema=${typeName}&service=WFS&version=1.0.0&request=GetFeature&maxfeatures=1&bbox=${bbox}`;
                
                try {
                    const response = await fetch(wfsUrl);
                    if (!response.ok) continue;
                    
                    const xmlText = await response.text();
                    
                    // Parse GML to GeoJSON using Regex (cross-browser safe and robust for namespaces)
                    const coordsMatch = xmlText.match(/<gml:coordinates>([\s\S]*?)<\/gml:coordinates>/);
                    if (coordsMatch) {
                        const coordsStr = coordsMatch[1];
                        let coordinates = [];
                        
                        const rings = coordsStr.trim().split(" ");
                        coordinates = [rings.map(pair => {
                            const [cLon, cLat] = pair.split(",");
                            return [parseFloat(cLon), parseFloat(cLat)];
                        })];

                        const properties = {};
                        // Find all tags inside ms: (which are the feature properties)
                        const propMatches = xmlText.matchAll(/<ms:([^>]+)>([\s\S]*?)<\/ms:\1>/g);
                        for (const match of propMatches) {
                            if (match[1] !== 'msGeometry') {
                                properties[match[1]] = match[2].trim();
                            }
                        }

                        // Converter para GeoJSON Feature
                        incraFeature = {
                            type: "Feature",
                            properties: properties,
                            geometry: {
                                type: "Polygon",
                                coordinates: coordinates
                            }
                        };
                        foundUf = uf;
                        break;
                    }
                } catch (err) {
                    console.warn(`Erro ao buscar no INCRA (${typeName}):`, err);
                }
            }
            if (incraFeature) break;
        }

        if (incraFeature) {
            lastIncraCodImovel = incraFeature.properties.codigo_imovel || incraFeature.properties.cod_imovel_rural || null;
            lastIncraUf = foundUf;
            
            renderINCRAFeature(incraFeature);
        } else {
            infoPanel.style.display = 'block';
            infoContent.innerHTML = `
                <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #fca5a5; font-size: 14px; line-height: 1.5; text-align: center;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px; color: #ef4444;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <br>
                    Não foi possível encontrar o limite do INCRA (SIGEF/Acervo) para esta localização. Pode não haver georreferenciamento registrado ou o servidor está fora do ar.
                </div>
            `;
        }

    } catch (error) {
        console.error("Erro geral ao buscar dados do INCRA:", error);
        infoPanel.style.display = 'block';
        infoContent.innerHTML = `
            <div style="padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #fca5a5; font-size: 14px; line-height: 1.5; text-align: center;">
                Ocorreu um erro de rede ao buscar os limites do INCRA.
            </div>
        `;
    } finally {
        btnBuscar.disabled = false;
        loading.style.display = 'none';
    }
}

function renderINCRAFeature(feature) {
    const infoPanel = document.getElementById('incra-info-panel');
    const infoContent = document.getElementById('incra-info-content');

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
            layer.bindPopup(`<strong>INCRA:</strong> ${props.nome_imovel || props.nome_area || 'Área Certificada'}`);
            
            // Evento de clique para abrir painel lateral com atributos completos
            layer.on('click', function() {
                infoPanel.style.display = 'block';
                
                const formatArea = (area) => {
                    if (!area) return 'N/A';
                    return parseFloat(area).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ha';
                };

                infoContent.innerHTML = `
                    <div class="incra-info-item">
                        <strong>Nome do Imóvel:</strong>
                        <span>${props.nome_imovel || props.nome_area || 'N/A'}</span>
                    </div>
                    <div class="incra-info-item">
                        <strong>Código INCRA / SIGEF:</strong>
                        <span>${props.cod_imovel_rural || props.codigo_imovel || 'N/A'}</span>
                    </div>
                    <div class="incra-info-item">
                        <strong>Município:</strong>
                        <span>${props.municipio || props.nome_municipio || 'N/A'} - ${props.uf || 'N/A'}</span>
                    </div>
                    <div class="incra-info-item">
                        <strong>Detentor:</strong>
                        <span>${props.nome_detentor || props.detentor || 'N/A'}</span>
                    </div>
                    <div class="incra-info-item">
                        <strong>Nº Certificação:</strong>
                        <span>${props.num_certificacao || 'N/A'}</span>
                    </div>
                    <div class="incra-info-item">
                        <strong>Área:</strong>
                        <span>${formatArea(props.qtd_area_peca_tecnica || props.area_ha || props.area)}</span>
                    </div>
                `;
            });
        }
    }).addTo(incraLayerGroup);

    // Ajustar zoom para a feição do INCRA
    map.fitBounds(carGeoJSON.getBounds(), { padding: [30, 30] });
    
    // Abre popup do limite do INCRA automaticamente
    carGeoJSON.getLayers()[0].fire('click');

    // Rola a tela suavemente para as informações do INCRA em dispositivos móveis
    setTimeout(() => {
        infoPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Inicializar na carga da página
window.onload = initMap;
