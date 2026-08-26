with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx_start = text.find('const geoJsonOptions =')
idx_end = text.find('const isDefaultActive = isFazenda || isTalhao;')

replacement = '''
            const geoJsonOptions = {
                pane: isLinhasColheita ? 'harvestLinesPane' : 'overlayPane',
                smoothFactor: isLinhasColheita ? 1.5 : 0.5,
                style: styleFunc,
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: isFazenda ? 12 : 6,
                        fillColor: baseColor,
                        color: "#ffffff",
                        weight: isFazenda ? 0 : 1,
                        opacity: isFazenda ? 0 : 1,
                        fillOpacity: isFazenda ? 0 : 0.8
                    });
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties || {};
                    const getProp = (props, possibleNames) => {
                        if (!props) return '';
                        const keys = Object.keys(props);
                        for (const name of possibleNames) {
                            const upperName = name.toUpperCase();
                            const foundKey = keys.find(k => k.toUpperCase() === upperName);
                            if (foundKey) return props[foundKey];
                        }
                        return '';
                    };
                    const title = getProp(props, ['NOME_FAZ', 'FAZENDA', 'NOMEPROPRI', 'DESCFUNDOA', 'NOME', 'NAME', 'TALHAO', 'LOCAL']);
                    if (isTalhao) {
                        const cod = getProp(props, ['COD_TALHAO', 'TALHAO', 'COD_TALH']);
                        const area = getProp(props, ['AREA', 'AREA_HA']);
                        const varName = getProp(props, ['VARIEDADE', 'VAR', 'CULTIVAR']);
                        if (cod) {
                            const html = \<div class="tc" style="color: #ffffff; text-align: center; text-shadow: 1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000;">
                                    <div class="tc-top" style="display: flex; justify-content: center; align-items: center; gap: 2px;">
                                        <div class="tc-icon">??</div>
                                        <div class="tc-cod" style="font-size: 9px; font-weight: 900;">\</div>
                                    </div>
                                    <div class="tc-area" style="font-size: 8px; font-weight: bold; margin-top: 1px;">\</div>
                                    <div class="tc-var" style="font-size: 7.5px; font-weight: bold; opacity: 0.9;">\</div>
                                </div>\;
                            layerLabels.TALHOES.push({ latlng: layer.getBounds().getCenter(), html: html, marker: null });
                        }
                    }
                    layer.on({
                        mouseover: (e) => {
                            if (!isFazenda) {
                                const l = e.target;
                                if (isLinhasColheita && window.selectedHarvestLayer === l) return;
                                l.setStyle(layerStyles[layerName].highlight);
                                l.bringToFront();
                            }
                        },
                        mouseout: (e) => {
                            if (!isFazenda) {
                                const l = e.target;
                                if (isLinhasColheita && window.selectedHarvestLayer === l) return;
                                mapLayer.resetStyle(l);
                            }
                        },
                        click: (e) => {
                            const l = e.target;
                            if (window.routeSelectionMode) {
                                const lat = layer.getBounds ? layer.getBounds().getCenter().lat : e.latlng.lat;
                                const lng = layer.getBounds ? layer.getBounds().getCenter().lng : e.latlng.lng;
                                window.setRouteWaypoint(title, lat, lng);
                                L.DomEvent.stopPropagation(e);
                                return;
                            }
                            if (window.measureActive) return;
                            if (isLinhasColheita) {
                                if (window.selectedHarvestLayer && mapLayer.hasLayer(window.selectedHarvestLayer)) {
                                    mapLayer.resetStyle(window.selectedHarvestLayer);
                                }
                                window.selectedHarvestLayer = l;
                                l.setStyle({ color: '#ffffff', weight: 2.0, opacity: 1, fillOpacity: 0 });
                                l.bringToFront();
                                L.DomEvent.stopPropagation(e);
                            }
                            L.popup({ autoPanPadding: [50, 50] }).setLatLng(e.latlng).setContent(createPopupContent(title, props)).openOn(map);
                            if (isFazenda) {
                                if (window.currentSearchedFarmLayer && window.currentSearchedFarmLayerGroup) {
                                    window.currentSearchedFarmLayerGroup.resetStyle(window.currentSearchedFarmLayer);
                                }
                                window.currentSearchedFarmLayer = layer;
                                window.currentSearchedFarmLayerGroup = mapLayer;
                                layer.setStyle({ weight: 4, color: '#ffeb3b', fillOpacity: 0.1 });
                                if (layer.bringToFront) layer.bringToFront();
                                if (layer.getBounds) map.flyToBounds(layer.getBounds(), { padding: [50, 50], duration: 1.5 });
                                L.DomEvent.stopPropagation(e);
                            } else {
                                if (window.clearAllSelections) window.clearAllSelections();
                                if (isTalhao && window.openWeedAnalysisPanel) window.openWeedAnalysisPanel({ type: 'Feature', geometry: feature.geometry, properties: props }, props);
                                if (isTalhao && window.climaFarmActive && window.climaFarmFetchData) {
                                    const center = layer.getBounds ? layer.getBounds().getCenter() : e.latlng;
                                    window.climaFarmFetchData(center.lat, center.lng, props);
                                    L.DomEvent.stopPropagation(e);
                                }
                            }
                        }
                    });
                }
            };
            
            const mapLayer = L.layerGroup();
            mapLayer.resetStyle = function(l) {
                if (this._realGeoJSON) this._realGeoJSON.resetStyle(l);
            };
            
            if (isLinhasColheita) {
                mapLayer._isLazy = true;
                geoJsonOptions.renderer = L.canvas({ padding: 0.5 });
                mapLayer._lazyOptions = geoJsonOptions;
                
                mapLayer.on('add', function() {
                    if (this._isLazy) {
                        console.log('Lazy loading layer ' + layerName + ' via FlatGeobuf');
                        const loadingEl = document.createElement('div');
                        loadingEl.id = 'lazy-loading-indicator';
                        loadingEl.innerHTML = 'Processando ' + layerName + '...';
                        loadingEl.style = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: bold; z-index: 9999; pointer-events: none;';
                        document.body.appendChild(loadingEl);

                        setTimeout(async () => {
                            try {
                                const response = await fetch('./linhas_colheita.fgb');
                                const buffer = await response.arrayBuffer();
                                const uint8 = new Uint8Array(buffer);
                                
                                const features = [];
                                const iter = flatgeobuf.deserialize(uint8);
                                for await (let feature of iter) {
                                    features.push(feature);
                                }
                                
                                this._realGeoJSON = L.geoJSON({ type: 'FeatureCollection', features: features }, this._lazyOptions);
                                this.addLayer(this._realGeoJSON);
                                this._isLazy = false;
                            } catch (e) {
                                console.error('Erro FGB', e);
                            }
                            const indicator = document.getElementById('lazy-loading-indicator');
                            if (indicator) indicator.remove();
                        }, 50);
                    }
                });
            } else {
                mapLayer._realGeoJSON = L.geoJSON(data, geoJsonOptions);
                mapLayer.addLayer(mapLayer._realGeoJSON);
            }
            
            '''

new_text = text[:idx_start] + replacement + text[idx_end:]
with open('app.js', 'w', encoding='utf-8') as out:
    out.write(new_text)

