/**
 * Módulo de Monitoramento de Maturação - AgroGIS
 */

// Variáveis Globais
const STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
let map = null;
let talhaoLayer = null;
let rasterLayer = null;
let maturationChart = null;

// Função utilitária para remover acentos e normalizar texto
function removeAcentos(str) {
    return String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Datas padrão
    const today = new Date();
    const d0 = new Date();
    d0.setDate(today.getDate() - 30);
    document.getElementById('date-dt').valueAsDate = today;
    document.getElementById('date-d0').valueAsDate = d0;

    // Mapa
    initMap();

    // Bind do form
    document.getElementById('maturation-form').addEventListener('submit', handleProcessAnalysis);

    // Busca de fazenda - input com debounce
    const inputFazenda = document.getElementById('talhao-select');
    let searchTimeout = null;
    inputFazenda.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => doFazendaSearch(this.value), 200);
    });
    inputFazenda.addEventListener('focus', function() {
        if (this.value.trim().length >= 1) doFazendaSearch(this.value);
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#talhao-select') && !e.target.closest('#fazenda-dropdown')) {
            const dd = document.getElementById('fazenda-dropdown');
            if (dd) dd.style.display = 'none';
        }
    });

    // Selecionar todos os talhoes
    document.getElementById('select-all-talhoes').addEventListener('change', function() {
        document.querySelectorAll('.talhao-checkbox').forEach(cb => cb.checked = this.checked);
    });
});

// ============================================================
// BUSCA CUSTOMIZADA DE FAZENDA
// ============================================================
function doFazendaSearch(query) {
    const dropdown = document.getElementById('fazenda-dropdown');
    if (!dropdown) return;

    const q = removeAcentos(query);

    if (q.length < 1) {
        dropdown.style.display = 'none';
        return;
    }

    if (typeof GEOPORTAL_LAYERS === 'undefined') {
        dropdown.innerHTML = '<div style="padding:10px;color:#94a3b8;">Carregando dados...</div>';
        dropdown.style.display = 'block';
        return;
    }

    const seen = new Set();
    const results = [];

    if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
        GEOPORTAL_LAYERS["TALHOES"].features.forEach(f => {
            const nome = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || '');
            if (nome && removeAcentos(nome).includes(q) && !seen.has(nome)) {
                seen.add(nome);
                results.push(nome);
            }
        });
    }

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
        dropdown.innerHTML = '<div style="padding:10px;color:#94a3b8;">Nenhuma fazenda encontrada</div>';
        dropdown.style.display = 'block';
        return;
    }

    results.slice(0, 30).forEach(nome => {
        const item = document.createElement('div');
        item.textContent = nome;
        item.style.cssText = 'padding:10px 14px;cursor:pointer;color:#e2e8f0;font-size:14px;border-bottom:1px solid rgba(255,255,255,0.06);';

        const selectFazenda = () => {
            document.getElementById('talhao-select').value = nome;
            dropdown.style.display = 'none';
            populateTalhoes(nome);
        };

        item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.1)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('mousedown', ev => ev.preventDefault());
        item.addEventListener('click', selectFazenda);
        item.addEventListener('touchend', ev => { ev.preventDefault(); selectFazenda(); });

        dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
}

// ============================================================
// POPULAR TALHOES COM CHECKBOXES
// ============================================================
function populateTalhoes(fazendaNome) {
    const container = document.getElementById('talhoes-container');
    const lista = document.getElementById('talhoes-list');
    if (!container || !lista) return;

    if (!fazendaNome || typeof GEOPORTAL_LAYERS === 'undefined') {
        container.style.display = 'none';
        return;
    }

    const qFaz = removeAcentos(fazendaNome);
    const found = [];

    if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
        GEOPORTAL_LAYERS["TALHOES"].features.forEach((f, idx) => {
            const nome = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || '');
            if (removeAcentos(nome) === qFaz) {
                found.push({ idx, props: f.properties });
            }
        });
    }

    if (found.length === 0) {
        container.style.display = 'none';
        return;
    }

    found.sort((a, b) => {
        const codA = String(a.props.COD_TALHAO || a.props.TALHAO || '');
        const codB = String(b.props.COD_TALHAO || b.props.TALHAO || '');
        return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
    });

    lista.innerHTML = '';
    found.forEach(item => {
        const cod = item.props.COD_TALHAO || item.props.TALHAO || 'S/ID';
        const area = item.props.AREA ? ' (' + item.props.AREA + ' ha)' : '';
        const div = document.createElement('div');
        div.style.marginBottom = '6px';
        div.innerHTML =
            '<label style="cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;color:#e2e8f0;">' +
            '<input type="checkbox" class="talhao-checkbox" value="' + item.idx + '" checked style="width:16px;height:16px;">' +
            '<span>Talh\u00e3o <strong>' + cod + '</strong>' + area + '</span>' +
            '</label>';
        lista.appendChild(div);
    });

    document.getElementById('select-all-talhoes').checked = true;
    container.style.display = 'block';
}

// ============================================================
// OBTER GEOMETRIA DOS TALHOES SELECIONADOS
// ============================================================
function getSelectedGeometry() {
    const fazendaNome = document.getElementById('talhao-select').value;
    const checkboxes = document.querySelectorAll('.talhao-checkbox:checked');
    let features = [];

    if (checkboxes.length > 0 && typeof GEOPORTAL_LAYERS !== 'undefined' && GEOPORTAL_LAYERS["TALHOES"]) {
        Array.from(checkboxes).forEach(cb => {
            const idx = parseInt(cb.value);
            if (!isNaN(idx) && GEOPORTAL_LAYERS["TALHOES"].features[idx]) {
                features.push(GEOPORTAL_LAYERS["TALHOES"].features[idx]);
            }
        });
    }

    if (features.length > 0) {
        return { type: "FeatureCollection", features: features };
    }

    // Fallback ponto
    if (typeof GEOPORTAL_LAYERS !== 'undefined' && GEOPORTAL_LAYERS["FAZENDAS"]) {
        const q = removeAcentos(fazendaNome);
        const feat = GEOPORTAL_LAYERS["FAZENDAS"].features.find(f => {
            const nome = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || f.properties.name || '');
            return removeAcentos(nome).includes(q);
        });
        if (feat && feat.geometry.type === "Point") {
            const lng = feat.geometry.coordinates[0];
            const lat = feat.geometry.coordinates[1];
            const off = 0.005;
            return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[lng-off,lat-off],[lng+off,lat-off],[lng+off,lat+off],[lng-off,lat+off],[lng-off,lat-off]]] } }] };
        }
    }

    return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[-48.50,-22.50],[-48.51,-22.50],[-48.51,-22.51],[-48.50,-22.51],[-48.50,-22.50]]] } }] };
}

// ============================================================
// MAPA LEAFLET
// ============================================================
function initMap() {
    map = L.map('map-container', { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    map.setView([-18.5, -40.0], 10);
}

function renderTalhaoOnMap(geojson) {
    if (talhaoLayer) map.removeLayer(talhaoLayer);
    if (rasterLayer) map.removeLayer(rasterLayer);

    talhaoLayer = L.geoJSON(geojson, {
        style: { fillColor: "transparent", weight: 3, color: '#fff', dashArray: '5', fillOpacity: 0 }
    }).addTo(map);

    const bounds = talhaoLayer.getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });

    const imgDataUrl = generateSimulatedNDRERaster(bounds, geojson);
    if (imgDataUrl) {
        rasterLayer = L.imageOverlay(imgDataUrl, bounds, { opacity: 0.75 }).addTo(map);
    }
}

// ============================================================
// RASTER SIMULADO
// ============================================================
function generateSimulatedNDRERaster(bounds, geojson) {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    const latMin = bounds.getSouth(), latMax = bounds.getNorth();
    const lngMin = bounds.getWest(), lngMax = bounds.getEast();
    const latDiff = latMax - latMin, lngDiff = lngMax - lngMin;
    if (latDiff === 0 || lngDiff === 0) return null;

    function project(coord) {
        return [
            ((coord[0] - lngMin) / lngDiff) * canvas.width,
            ((latMax - coord[1]) / latDiff) * canvas.height
        ];
    }

    function drawRing(ring) {
        ring.forEach((coord, i) => {
            const pt = project(coord);
            i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1]);
        });
    }

    ctx.beginPath();
    const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    let hasGeom = false;

    features.forEach(feat => {
        const geom = feat.geometry || feat;
        if (geom.type === 'Polygon') { hasGeom = true; geom.coordinates.forEach(drawRing); }
        else if (geom.type === 'MultiPolygon') { hasGeom = true; geom.coordinates.forEach(function(p) { p.forEach(drawRing); }); }
    });

    if (!hasGeom) return null;
    ctx.closePath();
    ctx.clip('evenodd');

    for (let x = 0; x < canvas.width; x += 3) {
        for (let y = 0; y < canvas.height; y += 3) {
            const d = Math.sqrt(Math.pow(x - canvas.width/2, 2) + Math.pow(y - canvas.height/2, 2));
            const v = 1 - (d / (canvas.width / 1.2)) + (Math.random() * 0.5 - 0.25);
            ctx.fillStyle = v > 0.7 ? '#2ecc71' : v > 0.4 ? '#f1c40f' : v > 0.2 ? '#e67e22' : '#e74c3c';
            ctx.fillRect(x, y, 3, 3);
        }
    }
    return canvas.toDataURL('image/png');
}

// ============================================================
// PROCESSAMENTO DA ANÁLISE
// ============================================================
async function handleProcessAnalysis(e) {
    e.preventDefault();

    const fazendaNome = document.getElementById('talhao-select').value.trim();
    if (!fazendaNome) { alert('Selecione uma fazenda primeiro.'); return; }

    const d0 = document.getElementById('date-d0').value;
    const dt = document.getElementById('date-dt').value;
    if (!d0 || !dt) { alert('Preencha as datas.'); return; }

    document.getElementById('loading-indicator').style.display = 'flex';
    document.getElementById('btn-analyze').disabled = true;

    try {
        const geojson = getSelectedGeometry();
        renderTalhaoOnMap(geojson);
        await simulateAnalysis(d0, dt);
    } catch (err) {
        console.error(err);
        alert('Erro ao processar: ' + err.message);
    } finally {
        document.getElementById('loading-indicator').style.display = 'none';
        document.getElementById('btn-analyze').disabled = false;
    }
}

async function simulateAnalysis(d0Str, dtStr) {
    await new Promise(r => setTimeout(r, 800));

    const d0 = new Date(d0Str);
    const dt = new Date(dtStr);
    const daysElapsed = Math.round((dt - d0) / (1000 * 60 * 60 * 24));

    const ndreBase = 0.45 + Math.random() * 0.1;
    const reductionRate = 0.008 + Math.random() * 0.004;
    const ndreCurrent = Math.max(0.1, ndreBase - reductionRate * daysElapsed);
    const deltaNDRE = ((ndreBase - ndreCurrent) / ndreBase * 100).toFixed(1);
    const daysToOptimal = Math.round((ndreBase - 0.15) / reductionRate);
    const daysRemaining = Math.max(0, daysToOptimal - daysElapsed);
    const percentage = Math.min(100, Math.round((daysElapsed / daysToOptimal) * 100));

    let status = 'Em Maturacao';
    let badgeClass = 'status-maturing';
    if (percentage >= 85) { status = 'Pronto para Colheita'; badgeClass = 'status-ready'; }
    else if (percentage <= 30) { status = 'Inicio de Maturacao'; badgeClass = 'status-early'; }

    document.getElementById('status-badge').textContent = status;
    document.getElementById('status-badge').className = 'badge ' + badgeClass;
    document.getElementById('percentage-value').textContent = percentage + '%';
    document.getElementById('days-elapsed').textContent = daysElapsed + ' dias';
    document.getElementById('ndre-base').textContent = ndreBase.toFixed(3);
    document.getElementById('ndre-current').textContent = ndreCurrent.toFixed(3);
    document.getElementById('ndre-delta').textContent = '-' + deltaNDRE + '%';
    document.getElementById('days-remaining').textContent = daysRemaining > 0 ? daysRemaining + ' dias' : 'Atingido';
    document.getElementById('diagnostic-result').style.display = 'block';
    document.getElementById('diagnostic-empty').style.display = 'none';

    renderChart(d0, daysToOptimal, ndreBase, reductionRate, daysElapsed);
}

function renderChart(d0, daysTotal, ndreBase, rate, daysElapsed) {
    const labels = [], theoretical = [], measured = [];
    for (let d = 0; d <= daysTotal + 10; d += 5) {
        const date = new Date(d0);
        date.setDate(date.getDate() + d);
        labels.push(date.toLocaleDateString('pt-BR'));
        theoretical.push(+(Math.max(0.1, ndreBase - rate * d)).toFixed(3));
        measured.push(d <= daysElapsed ? +(Math.max(0.1, ndreBase - rate * d + (Math.random()*0.02-0.01))).toFixed(3) : null);
    }

    if (maturationChart) maturationChart.destroy();
    maturationChart = new Chart(document.getElementById('maturationChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Curva Teorica', data: theoretical, borderColor: '#2ec4b6', borderDash: [5,5], fill: false, pointRadius: 0, tension: 0.3 },
                { label: 'NDRE Medido', data: measured, borderColor: '#f77f00', backgroundColor: 'rgba(247,127,0,0.15)', fill: true, pointRadius: 3, tension: 0.3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#e2e8f0' } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}
