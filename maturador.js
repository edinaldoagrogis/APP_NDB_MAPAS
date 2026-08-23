/**
 * Módulo de Monitoramento de Maturação - AgroGIS
 * Processamento de dados STAC (Sentinel-2) e Modelagem de Curva de Maturação
 */

// Configurações do STAC e da API
const STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search";

// Variáveis Globais de Estado
let map = null;
let talhaoLayer = null;
let maturationChart = null;

// Inicialização da Página
document.addEventListener('DOMContentLoaded', () => {
    // Definir Dt para hoje, e D0 para 30 dias atrás por padrão
    const today = new Date();
    const d0 = new Date();
    d0.setDate(today.getDate() - 30);
    
    document.getElementById('date-dt').valueAsDate = today;
    document.getElementById('date-d0').valueAsDate = d0;
    
    // Inicializar o Mapa
    initMap();
    
    // Carregar lista de fazendas no Datalist
    populateFazendasDatalist();
    
    // Bind do form
    document.getElementById('maturation-form').addEventListener('submit', handleProcessAnalysis);
});

/**
 * Preenche o Datalist com as fazendas disponíveis no GEOPORTAL_LAYERS
 */
function populateFazendasDatalist() {
    const datalist = document.getElementById('talhao-datalist');
    
    if (typeof GEOPORTAL_LAYERS !== 'undefined') {
        const addedNames = new Set();
        
        // Nomes de Fazendas via TALHOES
        if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
            GEOPORTAL_LAYERS["TALHOES"].features.forEach(feature => {
                const props = feature.properties;
                const nomeFaz = props.NOME_FAZ || props.NAME || props.Name;
                if (nomeFaz && !addedNames.has(nomeFaz)) {
                    addedNames.add(nomeFaz);
                    const option = document.createElement('option');
                    option.value = nomeFaz;
                    datalist.appendChild(option);
                }
            });
        }
        
        // Fazendas (fallback)
        if (GEOPORTAL_LAYERS["FAZENDAS"] && GEOPORTAL_LAYERS["FAZENDAS"].features) {
            GEOPORTAL_LAYERS["FAZENDAS"].features.forEach(feature => {
                const props = feature.properties;
                const name = props.NOME_FAZ || props.NAME || props.Name || props.name;
                if (name && !addedNames.has(name)) {
                    addedNames.add(name);
                    const option = document.createElement('option');
                    option.value = name;
                    datalist.appendChild(option);
                }
            });
        }
    }
}

/**
 * Listener de mudança na Fazenda - popula a lista de talhões
 */

// ============================================================
// BUSCA CUSTOMIZADA: dropdown que funciona no Android
// ============================================================

const removeAcentos = (str) =>
    String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

let fazendaSearchTimeout = null;

document.getElementById('talhao-select').addEventListener('input', function(e) {
    clearTimeout(fazendaSearchTimeout);
    fazendaSearchTimeout = setTimeout(() => doFazendaSearch(e.target.value), 150);
});

document.getElementById('talhao-select').addEventListener('focus', function() {
    if (this.value.trim().length >= 1) doFazendaSearch(this.value);
});

document.addEventListener('click', function(e) {
    if (!e.target.closest('#talhao-select') && !e.target.closest('#fazenda-dropdown')) {
        document.getElementById('fazenda-dropdown').style.display = 'none';
    }
});

function doFazendaSearch(query) {
    const dropdown = document.getElementById('fazenda-dropdown');
    const q = removeAcentos(query);
    
    if (q.length < 1) {
        dropdown.style.display = 'none';
        return;
    }
    
    if (typeof GEOPORTAL_LAYERS === 'undefined') {
        dropdown.innerHTML = '<div style="padding:10px; color:#94a3b8;">Carregando dados...</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    const seen = new Set();
    const results = [];
    
    // Busca em TALHOES (coleta nomes unicos de fazenda)
    if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
        GEOPORTAL_LAYERS["TALHOES"].features.forEach(f => {
            const nome = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || '');
            if (nome && removeAcentos(nome).includes(q) && !seen.has(nome)) {
                seen.add(nome);
                results.push(nome);
            }
        });
    }
    
    // Busca em FAZENDAS (fallback)
    if (GEOPORTAL_LAYERS["FAZENDAS"] && GEOPORTAL_LAYERS["FAZENDAS"].features) {
        GEOPORTAL_LAYERS["FAZENDAS"].features.forEach(f => {
            const nome = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || f.properties.name || '');
            if (nome && removeAcentos(nome).includes(q) && !seen.has(nome)) {
                seen.add(nome);
                results.push(nome);
            }
        });
    }
    
    results.sort();
    dropdown.innerHTML = '';
    
    if (results.length === 0) {
        dropdown.innerHTML = '<div style="padding:10px; color:#94a3b8;">Nenhuma fazenda encontrada</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    results.slice(0, 30).forEach(nome => {
        const item = document.createElement('div');
        item.textContent = nome;
        item.style.cssText = 'padding:10px 14px; cursor:pointer; color:#e2e8f0; font-size:14px; border-bottom:1px solid rgba(255,255,255,0.05);';
        
        const selectFazenda = () => {
            document.getElementById('talhao-select').value = nome;
            dropdown.style.display = 'none';
            populateTalhoes(nome);
        };
        
        item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.1)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('mousedown', (ev) => { ev.preventDefault(); });
        item.addEventListener('click', selectFazenda);
        item.addEventListener('touchend', (ev) => { ev.preventDefault(); selectFazenda(); });
        dropdown.appendChild(item);
    });
    
    dropdown.style.display = 'block';
}

function populateTalhoes(fazendaNome) {
    const talhoesContainer = document.getElementById('talhoes-container');
    const talhoesList = document.getElementById('talhoes-list');
    
    if (!fazendaNome || typeof GEOPORTAL_LAYERS === 'undefined') {
        talhoesContainer.style.display = 'none';
        return;
    }
    
    const qFaz = removeAcentos(fazendaNome);
    let foundTalhoes = [];
    
    if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
        GEOPORTAL_LAYERS["TALHOES"].features.forEach((f, idx) => {
            const nome = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || '');
            if (removeAcentos(nome) === qFaz) {
                foundTalhoes.push({ feature: f, globalIndex: idx, props: f.properties, nomeFaz: nome });
            }
        });
    }
    
    if (foundTalhoes.length > 0) {
        talhoesContainer.style.display = 'block';
        talhoesList.innerHTML = '';
        
        foundTalhoes.sort((a, b) => {
            const codA = String(a.props.COD_TALHAO || a.props.TALHAO || '');
            const codB = String(b.props.COD_TALHAO || b.props.TALHAO || '');
            return codA.localeCompare(codB, undefined, {numeric: true, sensitivity: 'base'});
        });
        
        foundTalhoes.forEach(item => {
            const codTal = item.props.COD_TALHAO || item.props.TALHAO || 'S/ID';
            const area = item.props.AREA ? ' (' + item.props.AREA + ' ha)' : '';
            const div = document.createElement('div');
            div.style.marginBottom = '6px';
            div.innerHTML = `
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-size:13px; color:#e2e8f0;">
                    <input type="checkbox" class="talhao-checkbox" value="${item.globalIndex}" checked style="width:16px;height:16px;">
                    <span>Talh\u00e3o <strong>${codTal}</strong>${area}</span>
                </label>
            `;
            talhoesList.appendChild(div);
        });
        
        document.getElementById('select-all-talhoes').checked = true;
    } else {
        talhoesContainer.style.display = 'none';
    }
}

// Checkbox "Selecionar Todos"
document.getElementById('select-all-talhoes').addEventListener('change', function(e) {
    document.querySelectorAll('.talhao-checkbox').forEach(cb => cb.checked = e.target.checked);
});

function populateFazendasDatalist() {
    const datalist = document.getElementById('talhao-datalist');
    
    if (typeof GEOPORTAL_LAYERS !== 'undefined') {
        const addedNames = new Set();
        
        // Nomes de Fazendas via TALHOES
        if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
            GEOPORTAL_LAYERS["TALHOES"].features.forEach(feature => {
                const props = feature.properties;
                const nomeFaz = props.NOME_FAZ || props.NAME || props.Name;
                if (nomeFaz && !addedNames.has(nomeFaz)) {
                    addedNames.add(nomeFaz);
                    const option = document.createElement('option');
                    option.value = nomeFaz;
                    datalist.appendChild(option);
                }
            });
        }
        
        // Fazendas (fallback)
        if (GEOPORTAL_LAYERS["FAZENDAS"] && GEOPORTAL_LAYERS["FAZENDAS"].features) {
            GEOPORTAL_LAYERS["FAZENDAS"].features.forEach(feature => {
                const props = feature.properties;
                const name = props.NOME_FAZ || props.NAME || props.Name || props.name;
                if (name && !addedNames.has(name)) {
                    addedNames.add(name);
                    const option = document.createElement('option');
                    option.value = name;
                    datalist.appendChild(option);
                }
            });
        }
    }
}

/**
 * Listener de mudança na Fazenda - popula a lista de talhões
 */
document.getElementById('talhao-select').addEventListener('input', function(e) {
    const searchString = String(e.target.value).trim().toLowerCase();
    
    // Função para remover acentos
    // (global removeAcentos used)
        return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    };
    
    const searchNormalized = removeAcentos(searchString);
    
    const talhoesContainer = document.getElementById('talhoes-container');
    const talhoesList = document.getElementById('talhoes-list');
    
    if (searchNormalized.length < 2 || typeof GEOPORTAL_LAYERS === 'undefined') {
        talhoesContainer.style.display = 'none';
        return;
    }
    
    let foundTalhoes = [];
    if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
        GEOPORTAL_LAYERS["TALHOES"].features.forEach((f, index) => {
            const props = f.properties;
            const nomeFaz = String(props.NOME_FAZ || props.NAME || props.Name || "");
            const nomeFazNormalized = removeAcentos(nomeFaz);
            
            // Busca estilo substring, ignorando acentos!
            if (nomeFazNormalized.includes(searchNormalized) || nomeFaz.toLowerCase().includes(searchString)) {
                foundTalhoes.push({ feature: f, globalIndex: index, props: props, nomeFaz: nomeFaz });
            }
        });
    }
    
    if (foundTalhoes.length > 0) {
        talhoesContainer.style.display = 'block';
        talhoesList.innerHTML = ''; 
        
        foundTalhoes.sort((a, b) => {
            const codA = String(a.props.COD_TALHAO || a.props.TALHAO || '');
            const codB = String(b.props.COD_TALHAO || b.props.TALHAO || '');
            const nameCmp = a.nomeFaz.localeCompare(b.nomeFaz);
            if (nameCmp !== 0) return nameCmp;
            return codA.localeCompare(codB, undefined, {numeric: true, sensitivity: 'base'});
        });
        
        foundTalhoes.forEach((item) => {
            const codTal = item.props.COD_TALHAO || item.props.TALHAO || `S/ID`;
            const div = document.createElement('div');
            div.style.marginBottom = '5px';
            div.innerHTML = `
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" class="talhao-checkbox" value="${item.globalIndex}" checked>
                    ${item.nomeFaz} - Talhão ${codTal}
                </label>
            `;
            talhoesList.appendChild(div);
        });
    } else {
        talhoesContainer.style.display = 'none';
    }
});
    }
    
    if (foundTalhoes.length > 0) {
        talhoesContainer.style.display = 'block';
        talhoesList.innerHTML = ''; 
        
        foundTalhoes.sort((a, b) => {
            const codA = String(a.properties.COD_TALHAO || a.properties.TALHAO || '');
            const codB = String(b.properties.COD_TALHAO || b.properties.TALHAO || '');
            return codA.localeCompare(codB, undefined, {numeric: true, sensitivity: 'base'});
        });
        
        foundTalhoes.forEach((f, idx) => {
            const props = f.properties;
            const codTal = props.COD_TALHAO || props.TALHAO || `SemID-${idx}`;
            
            const div = document.createElement('div');
            div.style.marginBottom = '5px';
            div.innerHTML = `
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px;">
                    <input type="checkbox" class="talhao-checkbox" value="${codTal}" checked>
                    Talhão ${codTal}
                </label>
            `;
            talhoesList.appendChild(div);
        });
    } else {
        talhoesContainer.style.display = 'none';
    }
});

// Checkbox "Selecionar Todos"
document.getElementById('select-all-talhoes').addEventListener('change', function(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('.talhao-checkbox');
    checkboxes.forEach(cb => cb.checked = isChecked);
});

/**
 * Retorna FeatureCollection combinando todos os talhões selecionados,
 * ou o polígono/ponto da fazenda se nenhum talhão estiver disponível
 */
function getSelectedGeometry() {
    const searchString = document.getElementById('talhao-select').value;
    const checkboxes = document.querySelectorAll('.talhao-checkbox:checked');
    
    let features = [];
    
    // Se o usuário selecionou talhões via checkboxes (usa os IDs globais)
    if (checkboxes.length > 0 && typeof GEOPORTAL_LAYERS !== 'undefined' && GEOPORTAL_LAYERS["TALHOES"]) {
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
        selectedIndices.forEach(idx => {
            if (GEOPORTAL_LAYERS["TALHOES"].features[idx]) {
                features.push(GEOPORTAL_LAYERS["TALHOES"].features[idx]);
            }
        });
    }
    
    if (features.length > 0) {
        return {
            "type": "FeatureCollection",
            "features": features
        };
    }
    
    // Fallback: Apenas a fazenda em ponto se não houver talhões mas houver match na camada FAZENDAS
    if (typeof GEOPORTAL_LAYERS !== 'undefined' && GEOPORTAL_LAYERS["FAZENDAS"]) {
        // removed local - using global removeAcentos
// // (global removeAcentos used)
        const searchNormalized = removeAcentos(searchString);
        
        let feat = GEOPORTAL_LAYERS["FAZENDAS"].features.find(f => {
            const props = f.properties;
            const name = String(props.NOME_FAZ || props.NAME || props.Name || props.name || "");
            return removeAcentos(name).includes(searchNormalized);
        });
        
        if (feat) {
            if (feat.geometry.type === "Point") {
                const coord = feat.geometry.coordinates;
                const offset = 0.005; // ~500m
                return {
                    "type": "FeatureCollection",
                    "features": [{
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[
                                [coord[0] - offset, coord[1] - offset],
                                [coord[0] + offset, coord[1] - offset],
                                [coord[0] + offset, coord[1] + offset],
                                [coord[0] - offset, coord[1] + offset],
                                [coord[0] - offset, coord[1] - offset]
                            ]]
                        }
                    }]
                };
            }
            return {
                "type": "FeatureCollection",
                "features": [feat]
            };
        }
    }
    
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-48.50, -22.50], [-48.51, -22.50], [-48.51, -22.51], [-48.50, -22.51], [-48.50, -22.50]
                ]]
            }
        }]
    };
}
let rasterLayer = null;

function renderTalhaoOnMap(geojson) {
    if (talhaoLayer) map.removeLayer(talhaoLayer);
    if (rasterLayer) map.removeLayer(rasterLayer);
    
    talhaoLayer = L.geoJSON(geojson, {
        style: {
            fillColor: "transparent",
            weight: 3,
            color: '#fff',
            dashArray: '5',
            fillOpacity: 0
        }
    }).addTo(map);
    
    const bounds = talhaoLayer.getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
    
    const imgDataUrl = generateSimulatedNDRERaster(bounds, geojson);
    
    if (imgDataUrl) {
        rasterLayer = L.imageOverlay(imgDataUrl, bounds, {
            opacity: 0.7,
            alt: "NDRE Raster Simulado"
        }).addTo(map);
    }
}

/**
 * Gera um raster PNG em base64 simulando pixels de 10m do Sentinel-2 (Gradiente NDRE)
 */
function generateSimulatedNDRERaster(bounds, geojson) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    const latMin = bounds.getSouth();
    const latMax = bounds.getNorth();
    const lngMin = bounds.getWest();
    const lngMax = bounds.getEast();
    
    const latDiff = latMax - latMin;
    const lngDiff = lngMax - lngMin;
    
    if (latDiff === 0 || lngDiff === 0) return null;
    
    function project(coord) {
        const x = ((coord[0] - lngMin) / lngDiff) * canvas.width;
        const y = ((latMax - coord[1]) / latDiff) * canvas.height;
        return [x, y];
    }
    
    function drawRing(ring) {
        ring.forEach((coord, i) => {
            const [x, y] = project(coord);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    }
    
    ctx.beginPath();
    
    const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    let hasDrawableGeometry = false;
    
    features.forEach(feat => {
        const geom = feat.geometry || feat;
        if (geom.type === 'Polygon') {
            hasDrawableGeometry = true;
            geom.coordinates.forEach(ring => drawRing(ring));
        } else if (geom.type === 'MultiPolygon') {
            hasDrawableGeometry = true;
            geom.coordinates.forEach(polygon => polygon.forEach(ring => drawRing(ring)));
        } else if (geom.type === 'LineString') {
            hasDrawableGeometry = true;
            drawRing(geom.coordinates);
        } else if (geom.type === 'MultiLineString') {
            hasDrawableGeometry = true;
            geom.coordinates.forEach(line => drawRing(line));
        }
    });
    
    if (!hasDrawableGeometry) return null;
    
    ctx.closePath();
    ctx.clip('evenodd'); 
    
    for (let x = 0; x < canvas.width; x += 3) {
        for (let y = 0; y < canvas.height; y += 3) {
            const distToCenter = Math.sqrt(Math.pow(x - (canvas.width/2), 2) + Math.pow(y - (canvas.height/2), 2));
            let baseProb = 1 - (distToCenter / (canvas.width/1.2)); 
            baseProb += (Math.random() * 0.5 - 0.25);
            
            let color;
            if (baseProb > 0.7) color = '#2ecc71'; 
            else if (baseProb > 0.4) color = '#f1c40f'; 
            else if (baseProb > 0.2) color = '#e67e22'; 
            else color = '#e74c3c'; 
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 3, 3);
        }
    }
    
    return canvas.toDataURL('image/png');
}
