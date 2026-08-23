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
    
    // Tenta carregar as fazendas da camada principal
    if (typeof GEOPORTAL_LAYERS !== 'undefined' && GEOPORTAL_LAYERS["FAZENDAS"] && GEOPORTAL_LAYERS["FAZENDAS"].features) {
        GEOPORTAL_LAYERS["FAZENDAS"].features.forEach(feature => {
            const name = feature.properties.NAME || feature.properties.Name || feature.properties.name || "Fazenda sem nome";
            const option = document.createElement('option');
            option.value = name;
            datalist.appendChild(option);
        });
    }
    // Suporte caso a camada chame 'TALHOES' ou similar
    else if (typeof GEOPORTAL_LAYERS !== 'undefined' && GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
        GEOPORTAL_LAYERS["TALHOES"].features.forEach(feature => {
            const name = feature.properties.NAME || feature.properties.Name || feature.properties.name || "Talhão sem nome";
            const option = document.createElement('option');
            option.value = name;
            datalist.appendChild(option);
        });
    }
}

/**
 * Inicializa o mapa Leaflet base
 */
function initMap() {
    map = L.map('map-container').setView([-22.5, -48.5], 14); // Ponto padrão genérico
    
    // Basemap de Satélite
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    }).addTo(map);
}

/**
 * Lida com o processamento do formulário principal
 */
async function handleProcessAnalysis(e) {
    e.preventDefault();
    
    const talhao = document.getElementById('talhao-select').value;
    const dateD0 = document.getElementById('date-d0').value;
    const dateDt = document.getElementById('date-dt').value;
    const ripenerType = document.getElementById('ripener-type').value;
    
    if (!talhao || !dateD0 || !dateDt) {
        alert("Preencha todos os parâmetros.");
        return;
    }
    
    const btn = document.getElementById('btn-analyze');
    const loader = document.getElementById('loading-indicator');
    
    btn.style.display = 'none';
    loader.style.display = 'block';
    
    try {
        // Obter polígono do talhão (Geometria mockada baseada na seleção)
        const polygon = getTalhaoGeometry(talhao);
        
        // Atualizar mapa com o talhão
        renderTalhaoOnMap(polygon);
        
        // 1. STAC Pipeline (Mockado na função para uso em Frontend)
        const timeSeriesData = await fetchSentinel2Data(polygon, new Date(dateD0), new Date(dateDt));
        
        // 2. Modelo de Curva de Maturação
        const analysis = calculateMaturityMetrics(timeSeriesData, new Date(dateD0), ripenerType);
        
        // 3. Atualizar UI
        updateDiagnosticUI(analysis);
        renderChart(analysis.timeSeries, analysis.baseNdre, analysis.targetNdre, new Date(dateD0));
        
    } catch (error) {
        console.error(error);
        alert("Erro ao processar análise: " + error.message);
    } finally {
        btn.style.display = 'block';
        loader.style.display = 'none';
    }
}

/**
 * 1. PIPELINE DE DADOS SENTINEL-2 (STAC)
 * Simula a consulta STAC no Planetary Computer e o cálculo dos índices NDRE/NDVI
 */
async function fetchSentinel2Data(polygon, d0, dt) {
    // Aqui estaria a requisição real para o STAC API:
    /*
    const d0Minus7 = new Date(d0);
    d0Minus7.setDate(d0Minus7.getDate() - 7);
    
    const payload = {
        collections: ["sentinel-2-l2a"],
        intersects: polygon,
        datetime: `${d0Minus7.toISOString()}/${dt.toISOString()}`,
        query: {
            "eo:cloud_cover": { "lt": 30 } // Filtro inicial de nuvem
        }
    };
    const response = await fetch(STAC_API_URL, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload) });
    const stacFeatures = await response.json();
    */

    // Simulação da série temporal (Pixel reduction do NDRE)
    // O NDRE começa perto de 0.40 - 0.45, cai gradativamente após D0.
    
    return new Promise((resolve) => {
        setTimeout(() => {
            const series = [];
            let currentDate = new Date(d0);
            currentDate.setDate(currentDate.getDate() - 5); // Uma passagem antes de D0
            
            // Simular passagens a cada ~5-7 dias, descartando algumas por nuvens
            let currentNdre = 0.42; 
            
            while(currentDate <= dt) {
                // Randomly skip due to "clouds" (20% chance)
                if (Math.random() > 0.2) {
                    let daysSinceD0 = (currentDate - d0) / (1000 * 60 * 60 * 24);
                    
                    if (daysSinceD0 > 0) {
                        // Simular queda
                        // A taxa de queda acelera um pouco depois estabiliza
                        let dropRate = 0.0015;
                        if (daysSinceD0 > 15) dropRate = 0.003;
                        if (daysSinceD0 > 40) dropRate = 0.001;
                        
                        currentNdre -= (dropRate * (Math.random() * 2 + 3)); // Queda proporcional
                        if (currentNdre < 0.15) currentNdre = 0.15;
                    }
                    
                    series.push({
                        date: new Date(currentDate),
                        ndre: parseFloat(currentNdre.toFixed(4)),
                        ndvi: parseFloat((currentNdre + 0.35).toFixed(4)), // Apenas para compor
                        cloud_cover: Math.random() * 15 // Menos de 30% garantido pelo filtro
                    });
                }
                currentDate.setDate(currentDate.getDate() + 5);
            }
            
            resolve(series);
        }, 1500); // Simulando delay de rede/processamento
    });
}

/**
 * 2 e 3. CÁLCULO DA CURVA DE MATURAÇÃO
 */
function calculateMaturityMetrics(timeSeries, d0, ripenerType) {
    if (timeSeries.length === 0) throw new Error("Nenhuma imagem sem nuvem encontrada neste período.");
    
    // Obter Linha de Base (NDRE na imagem limpa mais recente antes ou igual a D0)
    let baseImg = timeSeries.filter(t => t.date <= d0).pop();
    if (!baseImg) {
        // Se não tiver imagem antes, pega a primeira logo após
        baseImg = timeSeries[0];
    }
    
    const baseNdre = baseImg.ndre;
    
    // Alvo: 22% de redução padrão, ou dependendo do maturador
    const targetReductionPct = 0.22; 
    const targetNdre = baseNdre * (1 - targetReductionPct);
    
    // Imagem mais recente
    const currentImg = timeSeries[timeSeries.length - 1];
    const currentNdre = currentImg.ndre;
    
    // Cálculos Principais
    const deltaNdre = baseNdre - currentNdre;
    let maturationPercent = ((baseNdre - currentNdre) / (baseNdre - targetNdre)) * 100;
    
    // Clamp entre 0 e 150
    maturationPercent = Math.max(0, Math.min(150, maturationPercent));
    
    const daysSinceD0 = Math.floor((currentImg.date - d0) / (1000 * 60 * 60 * 24));
    
    // Calcular janela ótima estimada com base no tipo de maturador
    const optimalDays = ripenerType === 'inibidor' ? 35 : 55;
    const daysRemaining = optimalDays - daysSinceD0;
    
    // Determinar Status
    let statusId, statusText;
    
    if (daysSinceD0 > 20 && maturationPercent < 15) {
        statusId = 'inert';
        statusText = 'Inércia: Sem Resposta ao Maturador';
    } else if (maturationPercent > 100) {
        statusId = 'danger';
        statusText = 'Risco de Isoporização / Secamento';
    } else if (maturationPercent >= 76) {
        statusId = 'optimal';
        statusText = 'Janela Ótima de Colheita';
    } else if (maturationPercent >= 26) {
        statusId = 'evolving';
        statusText = 'Maturação em Evolução Positiva';
    } else {
        statusId = 'initial';
        statusText = 'Efeito Inicial / Latência';
    }
    
    return {
        timeSeries,
        baseNdre,
        currentNdre,
        targetNdre,
        deltaNdre,
        maturationPercent,
        daysSinceD0,
        daysRemaining,
        statusId,
        statusText
    };
}

/**
 * 4. ATUALIZAÇÃO DA INTERFACE (DIAGNÓSTICO)
 */
function updateDiagnosticUI(analysis) {
    document.getElementById('diagnostic-empty').style.display = 'none';
    const resultCard = document.getElementById('diagnostic-result');
    resultCard.style.display = 'flex';
    
    // Badge
    const badge = document.getElementById('status-badge');
    badge.className = `badge status-${analysis.statusId}`;
    badge.textContent = analysis.statusText;
    
    // Porcentagem
    const circle = document.getElementById('percentage-circle');
    document.getElementById('percentage-value').textContent = `${Math.round(analysis.maturationPercent)}%`;
    
    // Cor do círculo de acordo com o status
    let circleColor = '#94a3b8';
    if (analysis.statusId === 'initial') circleColor = '#3498db';
    if (analysis.statusId === 'evolving') circleColor = '#2ecc71';
    if (analysis.statusId === 'optimal') circleColor = '#9b59b6';
    if (analysis.statusId === 'danger') circleColor = '#ff4d4d';
    if (analysis.statusId === 'inert') circleColor = '#f39c12';
    
    circle.style.borderTopColor = circleColor;
    if (analysis.maturationPercent > 50) circle.style.borderRightColor = circleColor;
    if (analysis.maturationPercent > 75) circle.style.borderBottomColor = circleColor;
    if (analysis.maturationPercent > 100) circle.style.borderLeftColor = circleColor;
    
    // Stats
    document.getElementById('days-elapsed').textContent = `${analysis.daysSinceD0} dias`;
    document.getElementById('ndre-base').textContent = analysis.baseNdre.toFixed(3);
    document.getElementById('ndre-current').textContent = analysis.currentNdre.toFixed(3);
    document.getElementById('ndre-delta').textContent = analysis.deltaNdre.toFixed(3);
    
    const rem = analysis.daysRemaining;
    let remText = rem > 0 ? `~ ${rem} dias` : (rem === 0 ? "Chegou no Ponto!" : `Passou ${Math.abs(rem)} dias`);
    if (analysis.statusId === 'inert' || analysis.statusId === 'danger') remText = 'N/A';
    document.getElementById('days-remaining').textContent = remText;
}

/**
 * Renderiza o gráfico Chart.js
 */
function renderChart(series, baseNdre, targetNdre, d0) {
    const ctx = document.getElementById('maturationChart').getContext('2d');
    
    if (maturationChart) {
        maturationChart.destroy();
    }
    
    const labels = series.map(s => {
        const d = s.date;
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
    });
    
    const dataNdre = series.map(s => s.ndre);
    
    // Linha Teórica Ideal (Interpolação linear da Base até o Alvo no prazo de 45 dias pós D0)
    const targetDate = new Date(d0);
    targetDate.setDate(targetDate.getDate() + 45); // Ponto ideal teórico genérico
    
    const theoreticalLine = series.map(s => {
        if (s.date <= d0) return baseNdre;
        if (s.date >= targetDate) return targetNdre;
        
        const totalDuration = targetDate - d0;
        const currentDuration = s.date - d0;
        const ratio = currentDuration / totalDuration;
        return baseNdre - ((baseNdre - targetNdre) * ratio);
    });

    maturationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'NDRE Medido (S2)',
                    data: dataNdre,
                    borderColor: '#2ec4b6',
                    backgroundColor: 'rgba(46, 196, 182, 0.2)',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#fff',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Curva Ideal Teórica',
                    data: theoreticalLine,
                    borderColor: '#ffb732',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Índice NDRE', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' },
                    min: Math.min(targetNdre - 0.05, Math.min(...dataNdre) - 0.05),
                    max: baseNdre + 0.05
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

/**
 * Retorna geometria GeoJSON da fazenda selecionada
 */
function getTalhaoGeometry(id) {
    let feature = null;
    
    if (typeof GEOPORTAL_LAYERS !== 'undefined') {
        if (GEOPORTAL_LAYERS["FAZENDAS"] && GEOPORTAL_LAYERS["FAZENDAS"].features) {
            feature = GEOPORTAL_LAYERS["FAZENDAS"].features.find(f => 
                (f.properties.NAME === id || f.properties.Name === id || f.properties.name === id)
            );
        }
        if (!feature && GEOPORTAL_LAYERS["TALHOES"] && GEOPORTAL_LAYERS["TALHOES"].features) {
            feature = GEOPORTAL_LAYERS["TALHOES"].features.find(f => 
                (f.properties.NAME === id || f.properties.Name === id || f.properties.name === id)
            );
        }
    }
    
    if (feature) {
        // Se for um ponto, vamos criar um polígono pequeno (buffer) ao redor para fins de visualização de talhão simulado
        if (feature.geometry.type === "Point") {
            const coord = feature.geometry.coordinates;
            const offset = 0.005; // ~500m
            return {
                "type": "Polygon",
                "coordinates": [[
                    [coord[0] - offset, coord[1] - offset],
                    [coord[0] + offset, coord[1] - offset],
                    [coord[0] + offset, coord[1] + offset],
                    [coord[0] - offset, coord[1] + offset],
                    [coord[0] - offset, coord[1] - offset]
                ]]
            };
        }
        return feature.geometry;
    }
    
    // Fallback default caso não encontre
    return {
        "type": "Polygon",
        "coordinates": [[
            [-48.50, -22.50], [-48.51, -22.50], [-48.51, -22.51], [-48.50, -22.51], [-48.50, -22.50]
        ]]
    };
}

let rasterLayer = null;

function renderTalhaoOnMap(geojson) {
    if (talhaoLayer) map.removeLayer(talhaoLayer);
    if (rasterLayer) map.removeLayer(rasterLayer);
    
    // Renderiza o contorno do polígono
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
    
    // Gerar uma imagem falsa-cor (NDRE) dinâmica para simular os pixels do satélite
    const imgDataUrl = generateSimulatedNDRERaster(bounds, geojson.geometry || geojson);
    
    rasterLayer = L.imageOverlay(imgDataUrl, bounds, {
        opacity: 0.7,
        alt: "NDRE Raster Simulado"
    }).addTo(map);
}

/**
 * Gera um raster PNG em base64 simulando pixels de 10m do Sentinel-2 (Gradiente NDRE)
 * Recorta a imagem exatamente nos limites do polígono do talhão
 */
function generateSimulatedNDRERaster(bounds, geometry) {
    const canvas = document.createElement('canvas');
    canvas.width = 150; // Resolução melhorada
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    
    // 1. Criar máscara de recorte (Clipping) com o formato exato da fazenda
    const latMin = bounds.getSouth();
    const latMax = bounds.getNorth();
    const lngMin = bounds.getWest();
    const lngMax = bounds.getEast();
    
    const latDiff = latMax - latMin;
    const lngDiff = lngMax - lngMin;
    
    function project(coord) {
        const x = ((coord[0] - lngMin) / lngDiff) * canvas.width;
        const y = ((latMax - coord[1]) / latDiff) * canvas.height;
        return [x, y];
    }
    
    ctx.beginPath();
    // Se for um Feature, a geometria real fica em geometry.geometry
    const geom = geometry.type === 'Feature' ? geometry.geometry : geometry;
    
    if (geom && geom.type === 'Polygon') {
        const ring = geom.coordinates[0];
        ring.forEach((coord, i) => {
            const [x, y] = project(coord);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    } else if (geom && geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(polygon => {
            const ring = polygon[0];
            ring.forEach((coord, i) => {
                const [x, y] = project(coord);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
        });
    }
    ctx.closePath();
    ctx.clip(); // Tudo desenhado daqui em diante ficará DENTRO deste polígono
    
    // 2. Simulação de distribuição espacial da maturação (Ruído Pixelado)
    for (let x = 0; x < canvas.width; x += 3) {
        for (let y = 0; y < canvas.height; y += 3) {
            // Criar um padrão pseudo-realista (bordas mais secas, centro mais verde)
            const distToCenter = Math.sqrt(Math.pow(x - (canvas.width/2), 2) + Math.pow(y - (canvas.height/2), 2));
            let baseProb = 1 - (distToCenter / (canvas.width/1.2)); 
            baseProb += (Math.random() * 0.5 - 0.25); // ruído
            
            let color;
            if (baseProb > 0.7) color = '#2ecc71'; // Verde (Alto NDRE)
            else if (baseProb > 0.4) color = '#f1c40f'; // Amarelo (Médio)
            else if (baseProb > 0.2) color = '#e67e22'; // Laranja (Baixo)
            else color = '#e74c3c'; // Vermelho (Seco / Isoporizado)
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 3, 3);
        }
    }
    
    return canvas.toDataURL('image/png');
}
