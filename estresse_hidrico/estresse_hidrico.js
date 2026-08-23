// estresse_hidrico.js - Clone funcional do Maturador para IEH

let map;
let talhoesLayer;
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
    document.getElementById('ieh-form').addEventListener('submit', (e) => {
        e.preventDefault();
        simulateAnalysis();
    });
});

function initDates() {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    
    document.getElementById('date-fim').valueAsDate = today;
    document.getElementById('date-inicio').valueAsDate = lastMonth;
}

function initMap() {
    map = L.map('map-container').setView([-15, -50], 4);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
    }).addTo(map);
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
            const area = f.properties.AREA_HA || f.properties.area_ha || 0;
            const areaStr = area > 0 ? ` (${Number(area).toFixed(1)} ha)` : '';
            
            // Lendo a variedade diretamente do atributo do polígono
            const variedade = String(f.properties.VARIEDADE || f.properties.VAR || f.properties.variedade || 'Desconhecida');

            const div = document.createElement('div');
            div.style.cssText = 'padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px; font-size: 13px;';
            
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = idx;
            chk.checked = true; // Vem marcado por padrão
            
            const lbl = document.createElement('label');
            lbl.innerHTML = `<b>${nomeT}</b>${areaStr} <span style="color:var(--primary); font-size:11px; margin-left:4px;">[${variedade}]</span>`;
            lbl.style.cursor = 'pointer';
            lbl.onclick = () => { chk.checked = !chk.checked; };

            div.appendChild(chk);
            div.appendChild(lbl);
            lista.appendChild(div);
        });
    }
    
    document.getElementById('select-all-talhoes').checked = true;
    container.style.display = 'block';
    
    // Mostra no mapa sem cores de IEH ainda
    renderPolygonsOnMap(currentFeatures, false);
}

// ----------------------------------------------------
// SIMULAÇÃO DO ESTRESSE HÍDRICO (Frontend apenas)
// ----------------------------------------------------
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
        let sumIeh = 0;
        let severoCount = 0;
        
        // Contagem de variedades para achar a predominante
        const varCounts = {};

        checkboxes.forEach(chk => {
            const idx = parseInt(chk.value);
            const f = currentFeatures[idx];
            if (!f) return;
            
            // Simulação matemática do IEH baseado na variedade
            const variedade = String(f.properties.VARIEDADE || f.properties.VAR || 'Desconhecida').toUpperCase();
            let f_var = 1.0;
            
            // Fatores aproximados baseados na matriz
            if (variedade.includes('RB92579') || variedade.includes('RB011941')) f_var = 0.70; // Muito Tolerante
            else if (variedade.includes('RB867515') || variedade.includes('RB966928')) f_var = 0.75; // Tolerante
            else if (variedade.includes('CTC4') || variedade.includes('CTC2') || variedade.includes('SP80-1842')) f_var = 1.20; // Sensível
            
            // IEH Base aleatório influenciado pelo tempo (simulando STAC)
            const baseIeh = 0.3 + (Math.random() * 0.4); 
            let finalIeh = baseIeh * f_var;
            
            // Clamp entre 0 e 1
            finalIeh = Math.max(0.0, Math.min(1.0, finalIeh));
            
            f.properties._simulated_ieh = finalIeh;
            
            // Classificação
            if (finalIeh <= 0.25) f.properties._ieh_class = "Sem Estresse";
            else if (finalIeh <= 0.50) f.properties._ieh_class = "Estresse Leve";
            else if (finalIeh <= 0.75) f.properties._ieh_class = "Estresse Moderado";
            else { f.properties._ieh_class = "Estresse Severo"; severoCount++; }
            
            const area = parseFloat(f.properties.AREA_HA || f.properties.area_ha || 0);
            totalArea += area;
            sumIeh += finalIeh;
            
            varCounts[variedade] = (varCounts[variedade] || 0) + area;
            
            selectedTalhoes.push(f);
        });

        // Variedade predominante (maior área)
        let predominante = "Mista";
        let maxVarArea = 0;
        for (const [v, a] of Object.entries(varCounts)) {
            if (a > maxVarArea) { maxVarArea = a; predominante = v; }
        }

        const avgIeh = sumIeh / selectedTalhoes.length;
        
        // Atualiza a UI
        updateDiagnosticPanel(avgIeh, totalArea, severoCount, predominante);
        renderPolygonsOnMap(selectedTalhoes, true);
        renderChart(selectedTalhoes);
        
        // Restore UI
        document.getElementById('btn-analyze').disabled = false;
        document.getElementById('loading-indicator').style.display = 'none';

    }, 1500); // Simulando o tempo de busca na API STAC (como o Maturador faz)
}

// ----------------------------------------------------
// UI E MAPAS
// ----------------------------------------------------
function getColorForIEH(ieh) {
    if (ieh <= 0.25) return '#2ecc71'; // Verde
    if (ieh <= 0.50) return '#f1c40f'; // Amarelo
    if (ieh <= 0.75) return '#e67e22'; // Laranja
    return '#e74c3c'; // Vermelho
}

function getStyleClassForIEH(ieh) {
    if (ieh <= 0.25) return 'sem-estresse';
    if (ieh <= 0.50) return 'leve';
    if (ieh <= 0.75) return 'moderado';
    return 'severo';
}

function updateDiagnosticPanel(avgIeh, totalArea, severoCount, variedadePredominante) {
    const badge = document.getElementById('status-badge');
    const circle = document.getElementById('percentage-circle');
    const pctValue = document.getElementById('percentage-value');
    
    // Reseta classes do badge/circle
    badge.className = 'badge';
    circle.className = 'percentage-circle';
    
    const styleClass = getStyleClassForIEH(avgIeh);
    badge.classList.add(`status-${styleClass}`);
    circle.classList.add(styleClass);
    
    let statusText = "MÉDIO: ";
    if (avgIeh <= 0.25) statusText += "SEM ESTRESSE";
    else if (avgIeh <= 0.5) statusText += "ESTRESSE LEVE";
    else if (avgIeh <= 0.75) statusText += "ESTRESSE MODERADO";
    else statusText += "ESTRESSE SEVERO";
    
    badge.textContent = statusText;
    pctValue.textContent = avgIeh.toFixed(2);
    
    document.getElementById('stat-area').textContent = totalArea > 0 ? `${totalArea.toFixed(1)} ha` : 'N/D';
    document.getElementById('stat-severo').textContent = severoCount;
    document.getElementById('stat-var').textContent = variedadePredominante;
    document.getElementById('stat-cloud').textContent = "< 15%";
    
    document.getElementById('diagnostic-result').style.display = 'flex';
}

function renderPolygonsOnMap(features, isAnalyzed) {
    if (talhoesLayer) map.removeLayer(talhoesLayer);
    
    talhoesLayer = L.geoJSON(features, {
        style: function(feature) {
            if (!isAnalyzed) {
                return { fillColor: 'rgba(46,196,182,0.2)', color: '#2ec4b6', weight: 2, fillOpacity: 0.3, dashArray: '4' };
            }
            const ieh = feature.properties._simulated_ieh;
            const color = getColorForIEH(ieh);
            return { fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.75 };
        },
        onEachFeature: function(feature, layer) {
            if (isAnalyzed) {
                const p = feature.properties;
                const ieh = p._simulated_ieh.toFixed(3);
                const cls = p._ieh_class;
                const varN = p.VARIEDADE || p.VAR || 'N/D';
                const id = p.id_talhao || p.ID_TALHAO || p.TALHAO || 'T';
                
                layer.bindPopup(`
                    <div style="font-family:Inter; color:#333; min-width:150px;">
                        <h4 style="margin:0 0 8px 0; border-bottom:1px solid #ccc; padding-bottom:5px;">Talhão ${id}</h4>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><b>Variedade:</b> <span>${varN}</span></div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><b>IEH:</b> <span style="color:${getColorForIEH(p._simulated_ieh)}; font-weight:bold;">${ieh}</span></div>
                        <div style="display:flex; justify-content:space-between;"><b>Status:</b> <span>${cls}</span></div>
                    </div>
                `);
            }
        }
    }).addTo(map);

    const bounds = talhoesLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
}

function renderChart(features) {
    const ctx = document.getElementById('iehChart');
    if (!ctx) return;
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const labels = [];
    const dataValues = [];
    const bgColors = [];
    
    features.forEach((f, idx) => {
        labels.push(f.properties.id_talhao || f.properties.ID_TALHAO || f.properties.TALHAO || `T${idx+1}`);
        const ieh = f.properties._simulated_ieh;
        dataValues.push(ieh);
        bgColors.push(getColorForIEH(ieh));
    });
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'IEH por Talhão',
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
                    max: 1.0,
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
                        label: (ctx) => ` IEH: ${ctx.raw.toFixed(3)}`
                    }
                }
            }
        }
    });
}
