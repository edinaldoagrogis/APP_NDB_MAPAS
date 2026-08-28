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
    function initEntomologia() {
        createUI();
        window._entoClick = toggleEntomologia;
        
        setTimeout(() => {
            if (window.map) {
                mapInstance = window.map;
                initLayer();
            }
        }, 2000);
    }

    // Chama a inicialização
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEntomologia);
    } else {
        initEntomologia();
    }

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
                bottom: 0;
                left: 0;
                right: 0;
                width: auto;
                max-width: none;
                background: rgba(10, 14, 12, 0.95);
                backdrop-filter: blur(16px);
                border-top: 1px solid rgba(255, 165, 0, 0.3);
                border-radius: 20px 20px 0 0;
                overflow: hidden;
                z-index: 1500;
                box-shadow: 0 -8px 32px rgba(0,0,0,0.6);
                font-family: 'Inter', sans-serif;
                color: #fff;
                flex-direction: column;
                padding-bottom: env(safe-area-inset-bottom, 20px);
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
                    
                    <!-- Busca de Talhão -->
                    <div>
                        <label style="font-size: 12px; color: #aaa; margin-bottom: 4px; display: block;">Buscar Fazenda/Talhão</label>
                        <input type="text" id="entomologia-busca" list="ento-lista" placeholder="Digite Código ou Nome..." style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,165,0,0.3); color: #fff; font-size: 14px; box-sizing: border-box;">
                        <datalist id="ento-lista"></datalist>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <label style="font-size: 12px; color: #aaa; margin-bottom: 4px; display: block;">Fazenda</label>
                            <input type="text" id="entomologia-fazenda" readonly style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #ccc; font-size: 13px; box-sizing: border-box;">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-size: 12px; color: #aaa; margin-bottom: 4px; display: block;">Talhão</label>
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

                    <!-- Sync com Portal -->
                    <button id="entomologia-sync-btn" style="width: 100%; padding: 10px; border-radius: 8px; background: rgba(46, 196, 182, 0.2); border: 1px solid rgba(46, 196, 182, 0.5); color: #2ec4b6; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 8px;">
                        🔄 Sincronizar com Portal
                    </button>
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
        
        document.getElementById('entomologia-busca').addEventListener('input', (e) => {
            const val = e.target.value;
            if (val && window._allTalhoesList) {
                const matched = window._allTalhoesList.find(t => `${t.fazenda} - Talhão: ${t.zona}` === val);
                if (matched) {
                    document.getElementById('entomologia-fazenda').value = matched.fazenda;
                    document.getElementById('entomologia-zona').value = matched.zona;
                } else {
                    document.getElementById('entomologia-fazenda').value = '';
                    document.getElementById('entomologia-zona').value = '';
                }
            } else {
                document.getElementById('entomologia-fazenda').value = '';
                document.getElementById('entomologia-zona').value = '';
            }
        });

        document.getElementById('entomologia-route-btn').addEventListener('click', toggleTracking);
        document.getElementById('entomologia-collect-btn').addEventListener('click', openSampleForm);
        document.getElementById('entomologia-cancel-btn').addEventListener('click', closeSampleForm);
        document.getElementById('entomologia-save-btn').addEventListener('click', saveSample);
        document.getElementById('entomologia-sync-btn').addEventListener('click', syncWithPortal);
        
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
        // Verificar permissão: primeiro tenta localStorage, depois confirma na API
        const hasLocalAccess = localStorage.getItem('agrogis_entomologia') === 'true';
        
        if (hasLocalAccess) {
            // Acesso local confirmado - abre direto
            _openTool();
            return;
        }

        // Sem flag local: consulta a API em tempo real
        const currentUser = localStorage.getItem('agrogis_current_user');
        if (!currentUser) {
            _showBlocked();
            return;
        }

        const btn = document.getElementById('tool-entomologia-btn');
        if (btn) btn.style.opacity = '0.5';

        fetch('https://app-ndb-mapas.vercel.app/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, password: 'ndb_mapas' })
        }).then(res => res.json()).then(data => {
            if (btn) btn.style.opacity = '1';
            if (data.entomologiaAccess || data.user === 'admin_agrogis') {
                localStorage.setItem('agrogis_entomologia', 'true');
                _openTool();
            } else {
                _showBlocked();
            }
        }).catch(() => {
            if (btn) btn.style.opacity = '1';
            // Offline - bloqueia por segurança
            _showBlocked();
        });
    }

    function _openTool() {
        const panel = document.getElementById('entomologia-panel');
        isActive = !isActive;

        if (isActive) {
            panel.style.display = 'flex';
            const toolsPanel = document.getElementById('floating-tools-panel');
            if (toolsPanel) toolsPanel.style.display = 'none';
            
            if (!mapInstance && window.map) {
                mapInstance = window.map;
                initLayer();
            }
            populateTalhoes();
        } else {
            panel.style.display = 'none';
            if (isTracking) {
                toggleTracking();
            }
        }
    }

    function _showBlocked() {
        const existingAlert = document.getElementById('ento-blocked-alert');
        if (existingAlert) existingAlert.remove();

        const alertEl = document.createElement('div');
        alertEl.id = 'ento-blocked-alert';
        alertEl.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(10, 14, 23, 0.97); border: 1px solid rgba(255, 100, 0, 0.5);
            border-radius: 16px; padding: 28px 24px; z-index: 99999;
            text-align: center; color: #fff; max-width: 300px; width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6); backdrop-filter: blur(12px);
        `;
        alertEl.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
            <div style="font-size: 16px; font-weight: 700; color: #ff6a00; margin-bottom: 8px;">Acesso Restrito</div>
            <div style="font-size: 13px; color: #a0aec0; margin-bottom: 20px; line-height: 1.5;">
                Você não tem permissão para usar a ferramenta de Entomologia.<br>
                Solicite acesso ao administrador.
            </div>
            <button onclick="document.getElementById('ento-blocked-alert').remove()"
                style="padding: 10px 24px; background: #ff6a00; border: none; border-radius: 8px;
                color: #fff; font-weight: 700; cursor: pointer; font-size: 14px;">OK</button>
        `;
        document.body.appendChild(alertEl);
        setTimeout(() => { if (alertEl.parentNode) alertEl.remove(); }, 4000);
    }

    function populateTalhoes() {
        const datalist = document.getElementById('ento-lista');
        datalist.innerHTML = '';
        window._allTalhoesList = [];
        
        if (!mapInstance) return;

        let talhoesMap = new Map();

        mapInstance.eachLayer((layer) => {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                // Heurística para identificar Talhões
                const isTalhao = props.ZONA !== undefined || props.NOME_FAZ !== undefined || props.TALHAO !== undefined || props.COD_TALHAO !== undefined;
                
                if (isTalhao) {
                    const zona = props.ZONA || props.COD_TALHAO || props.TALHAO || props.nome || 'Desconhecido';
                    const fazenda = props.NOME_FAZ || props.FAZENDA || 'Desconhecida';
                    const id = `${fazenda}||${zona}`;
                    talhoesMap.set(id, { fazenda, zona });
                }
            }
        });

        window._allTalhoesList = Array.from(talhoesMap.values()).sort((a, b) => a.fazenda.localeCompare(b.fazenda));
        
        window._allTalhoesList.forEach(t => {
            const opt = document.createElement('option');
            opt.value = `${t.fazenda} - Talhão: ${t.zona}`;
            datalist.appendChild(opt);
        });
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

    async function syncWithPortal() {
        if (savedPoints.length === 0) {
            alert('Não há dados locais para sincronizar.');
            return;
        }

        const btn = document.getElementById('entomologia-sync-btn');
        const oldText = btn.innerHTML;
        btn.innerHTML = '⏳ Enviando...';
        btn.disabled = true;

        try {
            const currentUser = localStorage.getItem('agrogis_current_user') || 'Desconhecido';
            
            const res = await fetch('https://app-ndb-mapas.vercel.app/api/syncEntomologia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: currentUser,
                    points: savedPoints
                })
            });

            const data = await res.json();
            
            if (res.ok) {
                alert('Dados enviados com sucesso para o Portal de Monitoramento!');
            } else {
                alert('Erro na sincronização: ' + data.error);
            }
        } catch (e) {
            alert('Erro de conexão ao sincronizar.');
            console.error(e);
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }

    // Export sync function if needed or just bind it internally
    // but first bind it to the button (we can use setTimeout to ensure it's bound after HTML injection)
    setTimeout(() => {
        const syncBtn = document.getElementById('entomologia-sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', syncWithPortal);
        }
    }, 1000);

})();
