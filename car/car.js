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

    // Setup Map Controls (GPS and Fullscreen)
    setupMapControls();
}

let currentAppLayer = null;
let currentReservaLayer = null;

function setupMapControls() {
    // GPS
    const btnGps = document.getElementById('btn-gps');
    if (btnGps) {
        btnGps.addEventListener('click', () => {
            map.locate({setView: true, maxZoom: 16});
        });
        map.on('locationfound', function(e) {
            L.marker(e.latlng).addTo(map).bindPopup("Você está aqui!").openPopup();
            L.circle(e.latlng, e.accuracy).addTo(map);
        });
        map.on('locationerror', function(e) {
            alert("Não foi possível acessar a localização GPS: " + e.message);
        });
    }

    // Tela Cheia
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const mapDiv = document.getElementById('car-map');
    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                mapDiv.requestFullscreen().catch(err => {
                    alert(`Erro ao tentar entrar em tela cheia: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Toggle APP
    const toggleApp = document.getElementById('toggle-app');
    if (toggleApp) {
        toggleApp.addEventListener('change', function(e) {
            if (e.target.checked) {
                if (GEOPORTAL_LAYERS["APP"]) {
                    currentAppLayer = L.geoJSON(GEOPORTAL_LAYERS["APP"], {
                        style: { color: '#10b981', weight: 2, fillOpacity: 0.3 }, // Verde claro
                        interactive: true,
                        onEachFeature: function(f, l) { l.bindPopup("Área de Preservação Permanente (APP)"); }
                    }).addTo(map);
                } else {
                    alert("A camada de APP não está disponível nos dados atuais.");
                    e.target.checked = false;
                }
            } else if (currentAppLayer) {
                map.removeLayer(currentAppLayer);
                currentAppLayer = null;
            }
        });
    }

    // Toggle Reserva Legal
    const toggleReserva = document.getElementById('toggle-reserva');
    if (toggleReserva) {
        toggleReserva.addEventListener('change', function(e) {
            if (e.target.checked) {
                const layerData = GEOPORTAL_LAYERS["RESERVA_LEGAL"] || GEOPORTAL_LAYERS["RESERVA"];
                if (layerData) {
                    currentReservaLayer = L.geoJSON(layerData, {
                        style: { color: '#059669', weight: 2, fillOpacity: 0.3 }, // Verde escuro
                        interactive: true,
                        onEachFeature: function(f, l) { l.bindPopup("Reserva Legal"); }
                    }).addTo(map);
                } else {
                    alert("A camada de Reserva Legal não está disponível nos dados atuais.");
                    e.target.checked = false;
                }
            } else if (currentReservaLayer) {
                map.removeLayer(currentReservaLayer);
                currentReservaLayer = null;
            }
        });
    }
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
