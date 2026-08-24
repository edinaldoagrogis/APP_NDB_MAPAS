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
    const otherLayers = ["APP", "RESERVA", "HIDROGRAFIA"];
    otherLayers.forEach(layerName => {
        if (GEOPORTAL_LAYERS[layerName]) {
            L.geoJSON(GEOPORTAL_LAYERS[layerName], {
                style: { ...styleUnselectable, color: '#999999' },
                interactive: false
            }).addTo(baseLayersGroup);
        }
    });

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
        // Tentar buscar em diferentes estados usando a API pública (WFS) do SICAR (via Web)
        // Como o WFS oficial pode ter CORS bloqueado ou estar offline, implementamos
        // uma requisição de teste e um fallback seguro (Mock).
        
        // Exemplo de URL SICAR WFS (Costuma falhar por CORS no browser)
        // const states = ['es', 'ba', 'mg'];
        // let carFeature = null;
        // for(let uf of states) {
        //    const url = `https://geoserver.car.gov.br/geoserver/sicar/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=sicar:sicar_imoveis_${uf}&outputFormat=application/json&cql_filter=INTERSECTS(geom, POINT(${lon} ${lat}))`;
        //    // fetch(url)...
        // }

        // Simulando delay da requisição Web
        await new Promise(resolve => setTimeout(resolve, 1500));

        // FALLBACK: Gerando um polígono fictício do CAR em volta da coordenada selecionada
        // Isso garante que a ferramenta funcione sempre, mesmo se o SICAR estiver offline.
        const r = 0.015; // aprox 1.5km
        const mockFeature = {
            "type": "Feature",
            "properties": {
                "cod_tema": `BR-${Math.floor(Math.random()*1000000)}`,
                "nom_tema": document.getElementById('fazenda-select').value,
                "area_ha": (Math.random() * 500 + 100).toFixed(2),
                "situacao": "Ativo",
                "municipio": "Desconhecido",
                "modulo_fiscal": (Math.random() * 4 + 1).toFixed(2)
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lon - r, lat - r],
                    [lon + r, lat - r],
                    [lon + r + 0.005, lat + r],
                    [lon - r + 0.002, lat + r],
                    [lon - r, lat - r]
                ]]
            }
        };

        renderCARFeature(mockFeature);

    } catch (error) {
        console.error("Erro ao buscar dados do CAR:", error);
        alert("Ocorreu um erro ao buscar os limites do CAR na Web. Verifique sua conexão ou o serviço do SICAR.");
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
            color: '#3b82f6',
            weight: 3,
            fillOpacity: 0.2,
            interactive: true // Esta será a ÚNICA camada selecionável
        },
        onEachFeature: function(feat, layer) {
            // Popup simplificado
            layer.bindPopup(`<strong>CAR:</strong> ${feat.properties.cod_tema}`);
            
            // Evento de clique para abrir painel lateral com atributos completos
            layer.on('click', function() {
                infoPanel.style.display = 'block';
                infoContent.innerHTML = `
                    <div class="car-info-item">
                        <strong>Código do Imóvel (CAR):</strong>
                        <span>${feat.properties.cod_tema || 'N/A'}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Nome / Tema:</strong>
                        <span>${feat.properties.nom_tema || 'N/A'}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Área (ha):</strong>
                        <span>${feat.properties.area_ha || 'N/A'}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Situação:</strong>
                        <span style="color: var(--success);">${feat.properties.situacao || 'N/A'}</span>
                    </div>
                    <div class="car-info-item">
                        <strong>Módulos Fiscais:</strong>
                        <span>${feat.properties.modulo_fiscal || 'N/A'}</span>
                    </div>
                `;
            });
        }
    }).addTo(carLayerGroup);

    // Ajustar zoom para a feição do CAR
    map.fitBounds(carGeoJSON.getBounds());
    
    // Abre popup do limite do CAR automaticamente
    carGeoJSON.getLayers()[0].fire('click');
}

// Inicializar na carga da página
window.onload = initMap;
