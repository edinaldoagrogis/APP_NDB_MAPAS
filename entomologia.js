// =====================================================================
// ENTOMOLOGIA — Módulo de Levantamento de Pragas (Cigarrinha)
// =====================================================================

(function () {
    'use strict';

    // ─── Estado do Módulo ─────────────────────────────────────────────
    let isActive = false;
    let watchPositionId = null;
    let isTracking = false;
    let routeCoords = [];
    let routePolyline = null;
    let entomologiaLayer = null;
    let savedPoints = [];
    let mapInstance = null;
    let routeRecordingStarted = false;
    
    // ─── Inicialização ────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        // Obter referência do mapa (assumindo que o mapa principal do Leaflet foi atribuído a window.map ou está acessível no DOM)
        // No app.js o mapa é criado e tipicamente associado a window.map
        
        // Criar o Painel UI
        createUI();
        
        // Registrar Evento no Botão do Menu de Ferramentas
        const btn = document.getElementById('tool-entomologia-btn');
        if (btn) {
            btn.addEventListener('click', toggleEntomologia);
        }

        // Tentar obter o map do window
        setTimeout(() => {
            if (window.map) {
                mapInstance = window.map;
                initLayer();
            }
        }, 2000);
    });

    function initLayer() {
        if (!mapInstance) return;
        
        // Camada para exibir os pontos coletados
        entomologiaLayer = L.geoJSON(null, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: feature.properties.nivel === 'alta' ? '#ff0000' : (feature.properties.nivel === 'média' ? '#ffff00' : '#00ff00'),
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function (feature, layer) {
                layer.on('click', function() {
                    mapInstance.setView(layer.getLatLng(), 18);
                    
                    // Conteúdo do Popup / Relatório
                    let content = `
                        <div style="font-family: 'Inter', sans-serif; min-width: 200px;">
                            <h3 style="margin:0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Relatório de Levantamento</h3>
                            <p style="margin: 4px 0; font-size: 12px;"><b>Fazenda:</b> ${feature.properties.fazenda}</p>
                            <p style="margin: 4px 0; font-size: 12px;"><b>Talhão/Zona:</b> ${feature.properties.zona}</p>
                            <p style="margin: 4px 0; font-size: 12px;"><b>Data:</b> ${feature.properties.data}</p>
                            <p style="margin: 4px 0; font-size: 12px;"><b>Praga:</b> ${feature.properties.praga}</p>
                            <p style="margin: 4px 0; font-size: 12px;"><b>Nível de Ovos:</b> <span style="text-transform: capitalize;">${feature.properties.nivel}</span></p>
                    `;
                    
                    if (feature.properties.foto) {
                        content += `<div style="margin-top: 8px; text-align: center;"><img src="${feature.properties.foto}" style="max-width: 100%; max-height: 150px; border-radius: 4px;"></div>`;
                    }
                    
                    content += `
                            <button onclick="window.apagarAmostraEntomologia('${feature.properties.id}')" style="margin-top: 10px; width: 100%; padding: 6px; background: #ff4444; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Apagar Ponto</button>
                        </div>
                    `;
                    
                    layer.bindPopup(content).openPopup();
                });
            }
        }).addTo(mapInstance);

        // Rota
        routePolyline = L.polyline([], { color: '#ffa500', weight: 4, dashArray: '5, 5' }).addTo(mapInstance);

        // Carregar do localStorage
        loadSavedPoints();
    }

    function createUI() {
        const uiHTML = `
            <div id="entomologia-panel" style="
                display: none;
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                width: 90%;
                max-width: 400px;
                background: rgba(10, 14, 12, 0.95);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 165, 0, 0.3);
                border-radius: 16px;
                overflow: hidden;
                z-index: 1500;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 30px rgba(255,165,0,0.1);
                font-family: 'Inter', sans-serif;
                color: #fff;
                flex-direction: column;
            ">
                <!-- Cabeçalho -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid rgba(255,165,0,0.15);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 18px;">🐛</span>
                        <span style="font-size: 14px; font-weight: 700;">Entomologia</span>
                    </div>
                    <button id="entomologia-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.6); font-size: 20px; cursor: pointer;">&times;</button>
                </div>

                <!-- Corpo -->
                <div id="entomologia-body" style="padding: 16px; display: flex; flex-direction: column; gap: 12px; max-height: 70vh; overflow-y: auto;">
                    
                    <!-- Seleção de Talhão -->
                    <div>
                        <label style="font-size: 12px; color: #aaa; margin-bottom: 4px; display: block;">Selecionar Talhão Próximo</label>
                        <select id="entomologia-talhao-select" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px;">
                            <option value="">-- Buscar Talhões --</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <label style="font-size: 12px; color: #aaa; margin-bottom: 4px; display: block;">Fazenda</label>
                            <input type="text" id="entomologia-fazenda" readonly style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #ccc; font-size: 13px; box-sizing: border-box;">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 12px; color: #aaa; margin-bottom: 4px; display: block;">Zona/Cód</label>
                            <input type="text" id="entomologia-zona" readonly style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #ccc; font-size: 13px; box-sizing: border-box;">
                        </div>
                    </div>

                    <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0;"></div>

                    <!-- Controles de Rota -->
                    <button id="entomologia-route-btn" style="width: 100%; padding: 10px; border-radius: 8px; background: rgba(255,165,0,0.2); border: 1px solid rgba(255,165,0,0.5); color: #ffa500; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                        ▶ Iniciar Levantamento
                    </button>

                    <!-- Coletar Amostra -->
                    <button id="entomologia-collect-btn" disabled style="width: 100%; padding: 12px; border-radius: 8px; background: #25d366; border: none; color: #fff; font-weight: bold; font-size: 14px; cursor: pointer; opacity: 0.5;">
                        📍 Coletar Amostra (GPS)
                    </button>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <span style="font-size: 11px; color: #aaa;">Camada: Pontos de Levantamento</span>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;">
                            <input type="checkbox" id="entomologia-layer-toggle" checked> Visível
                        </label>
                    </div>

                </div>

                <!-- Formulário de Amostra (Oculto inicialmente) -->
                <div id="entomologia-form" style="display: none; padding: 16px; flex-direction: column; gap: 12px; border-top: 1px solid rgba(255,165,0,0.3); background: rgba(0,0,0,0.2);">
                    <h4 style="margin: 0; font-size: 13px; color: #ffa500;">Nova Amostra</h4>
                    
                    <div>
                        <label style="font-size: 12px; color: #ccc; margin-bottom: 4px; display: block;">Tipo de Infestação</label>
                        <select id="entomologia-tipo" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px;">
                            <option value="Cigarrinha da Folha">Cigarrinha da Folha</option>
                            <option value="Cigarrinha da Raiz">Cigarrinha da Raiz</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size: 12px; color: #ccc; margin-bottom: 4px; display: block;">Nível de Ovos</label>
                        <select id="entomologia-nivel" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px;">
                            <option value="baixa">Baixa</option>
                            <option value="média">Média</option>
                            <option value="alta">Alta</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size: 12px; color: #ccc; margin-bottom: 4px; display: block;">Foto Obrigatória</label>
                        <input type="file" id="entomologia-foto" accept="image/*" capture="environment" style="font-size: 12px; color: #fff;">
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 8px;">
                        <button id="entomologia-cancel-btn" style="flex: 1; padding: 10px; border-radius: 6px; background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer;">Cancelar</button>
                        <button id="entomologia-save-btn" style="flex: 1; padding: 10px; border-radius: 6px; background: #ffa500; border: none; color: #000; font-weight: bold; cursor: pointer;">Salvar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', uiHTML);

        // Listeners
        document.getElementById('entomologia-close-btn').addEventListener('click', toggleEntomologia);
        
        document.getElementById('entomologia-talhao-select').addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                const [fazenda, zona] = val.split('||');
                document.getElementById('entomologia-fazenda').value = fazenda;
                document.getElementById('entomologia-zona').value = zona;
            } else {
                document.getElementById('entomologia-fazenda').value = '';
                document.getElementById('entomologia-zona').value = '';
            }
        });

        document.getElementById('entomologia-route-btn').addEventListener('click', toggleTracking);
        document.getElementById('entomologia-collect-btn').addEventListener('click', openSampleForm);
        document.getElementById('entomologia-cancel-btn').addEventListener('click', closeSampleForm);
        document.getElementById('entomologia-save-btn').addEventListener('click', saveSample);
        
        document.getElementById('entomologia-layer-toggle').addEventListener('change', (e) => {
            if (!mapInstance || !entomologiaLayer) return;
            if (e.target.checked) {
                mapInstance.addLayer(entomologiaLayer);
                mapInstance.addLayer(routePolyline);
            } else {
                mapInstance.removeLayer(entomologiaLayer);
                mapInstance.removeLayer(routePolyline);
            }
        });
    }

    function toggleEntomologia() {
        const panel = document.getElementById('entomologia-panel');
        isActive = !isActive;

        if (isActive) {
            panel.style.display = 'flex';
            document.getElementById('floating-tools-panel').style.display = 'none'; // Fechar menu de ferramentas
            
            if (!mapInstance && window.map) {
                mapInstance = window.map;
                initLayer();
            }
            populateTalhoes();
        } else {
            panel.style.display = 'none';
            if (isTracking) {
                toggleTracking(); // Parar rastreio ao fechar a ferramenta
            }
        }
    }

    function populateTalhoes() {
        const select = document.getElementById('entomologia-talhao-select');
        select.innerHTML = '<option value="">-- Buscar Talhões --</option>';
        
        if (!mapInstance) return;

        let talhoesMap = new Map();

        mapInstance.eachLayer((layer) => {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                // Heurística para identificar Talhões
                const isTalhao = props.TALHAO !== undefined || props.COD_TALHAO !== undefined || props.ZONA !== undefined || props.ZONA_A !== undefined;
                
                if (isTalhao) {
                    const zona = props.ZONA || props.COD_TALHAO || props.TALHAO || props.nome || 'Desconhecido';
                    const fazenda = props.FAZENDA || props.NOME_FAZ || 'Desconhecida';
                    const id = `${fazenda}||${zona}`;
                    talhoesMap.set(id, { fazenda, zona });
                }
            }
        });

        const sorted = Array.from(talhoesMap.values()).sort((a, b) => a.fazenda.localeCompare(b.fazenda));
        
        sorted.forEach(t => {
            const opt = document.createElement('option');
            opt.value = `${t.fazenda}||${t.zona}`;
            opt.textContent = `${t.fazenda} - Talhão: ${t.zona}`;
            select.appendChild(opt);
        });
        
        if(sorted.length === 0) {
            select.innerHTML = '<option value="">-- Nenhum Talhão carregado no mapa --</option>';
        }
    }

    function toggleTracking() {
        const btn = document.getElementById('entomologia-route-btn');
        const collectBtn = document.getElementById('entomologia-collect-btn');
        
        if (isTracking) {
            // Parar Gravação
            navigator.geolocation.clearWatch(watchPositionId);
            isTracking = false;
            routeRecordingStarted = false;
            btn.innerHTML = '▶ Iniciar Levantamento';
            btn.style.background = 'rgba(255,165,0,0.2)';
            btn.style.color = '#ffa500';
            collectBtn.disabled = true;
            collectBtn.style.opacity = '0.5';
        } else {
            // Iniciar Gravação
            if (!navigator.geolocation) {
                alert("Geolocalização não é suportada neste navegador.");
                return;
            }

            routeCoords = [];
            routeRecordingStarted = false;
            if(routePolyline) routePolyline.setLatLngs([]);

            isTracking = true;
            btn.innerHTML = '⏹ Finalizar Levantamento';
            btn.style.background = 'rgba(255,0,0,0.2)';
            btn.style.color = '#ff4444';
            collectBtn.disabled = false;
            collectBtn.style.opacity = '1';

            watchPositionId = navigator.geolocation.watchPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const latlng = [lat, lng];
                    
                    if (mapInstance && !routeRecordingStarted) {
                        mapInstance.setView(latlng, 16);
                    }
                    
                    if (routeRecordingStarted) {
                        routeCoords.push(latlng);
                        if (routePolyline) {
                            routePolyline.setLatLngs(routeCoords);
                        }
                    }
                },
                (error) => {
                    console.error("Erro de GPS: ", error);
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
            );
        }
    }

    // Variável temporária para armazenar a localização da amostra
    let tempSampleLocation = null;

    function openSampleForm() {
        const fazenda = document.getElementById('entomologia-fazenda').value;
        const zona = document.getElementById('entomologia-zona').value;
        
        if (!fazenda || !zona) {
            alert('Por favor, selecione um Talhão antes de coletar amostra.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                tempSampleLocation = [pos.coords.latitude, pos.coords.longitude];
                document.getElementById('entomologia-body').style.display = 'none';
                document.getElementById('entomologia-form').style.display = 'flex';
                // Reset inputs
                document.getElementById('entomologia-foto').value = '';
            },
            (err) => {
                alert('Não foi possível obter a localização atual. Tente novamente.');
            },
            { enableHighAccuracy: true }
        );
    }

    function closeSampleForm() {
        document.getElementById('entomologia-form').style.display = 'none';
        document.getElementById('entomologia-body').style.display = 'flex';
        tempSampleLocation = null;
    }

    function saveSample() {
        const tipo = document.getElementById('entomologia-tipo').value;
        const nivel = document.getElementById('entomologia-nivel').value;
        const fotoInput = document.getElementById('entomologia-foto');
        const fazenda = document.getElementById('entomologia-fazenda').value;
        const zona = document.getElementById('entomologia-zona').value;

        if (fotoInput.files.length === 0) {
            alert('A foto é obrigatória para concluir.');
            return;
        }

        const file = fotoInput.files[0];
        const reader = new FileReader();
        
        reader.onloadend = function() {
            const base64Foto = reader.result;

            const ponto = {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [tempSampleLocation[1], tempSampleLocation[0]] // GeoJSON is [lng, lat]
                },
                properties: {
                    id: 'ento_' + Date.now(),
                    fazenda: fazenda,
                    zona: zona,
                    praga: tipo,
                    nivel: nivel,
                    foto: base64Foto,
                    data: new Date().toLocaleString()
                }
            };

            // Adicionar à camada
            if (entomologiaLayer) {
                entomologiaLayer.addData(ponto);
            }

            // Iniciar a gravação da rota a partir deste ponto
            routeRecordingStarted = true;

            // Salvar no array e localStorage
            savedPoints.push(ponto);
            localStorage.setItem('ndb_entomologia_pontos', JSON.stringify(savedPoints));

            alert('Amostra registrada com sucesso!');
            closeSampleForm();
        };

        reader.readAsDataURL(file);
    }

    function loadSavedPoints() {
        try {
            const data = localStorage.getItem('ndb_entomologia_pontos');
            if (data) {
                savedPoints = JSON.parse(data);
                if (entomologiaLayer && savedPoints.length > 0) {
                    entomologiaLayer.addData(savedPoints);
                }
            }
        } catch (e) {
            console.error("Erro ao carregar pontos de entomologia", e);
        }
    }

    // Função global para apagar o ponto a partir do popup
    window.apagarAmostraEntomologia = function(id) {
        if (confirm('Tem certeza que deseja apagar este ponto de levantamento?')) {
            savedPoints = savedPoints.filter(p => p.properties.id !== id);
            localStorage.setItem('ndb_entomologia_pontos', JSON.stringify(savedPoints));
            
            // Recarregar camada
            if (entomologiaLayer) {
                entomologiaLayer.clearLayers();
                entomologiaLayer.addData(savedPoints);
            }
            if (mapInstance) {
                mapInstance.closePopup();
            }
        }
    };

})();
