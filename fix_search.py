import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "weedSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e); });"
end_marker = "if (btnClose) {\n        btnClose.addEventListener('click', deactivateWeedTool);\n    }"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_logic = start_marker + """
    function handleSearch(e) {
            const query = e.target.value.toLowerCase().trim();
            if (!query || !window.loadedLayers) return;
            
            let bounds = L.latLngBounds();
            let exactBounds = L.latLngBounds();
            let exactMatchCount = 0;
            let partialMatchCount = 0;
            let foundExactLayer = null;
            let foundPartialLayer = null;

            const normalize = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const normQuery = normalize(query);

            const checkLayer = (layer) => {
                if (layer.feature) {
                    const props = layer.feature.properties || {};
                    const rawName = props.NOME_FAZ || props['DL DESCFUNDOA'] || '';
                    const rawId = props.FAZENDA || props.DL_FUNDOAGRIC || props['DL FUNDOAGRIC'] || '';
                    
                    let title = rawName;
                    if (rawName && rawId) {
                        const cleanIdStr = String(rawId).split(',')[0].split('.')[0].trim();
                        if (cleanIdStr) title = `${cleanIdStr} - ${rawName}`;
                    }
                    
                    const normTitle = normalize(title);
                    const normRawName = normalize(rawName);
                    
                    const isExact = normTitle === normQuery || normRawName === normQuery;
                    const isPartial = normTitle.includes(normQuery) || normRawName.includes(normQuery);

                    if (isExact) {
                        exactMatchCount++;
                        foundExactLayer = layer;
                        if (layer.getBounds) {
                            exactBounds.extend(layer.getBounds());
                        } else if (layer.getLatLng) {
                            exactBounds.extend(layer.getLatLng());
                        }
                    } else if (isPartial) {
                        partialMatchCount++;
                        foundPartialLayer = layer;
                        if (layer.getBounds) {
                            bounds.extend(layer.getBounds());
                        } else if (layer.getLatLng) {
                            bounds.extend(layer.getLatLng());
                        }
                    }
                } else if (layer.eachLayer) {
                    layer.eachLayer(child => checkLayer(child));
                }
            };

            for (const layerName in window.loadedLayers) {
                if (!layerName.toUpperCase().includes('FAZENDA') && !layerName.toUpperCase().includes('TALHOES')) continue;
                const layerGroup = window.loadedLayers[layerName];
                if (layerGroup && layerGroup.eachLayer) {
                    layerGroup.eachLayer(child => checkLayer(child));
                }
            }
            
            let finalBounds = exactMatchCount > 0 ? exactBounds : bounds;
            let finalMatchCount = exactMatchCount > 0 ? exactMatchCount : partialMatchCount;
            let finalFoundLayer = exactMatchCount > 0 ? foundExactLayer : foundPartialLayer;
            
            if (finalMatchCount > 0 && finalBounds.isValid()) {
                if (finalMatchCount > 1 || !finalFoundLayer.getLatLng) {
                    map.flyToBounds(finalBounds, { padding: [50, 50], duration: 1.5, maxZoom: 16 });
                } else {
                    map.flyTo(finalFoundLayer.getLatLng(), 16, { duration: 1.5 });
                }
            }
        }
    """
    
    content = content[:start_idx] + new_logic + content[end_idx:]
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced!")
else:
    print("Markers not found")
