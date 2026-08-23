/**
 * Gerenciador de Upload de Arquivos de Talhões
 * Suporta GeoJSON, Shapefile (.zip) e KML
 */
export default class UploadManager {
    constructor({ dropZone, fileInput, onSuccess, onError, onProgress }) {
        this.dropZone = dropZone;
        this.fileInput = fileInput;
        this.onSuccess = onSuccess || (() => {});
        this.onError = onError || (() => {});
        this.onProgress = onProgress || (() => {});
    }

    init() {
        // Eventos drag-and-drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });
        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file);
        });
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFile(file);
        });
    }

    async handleFile(file) {
        const name = file.name.toLowerCase();
        this.onProgress(10, `Lendo arquivo: ${file.name}...`);
        try {
            let geojson;
            if (name.endsWith('.zip')) {
                geojson = await this.parseShapefile(file);
            } else if (name.endsWith('.kml')) {
                geojson = await this.parseKML(file);
            } else if (name.endsWith('.geojson') || name.endsWith('.json')) {
                geojson = await this.parseGeoJSON(file);
            } else {
                throw new Error('Formato não suportado. Use GeoJSON, Shapefile (.zip) ou KML.');
            }
            this.onProgress(80, 'Validando geometrias...');
            geojson = this.validateGeoJSON(geojson);
            const stats = this.getFileStats(geojson);
            this.onProgress(100, 'Arquivo carregado com sucesso!');
            this.onSuccess(geojson, stats);
            this.dropZone.classList.add('has-file');
        } catch (err) {
            this.onError(err.message);
        }
    }

    parseGeoJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try { resolve(JSON.parse(e.target.result)); }
                catch { reject(new Error('GeoJSON inválido: verifique o formato do arquivo.')); }
            };
            reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
            reader.readAsText(file);
        });
    }

    async parseShapefile(file) {
        // Usa biblioteca shpjs (carregada via CDN)
        if (typeof shp === 'undefined') {
            throw new Error('Biblioteca shpjs não carregada. Verifique sua conexão.');
        }
        const arrayBuffer = await file.arrayBuffer();
        const geojson = await shp(arrayBuffer);
        // shpjs pode retornar array de GeoJSONs (uma por layer)
        if (Array.isArray(geojson)) return geojson[0];
        return geojson;
    }

    parseKML(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parser = new DOMParser();
                    const kml = parser.parseFromString(e.target.result, 'text/xml');
                    const geojson = this._kmlToGeoJSON(kml);
                    resolve(geojson);
                } catch (err) {
                    reject(new Error(`Erro ao processar KML: ${err.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Erro ao ler o arquivo KML.'));
            reader.readAsText(file);
        });
    }

    _kmlToGeoJSON(kml) {
        const features = [];
        const placemarks = kml.querySelectorAll('Placemark');
        
        placemarks.forEach((pm, idx) => {
            const nameEl = pm.querySelector('name');
            const name = nameEl ? nameEl.textContent.trim() : `Talhão ${idx + 1}`;
            
            // Tenta Polygon
            const polygonEl = pm.querySelector('Polygon');
            if (polygonEl) {
                const coordsEl = polygonEl.querySelector('outerBoundaryIs coordinates') ||
                                 polygonEl.querySelector('coordinates');
                if (coordsEl) {
                    const coords = coordsEl.textContent.trim().split(/\s+/).map(c => {
                        const [lon, lat] = c.split(',').map(Number);
                        return [lon, lat];
                    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
                    
                    if (coords.length >= 3) {
                        features.push({
                            type: 'Feature',
                            properties: { id_talhao: `T${idx + 1}`, nome: name },
                            geometry: { type: 'Polygon', coordinates: [coords] }
                        });
                    }
                }
            }
        });
        
        if (features.length === 0) {
            throw new Error('Nenhum polígono (Placemark) encontrado no KML.');
        }
        
        return { type: 'FeatureCollection', features };
    }

    validateGeoJSON(geojson) {
        let features = [];
        
        if (geojson.type === 'FeatureCollection') {
            features = geojson.features || [];
        } else if (geojson.type === 'Feature') {
            features = [geojson];
        } else {
            throw new Error('GeoJSON deve ser FeatureCollection ou Feature.');
        }
        
        // Filtra apenas polígonos
        features = features.filter(f => {
            const t = f.geometry?.type;
            return t === 'Polygon' || t === 'MultiPolygon';
        });
        
        if (features.length === 0) {
            throw new Error('Nenhum polígono encontrado. O arquivo deve conter delimitá de talhões (Polygon/MultiPolygon).');
        }
        
        // Garante id_talhao em cada feature
        features.forEach((feat, idx) => {
            if (!feat.properties) feat.properties = {};
            const p = feat.properties;
            if (!p.id_talhao && !p.ID_TALHAO && !p.TALHAO) {
                p.id_talhao = `T${String(idx + 1).padStart(3, '0')}`;
            } else if (!p.id_talhao) {
                p.id_talhao = p.ID_TALHAO || p.TALHAO || p.COD_TALHAO || `T${idx + 1}`;
            }
            // Normaliza variedade
            if (!p.variedade) {
                p.variedade = p.VARIEDADE || p.VAR || p.cultivar || '';
            }
        });
        
        return { type: 'FeatureCollection', features };
    }

    getFileStats(geojson) {
        const features = geojson.features || [];
        const hasVariedade = features.some(f => f.properties?.variedade);
        const hasCortePlantio = features.some(f => f.properties?.data_corte_plantio);
        
        // Calcula bbox
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        features.forEach(f => {
            const coords = this._extractCoords(f.geometry);
            coords.forEach(([x, y]) => {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            });
        });
        
        return {
            featureCount: features.length,
            bounds: [minX, minY, maxX, maxY],
            hasVariedade,
            hasCortePlantio,
            center: [(minX + maxX) / 2, (minY + maxY) / 2]
        };
    }

    _extractCoords(geometry) {
        const coords = [];
        const extract = (arr, depth) => {
            if (depth === 0) { coords.push(arr); return; }
            arr.forEach(item => extract(item, depth - 1));
        };
        if (geometry.type === 'Polygon') extract(geometry.coordinates, 2);
        else if (geometry.type === 'MultiPolygon') extract(geometry.coordinates, 3);
        return coords;
    }
}
