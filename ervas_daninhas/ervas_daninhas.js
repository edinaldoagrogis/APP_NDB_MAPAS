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

function simulateAnalysis() {
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

    setTimeout(() => {
        const selectedTalhoes = [];
        let totalArea = 0;
        let areaInfestada = 0;
        let totalFocos = 0;
        
        checkboxes.forEach(chk => {
            const idx = parseInt(chk.value);
            const f = currentFeatures[idx];
            if (!f) return;
            
            // Semente única baseada no ID ou índice do talhão para sempre dar o mesmo resultado
            const seedStr = String(f.properties.id_talhao || f.properties.ID_TALHAO || f.properties.TALHAO || idx);
            let seedNum = 0;
            for(let i=0; i<seedStr.length; i++) seedNum += seedStr.charCodeAt(i);
            seedNum += idx; // garantir unicidade
            
            // Simulação matemática de infestação (0 a 1) consistente
            let infestacao = seededRandom(seedNum) * 0.4; // max 40%
            // Algumas raras chegam a 80%
            if(seededRandom(seedNum + 1) > 0.8) {
                infestacao = 0.4 + seededRandom(seedNum + 2) * 0.4;
            }
            
            // Salvar o seed no feature para usar no desenho da grade depois
            f.properties._seed = seedNum;
            
            f.properties._simulated_infestacao = infestacao;
            
            // Classificação
            if (infestacao <= 0.05) f.properties._infestacao_class = "Área Limpa (Sem Catação)";
            else if (infestacao <= 0.15) f.properties._infestacao_class = "Catação Leve";
            else if (infestacao <= 0.30) f.properties._infestacao_class = "Catação Moderada";
            else f.properties._infestacao_class = "Catação Severa";
            
            const area = getFeatureAreaHa(f);
            totalArea += area;
            areaInfestada += area * infestacao;
            
            const focos = Math.floor(infestacao * 20); // Simula quantia de reboleiras
            totalFocos += focos;
            f.properties._simulated_focos = focos;
            
            selectedTalhoes.push(f);
        });

        const avgInfestacao = totalArea > 0 ? (areaInfestada / totalArea) : 0;
        
        // Atualiza a UI
        updateDiagnosticPanel(avgInfestacao, totalArea, areaInfestada, totalFocos);
        renderPolygonsOnMap(selectedTalhoes, true);
        renderChart(selectedTalhoes);
        
        // Restore UI
        document.getElementById('btn-analyze').disabled = false;
        document.getElementById('loading-indicator').style.display = 'none';

    }, 2500); // Simulando o tempo de busca
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

function updateDiagnosticPanel(avgInf, totalArea, areaInfestada, totalFocos) {
    const badge = document.getElementById('status-badge');
    const circle = document.getElementById('percentage-circle');
    const pctValue = document.getElementById('percentage-value');
    
    // Reseta classes do badge/circle
    badge.className = 'badge';
    circle.className = 'percentage-circle';
    
    const styleClass = getStyleClassForInfestacao(avgInf);
    badge.classList.add(`status-${styleClass}`);
    circle.classList.add(styleClass);
    
    let statusText = "MÉDIA: ";
    if (avgInf <= 0.05) statusText += "SEM INFESTAÇÃO";
    else if (avgInf <= 0.15) statusText += "INFESTAÇÃO LEVE";
    else if (avgInf <= 0.30) statusText += "INFESTAÇÃO MODERADA";
    else statusText += "INFESTAÇÃO SEVERA";
    
    badge.textContent = statusText;
    pctValue.textContent = (avgInf * 100).toFixed(1) + "%";
    
    document.getElementById('stat-area').textContent = totalArea > 0 ? `${totalArea.toFixed(1)} ha` : 'N/D';
    document.getElementById('stat-infestada').textContent = areaInfestada > 0 ? `${areaInfestada.toFixed(1)} ha` : 'N/D';
    document.getElementById('stat-focos').textContent = totalFocos;
    document.getElementById('stat-cloud').textContent = "< 10%";
    
    document.getElementById('diagnostic-result').style.display = 'flex';
}

function renderPolygonsOnMap(features, isAnalyzed) {
    if (talhoesLayer) map.removeLayer(talhoesLayer);
    if (focosLayer) focosLayer.clearLayers();
    
    talhoesLayer = L.geoJSON(features, {
        style: function(feature) {
            if (!isAnalyzed) {
                return { fillColor: 'rgba(255,23,68,0.2)', color: '#ff1744', weight: 2, fillOpacity: 0.3, dashArray: '4' };
            }
            const inf = feature.properties._simulated_infestacao;
            const color = getColorForInfestacao(inf);
            return { fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.5 };
        },
        onEachFeature: function(feature, layer) {
            if (isAnalyzed) {
                const p = feature.properties;
                const inf = (p._simulated_infestacao * 100).toFixed(1) + "%";
                const cls = p._infestacao_class;
                const focos = p._simulated_focos;
                const id = p.id_talhao || p.ID_TALHAO || p.TALHAO || 'T';
                
                layer.bindPopup(`
                    <div style="font-family:Inter; color:#333; min-width:150px;">
                        <h4 style="margin:0 0 8px 0; border-bottom:1px solid #ccc; padding-bottom:5px;">Talhão ${id}</h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><b>Infestação:</b> <span style="color:${getColorForInfestacao(p._simulated_infestacao)}; font-weight:bold;">${inf}</span></div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><b>Status:</b> <span>${cls}</span></div>
                        <div style="display:flex; justify-content:space-between;"><b>Focos:</b> <span>${focos}</span></div>
                    </div>
                `);

                // Generate 40x40m grid mapping visually
                if (focos > 0 && typeof turf !== 'undefined') {
                    try {
                        const bbox = turf.bbox(feature);
                        const cellSide = 0.04; // 40 metros em km
                        const grid = turf.squareGrid(bbox, cellSide, {units: 'kilometers'});
                        
                        let cellsDrawn = 0;
                        const weedCells = [];
                        
                        grid.features.forEach(cell => {
                            // Verifica se o centro da celula de 40x40 cai dentro do talhao
                            const center = turf.centroid(cell);
                            if (turf.booleanPointInPolygon(center, feature)) {
                                weedCells.push(cell);
                            }
                        });
                        
                        // Desenha as celulas baseado na proporcao de focos simulados
                        // Mistura o array para distribuicao de forma consistente usando o seed do talhão
                        let sortSeed = p._seed || 12345;
                        weedCells.sort(() => 0.5 - seededRandom(sortSeed++));
                        
                        const cellsToDraw = Math.min(focos, weedCells.length);
                        for(let i=0; i<cellsToDraw; i++) {
                            L.geoJSON(weedCells[i], {
                                style: {
                                    fillColor: '#ff1744',
                                    color: '#ff1744',
                                    weight: 1,
                                    fillOpacity: 0.6,
                                    opacity: 0.8
                                }
                            }).bindPopup(`Célula de Catação (40x40m)<br>Talhão ${id}`).addTo(focosLayer);
                        }
                    } catch(e) {
                        console.error('Erro ao gerar grade 40x40', e);
                    }
                }
            }
        }
    }).addTo(map);

    const bounds = talhoesLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
}

function renderChart(features) {
    const ctx = document.getElementById('ervasChart');
    if (!ctx) return;
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const labels = [];
    const dataValues = [];
    const bgColors = [];
    
    features.forEach((f, idx) => {
        labels.push(f.properties.id_talhao || f.properties.ID_TALHAO || f.properties.TALHAO || `T${idx+1}`);
        const inf = f.properties._simulated_infestacao;
        dataValues.push((inf * 100).toFixed(1));
        bgColors.push(getColorForInfestacao(inf));
    });
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Infestação (%)',
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` Infestação: ${ctx.raw}%`
                    }
                }
            }
        }
    });
}
