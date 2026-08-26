with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()
    
    idx_start = text.find('const mapLayer = L.geoJSON(data, {')
    idx_end = text.find('// Add to map by default only if it\'s Fazenda or Talhao', idx_start)
    
    original = text[idx_start:idx_end]
    
    replacement = '''const geoJsonOptions = {
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
'''
    replacement += original[original.find('onEachFeature:'):]
    
    wrapper = '''
            const geoJsonOptions = ''' + replacement[replacement.find('{')+1:]
    wrapper = wrapper.replace('// Add to map by default only if it', '''
            const mapLayer = L.layerGroup();
            mapLayer.resetStyle = function(l) {
                if (this._realGeoJSON) this._realGeoJSON.resetStyle(l);
            };
            
            if (isLinhasColheita) {
                mapLayer._isLazy = true;
                mapLayer._lazyData = data;
                mapLayer._lazyOptions = geoJsonOptions;
                
                mapLayer.on('add', function() {
                    if (this._isLazy) {
                        console.log('Lazy loading layer ' + layerName);
                        const loadingEl = document.createElement('div');
                        loadingEl.id = 'lazy-loading-indicator';
                        loadingEl.innerHTML = 'Processando ' + layerName + '... (Isso pode levar alguns segundos)';
                        loadingEl.style = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: bold; z-index: 9999; pointer-events: none;';
                        document.body.appendChild(loadingEl);

                        setTimeout(() => {
                            try {
                                this._realGeoJSON = L.geoJSON(this._lazyData, this._lazyOptions);
                                this.addLayer(this._realGeoJSON);
                                this._isLazy = false;
                                this._lazyData = null; // Free memory
                            } catch (e) {
                                console.error('Erro ao processar camada lazy', e);
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
            
            // Add to map by default only if it''')
    
    new_text = text[:idx_start] + wrapper + text[idx_end+len('// Add to map by default only if it'):]
    with open('app.js', 'w', encoding='utf-8') as out:
        out.write(new_text)
    
