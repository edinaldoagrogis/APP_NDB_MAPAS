import re

# 1. Update car/car.js to load layers from IndexedDB
with open('car/car.js', 'r', encoding='utf-8') as f:
    car_js = f.read()

idb_logic = """
function initMap() {
    const request = indexedDB.open('AgrogisDB', 1);
    request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('layers')) {
            proceedInitMap();
            return;
        }
        const tx = db.transaction('layers', 'readonly');
        const store = tx.objectStore('layers');
        const req = store.get('importedLayers');
        req.onsuccess = (ev) => {
            if (ev.target.result) {
                window.GEOPORTAL_LAYERS = JSON.parse(ev.target.result);
            }
            proceedInitMap();
        };
        req.onerror = () => proceedInitMap();
    };
    request.onerror = () => proceedInitMap();
}

function proceedInitMap() {
    map = L.map('car-map', {
        zoomControl: true,
        maxZoom: 20
    }).setView([-18.1, -40.1], 10);
"""
car_js = re.sub(r'function initMap\(\) \{\s+map = L\.map\(\'car-map\'\, \{[\s\S]*?\}\)\.setView\(\[-18\.1, -40\.1\], 10\);', idb_logic.strip(), car_js)

# Fix extracting Fazendas
# The old code expects `f.properties.NAME` or `f.properties.Fazenda`
# But in our updated build_layers_optimized, the property might be `NOME` or `FAZENDA`.
# Let's add more robust property checking.
fix_fazendas = """
    if (GEOPORTAL_LAYERS["FAZENDAS"] && GEOPORTAL_LAYERS["FAZENDAS"].features) {
        allFazendas = GEOPORTAL_LAYERS["FAZENDAS"].features.map(f => {
            const props = f.properties;
            const name = props.NOME || props.nome || props.FAZENDA || props.Fazenda || props.NAME || 'Desconhecido';
            let coords = null;
            if (f.geometry.type === 'Point') {
                coords = f.geometry.coordinates;
            } else if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
                // Approximate center from first coordinate array
                let pts = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
                let lon = 0, lat = 0;
                pts.forEach(p => { lon += p[0]; lat += p[1]; });
                coords = [lon/pts.length, lat/pts.length];
            }
            return { name: name, coords: coords };
        }).filter(f => f.coords && f.coords.length >= 2);
    }
"""
car_js = re.sub(r'if \(GEOPORTAL_LAYERS\["FAZENDAS"\] && GEOPORTAL_LAYERS\["FAZENDAS"\]\.features\) \{[\s\S]*?\}\)', fix_fazendas.strip(), car_js)

with open('car/car.js', 'w', encoding='utf-8') as f:
    f.write(car_js)


# 2. Update car/car.html back button
with open('car/car.html', 'r', encoding='utf-8') as f:
    car_html = f.read()
    
car_html = car_html.replace("window.location.href='../index.html?force_reload=true'", "if(window.parent && window.parent.document.getElementById('car-iframe')) { window.parent.document.getElementById('car-iframe').remove(); } else { window.location.href='../index.html'; }")
with open('car/car.html', 'w', encoding='utf-8') as f:
    f.write(car_html)


# 3. Update index.html to use iframe
with open('index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

iframe_func = """
    <script>
        function openCarTool() {
            const iframe = document.createElement('iframe');
            iframe.src = 'car/car.html';
            iframe.id = 'car-iframe';
            iframe.style.position = 'fixed';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.zIndex = '999999';
            document.body.appendChild(iframe);
        }
    </script>
</head>
"""
index_html = index_html.replace("</head>", iframe_func)
index_html = index_html.replace("window.location.href='car/car.html'", "openCarTool()")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(index_html)
