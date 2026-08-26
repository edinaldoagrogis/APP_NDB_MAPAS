with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''
            if (isLinhasColheita) {
                mapLayer._isLazy = true;
                
                // Forcing Canvas renderer for massive line layers to prevent SVG DOM explosion
                geoJsonOptions.renderer = L.canvas({ padding: 0.5 });
                
                mapLayer._lazyOptions = geoJsonOptions;
                
                mapLayer.on('add', function() {
                    if (this._isLazy) {
                        console.log('Lazy loading layer ' + layerName + ' via FlatGeobuf');
                        const loadingEl = document.createElement('div');
                        loadingEl.id = 'lazy-loading-indicator';
                        loadingEl.innerHTML = 'Carregando ' + layerName + ' (Otimizado)...';
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
'''

idx_start = text.find('if (isLinhasColheita) {')
idx_end = text.find('mapLayer._realGeoJSON = L.geoJSON(data, geoJsonOptions);', idx_start) - 18

new_text = text[:idx_start] + replacement.strip() + '\n            } else {\n' + text[idx_end+18:]

with open('app.js', 'w', encoding='utf-8') as out:
    out.write(new_text)

