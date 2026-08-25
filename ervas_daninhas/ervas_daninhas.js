// ervas_daninhas.js - Clone funcional do Maturador/Estresse Hídrico para Ervas Daninhas

let map;
let talhoesLayer;
let focosLayer;
let currentFeatures = [];
let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initDates();
    
    // Bind search
    document.getElementById('talhao-select').addEventListener('input', (e) => {
        doFazendaSearch(e.target.value);
    });

    // Select all checkboxes
    document.getElementById('select-all-talhoes').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('#talhoes-list input[type="checkbox"]');
        checkboxes.forEach(cb => { cb.checked = e.target.checked; });
    });

    // Form submit
    document.getElementById('ervas-form').addEventListener('submit', (e) => {
        e.preventDefault();
        simulateAnalysis();
    });
});

function initDates() {
    const today = new Date();
    document.getElementById('date-analise').valueAsDate = today;
}

function initMap() {
    map = L.map('map-container').setView([-15, -50], 4);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
    }).addTo(map);
    
    focosLayer = L.layerGroup().addTo(map);
}

function getFeatureAreaHa(f) {
    let area = parseFloat(f.properties.AREA_HA || f.properties.area_ha || f.properties.TALHAO_ARE || f.properties['DL AREA'] || f.properties.AREA || f.properties.area || 0);
    if (!area || isNaN(area) || area <= 0) {
        if (typeof turf !== 'undefined') {
            try {
                area = turf.area(f) / 10000;
            } catch(e) {}
        }
    }
    return (area && !isNaN(area) && area > 0) ? area : 1;
}

function removeAcentos(str) {
    if (!str) return "";
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

// ----------------------------------------------------
// BUSCA DA FAZENDA
// ----------------------------------------------------
function doFazendaSearch(query) {
    const dropdown = document.getElementById('fazenda-dropdown');
    if (!dropdown) return;
    const q = removeAcentos(query);
    if (q.length < 1) { dropdown.style.display = 'none'; return; }

    if (typeof GEOPORTAL_LAYERS === 'undefined') {
        dropdown.innerHTML = '<div style="padding:10px;color:#94a3b8;">Carregando dados...</div>';
        dropdown.style.display = 'block';
        return;
    }

    const seen = new Set();
    const results = [];

    const searchInLayer = (layerName) => {
        if (GEOPORTAL_LAYERS[layerName] && GEOPORTAL_LAYERS[layerName].features) {
            GEOPORTAL_LAYERS[layerName].features.forEach(f => {
                const nome = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || f.properties.name || '');
                if (nome && removeAcentos(nome).includes(q) && !seen.has(nome)) {
                    seen.add(nome);
                    results.push(nome);
                }
            });
        }
    };

    searchInLayer("TALHOES");
    searchInLayer("FAZENDAS");

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

// ----------------------------------------------------
// CARREGAR TALHÕES
// ----------------------------------------------------
function populateTalhoes(fazendaNome) {
    const container = document.getElementById('talhoes-container');
    const lista = document.getElementById('talhoes-list');
    
    if (!fazendaNome || typeof GEOPORTAL_LAYERS === 'undefined') {
        container.style.display = 'none';
        return;
    }

    const qFaz = removeAcentos(fazendaNome);
    currentFeatures = [];

    if (GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
        GEOPORTAL_LAYERS["TALHOES"].features.forEach(f => {
            const fName = String(f.properties.NOME_FAZ || f.properties.NAME || f.properties.Name || '');
            if (removeAcentos(fName) === qFaz) {
                currentFeatures.push(f);
            }
        });
    }

    if (currentFeatures.length === 0) {
        lista.innerHTML = '<div style="color:#94a3b8;font-size:13px;">Nenhum talhão encontrado para esta fazenda.</div>';
    } else {
        currentFeatures.sort((a,b) => {
            const na = String(a.properties.id_talhao || a.properties.ID_TALHAO || a.properties.TALHAO || '');
            const nb = String(b.properties.id_talhao || b.properties.ID_TALHAO || b.properties.TALHAO || '');
            return na.localeCompare(nb, undefined, {numeric: true});
        });

        lista.innerHTML = '';
        currentFeatures.forEach((f, idx) => {
            const nomeT = String(f.properties.id_talhao || f.properties.ID_TALHAO || f.properties.TALHAO || `Talhão ${idx+1}`);
            const area = getFeatureAreaHa(f);
            const areaStr = area > 0 ? ` (${Number(area).toFixed(1)} ha)` : '';
            
            const div = document.createElement('div');
            div.style.cssText = 'padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px; font-size: 13px;';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = idx;
            chk.checked = true; // Vem marcado por padrão
            
            const lbl = document.createElement('label');
            lbl.innerHTML = `<b>${nomeT}</b>${areaStr}`;
            lbl.style.cursor = 'pointer';
            lbl.onclick = () => { chk.checked = !chk.checked; };

            div.appendChild(chk);
            div.appendChild(lbl);
            lista.appendChild(div);
        });
    }
    
    document.getElementById('select-all-talhoes').checked = true;
    container.style.display = 'block';
    
    renderPolygonsOnMap(currentFeatures, false);
}

// ----------------------------------------------------
// SIMULAÇÃO DE ERVAS DANINHAS
// ----------------------------------------------------

// Função para gerar números "aleatórios" consistentes baseados no talhão
function seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}


async function processarAnaliseReal() {
    const checkboxes = document.querySelectorAll('#talhoes-list input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert("Selecione pelo menos um talhão!");
        return;
    }

    // UI Feedback
    document.getElementById('btn-analyze').disabled = true;
    document.getElementById('loading-indicator').style.display = 'block';
    document.getElementById('diagnostic-result').style.display = 'none';
    document.getElementById('diagnostic-empty').style.display = 'none';

    const selectedFeatures = [];
    let totalAreaAnalise = 0;
    
    checkboxes.forEach(chk => {
        const idx = parseInt(chk.value);
        const f = currentFeatures[idx];
        if (f) {
            selectedFeatures.push(f);
            totalAreaAnalise += getFeatureAreaHa(f);
        }
    });

    const payload = {
        type: "FeatureCollection",
        features: selectedFeatures
    };

    try {
        // CONEXÃO COM A API NO RENDER (SATÉLITE)
        const response = await fetch("https://api-catacao-agrogis.onrender.com/api/processar-catacao", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error("Erro no servidor da IA: " + response.statusText);
        }

        const resultGeoJSON = await response.json();
        
        const areaCatacao = resultGeoJSON.area_total_ha || 0;
        const avgInfestacao = totalAreaAnalise > 0 ? (areaCatacao / totalAreaAnalise) : 0;
        const totalFocos = resultGeoJSON.features ? resultGeoJSON.features.length : 0;
        
        // Atualiza Painel de Diagnóstico
        updateDiagnosticPanel(avgInfestacao, totalAreaAnalise, areaCatacao, totalFocos);
        
        // Renderiza as Células de Catação no Mapa
        renderPolygonsOnMap(selectedFeatures, resultGeoJSON, true);
        
        // Renderiza Gráfico Real
        renderChartReal(selectedFeatures, resultGeoJSON);

        // Atualiza UI
        document.getElementById('diagnostic-result').style.display = 'block';
        
    } catch(err) {
        alert("Falha ao comunicar com o Satélite/API: " + err.message);
        console.error(err);
    } finally {
        document.getElementById('btn-analyze').disabled = false;
        document.getElementById('loading-indicator').style.display = 'none';
    }
}

// Sobrescrevendo a função chamada pelo form
function simulateAnalysis() {
    processarAnaliseReal();
}

// ----------------------------------------------------
// UI E MAPAS
// ----------------------------------------------------
function getColorForInfestacao(inf) {
    if (inf <= 0.05) return '#2ecc71'; // Verde
    if (inf <= 0.15) return '#f1c40f'; // Amarelo
    if (inf <= 0.30) return '#e67e22'; // Laranja
    return '#e74c3c'; // Vermelho
}

function getStyleClassForInfestacao(inf) {
    if (inf <= 0.05) return 'sem-infestacao';
    if (inf <= 0.15) return 'leve';
    if (inf <= 0.30) return 'moderado';
    return 'severo';
}

function updateDiagnosticPanel(avgInf, totalArea, areaCatacao, totalFocos) {
    const badge = document.getElementById('status-badge');
    const circle = document.getElementById('percentage-circle');
    const pctValue = document.getElementById('percentage-value');
    
    badge.className = 'badge';
    circle.className = 'percentage-circle';
    
    const styleClass = getStyleClassForInfestacao(avgInf);
    badge.classList.add(`status-${styleClass}`);
    circle.classList.add(styleClass);
    
    let statusText = "MÉDIA: ";
    if (avgInf <= 0.05) statusText += "ÁREA LIMPA";
    else if (avgInf <= 0.15) statusText += "CATAÇÃO LEVE";
    else if (avgInf <= 0.30) statusText += "CATAÇÃO MODERADA";
    else statusText += "CATAÇÃO SEVERA";
    
    badge.textContent = statusText;
    pctValue.textContent = (avgInf * 100).toFixed(1) + "%";
    
    document.getElementById('stat-area').textContent = totalArea > 0 ? `${totalArea.toFixed(1)} ha` : 'N/D';
    document.getElementById('stat-infestada').textContent = areaCatacao > 0 ? `${areaCatacao.toFixed(1)} ha` : 'N/D';
    document.getElementById('stat-focos').textContent = totalFocos;
    document.getElementById('stat-cloud').textContent = "< 10%";
}

function renderPolygonsOnMap(talhoesFeatures, weedGeoJSON, isAnalyzed) {
    if (talhoesLayer) map.removeLayer(talhoesLayer);
    if (focosLayer) focosLayer.clearLayers();
    
    // Desenha o limite dos talhões
    talhoesLayer = L.geoJSON(talhoesFeatures, {
        style: function(feature) {
            return { fillColor: 'rgba(255,255,255,0.05)', color: '#666', weight: 2, fillOpacity: 0.1, dashArray: '4' };
        }
    }).addTo(map);

    if (isAnalyzed && weedGeoJSON && weedGeoJSON.features && weedGeoJSON.features.length > 0) {
        // Desenha as células reais de 40x40 retornadas pela API Python
        L.geoJSON(weedGeoJSON, {
            style: {
                fillColor: '#ff1744',
                color: '#ff1744',
                weight: 1,
                fillOpacity: 0.6,
                opacity: 0.8
            },
            onEachFeature: function(feature, layer) {
                const area = getFeatureAreaHa(feature);
                layer.bindPopup(`Célula de Catação<br>Área: ${area.toFixed(2)} ha`);
            }
        }).addTo(focosLayer);
    }
    
    const bounds = talhoesLayer.getBounds();
    if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    }
}

function renderChartReal(talhoesFeatures, weedGeoJSON) {
    const ctx = document.getElementById('ervasChart');
    if (!ctx) return;
    
    const labels = [];
    const data = [];
    
    // Para cada talhão, descobre a área de mato interceptada
    // Como a API de GeoPandas manteve os IDs originais nos features de saída, podemos somar.
    talhoesFeatures.forEach((t, idx) => {
        const id = t.properties.id_talhao || t.properties.ID_TALHAO || t.properties.TALHAO || `T${idx+1}`;
        labels.push(String(id).substring(0,6));
        
        // Achar todos os matos que pertencem a esse talhão
        let matoNesseTalhao = 0;
        if(weedGeoJSON && weedGeoJSON.features) {
            weedGeoJSON.features.forEach(w => {
                // Checa propriedades herdadas
                const wId = w.properties.id_talhao || w.properties.ID_TALHAO || w.properties.TALHAO || `T${idx+1}`;
                if (wId === id) {
                    matoNesseTalhao += getFeatureAreaHa(w);
                }
            });
        }
        
        const areaT = getFeatureAreaHa(t);
        const percent = areaT > 0 ? (matoNesseTalhao / areaT) * 100 : 0;
        data.push(percent.toFixed(1));
    });
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '% Catação',
                data: data,
                backgroundColor: data.map(v => getColorForInfestacao(v/100)),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}
