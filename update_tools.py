import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Measure tool logic
new_render_measure = """
    function renderMeasureMarkers() {
        measureMarkers.clearLayers();
        if (measurePoints.length > 0 && measurePoints.length <= 2 && !measureFinished) {
            measurePoints.forEach((latlng, index) => {
                const marker = L.marker(latlng, {
                    draggable: true,
                    icon: L.divIcon({
                        className: 'measure-drag-marker',
                        html: `<div style="width:14px; height:14px; background:#ff9f1c; border:2px solid #fff; border-radius:50%; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    })
                });
                
                marker.on('drag', (e) => {
                    measurePoints[index] = e.target.getLatLng();
                    updateMeasureDisplay();
                });
                
                measureMarkers.addLayer(marker);
            });
        }
    }
"""

content = re.sub(r'function renderMeasureMarkers\(\) \{[\s\S]*?\}', new_render_measure.strip(), content, count=1)

# 2. Update Draw Area Tool logic to allow draggable vertices
# Find drawActive map click handler and drawMarkers
# Wait, let's find a place to put renderDrawMarkers()
draw_render_func = """
    function renderDrawMarkers() {
        drawMarkers.clearLayers();
        if (drawMode === 'area') {
            currentPolygonPoints.forEach((latlng, index) => {
                const marker = L.marker(latlng, {
                    draggable: true,
                    icon: L.divIcon({
                        className: 'draw-drag-marker',
                        html: `<div style="width:14px; height:14px; background:#2ec4b6; border:2px solid #fff; border-radius:50%; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    })
                });
                
                marker.on('drag', (e) => {
                    currentPolygonPoints[index] = e.target.getLatLng();
                    currentPolygonLine.setLatLngs(currentPolygonPoints);
                    if (currentPolygonPoints.length > 2) {
                        currentPolygonFill.setLatLngs(currentPolygonPoints);
                    }
                });
                
                drawMarkers.addLayer(marker);
            });
        }
    }
"""

# Let's insert renderDrawMarkers() right before btnFinishArea
content = content.replace("btnFinishArea.addEventListener('click', () => {", draw_render_func + "\n\n    btnFinishArea.addEventListener('click', () => {")

# In map click for drawMode == 'area', call renderDrawMarkers()
# The original code:
#         } else if (drawMode === 'area') {
#             const latlng = e.latlng;
#             currentPolygonPoints.push(latlng);
#             currentPolygonLine.setLatLngs(currentPolygonPoints);
#             if (currentPolygonPoints.length > 2) {
#                 currentPolygonFill.setLatLngs(currentPolygonPoints);
#             }
#         }
old_draw_area_click = """} else if (drawMode === 'area') {
            const latlng = e.latlng;
            currentPolygonPoints.push(latlng);
            currentPolygonLine.setLatLngs(currentPolygonPoints);
            if (currentPolygonPoints.length > 2) {
                currentPolygonFill.setLatLngs(currentPolygonPoints);
            }
        }"""
new_draw_area_click = """} else if (drawMode === 'area') {
            const latlng = e.latlng;
            currentPolygonPoints.push(latlng);
            currentPolygonLine.setLatLngs(currentPolygonPoints);
            if (currentPolygonPoints.length > 2) {
                currentPolygonFill.setLatLngs(currentPolygonPoints);
            }
            renderDrawMarkers();
        }"""
content = content.replace(old_draw_area_click, new_draw_area_click)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
