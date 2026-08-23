/**
 * Controlador do Mapa Leaflet para o Monitor de Estresse Hídrico
 * Gerencia camadas temáticas, popups e legenda
 */
export default class MapController {
    constructor(mapElementId) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.talhaoLayer = null;
        this.thematicLayer = null;
        this.legendEl = null;
        this.currentLayer = 'ieh';
        this.onFeatureClickCb = null;

        // Escala de cores para índices contínuos (0=bom, 1=ruim)
        this.indexColorScales = {
            ndvi:  (v) => this._linearColor(v, [[0,'#ef4444'],[0.3,'#f97316'],[0.6,'#eab308'],[0.9,'#22c55e']]),
            ndwi:  (v) => this._linearColor((v + 1) / 2, [[0,'#ef4444'],[0.4,'#f97316'],[0.6,'#eab308'],[1,'#22c55e']]),
            msi:   (v) => this._linearColor(v / 3, [[0,'#22c55e'],[0.3,'#eab308'],[0.6,'#f97316'],[1,'#ef4444']]),
            nmdi:  (v) => this._linearColor((1 - v) / 2, [[0,'#22c55e'],[0.4,'#eab308'],[0.7,'#f97316'],[1,'#ef4444']]),
        };
    }

    init() {
        this.map = L.map(this.mapElementId, {
            zoomControl: false,
            attributionControl: true,
        });
        this.map.setView([-15, -51], 5);

        // Basemaps
        const basemaps = {
            'Satélite (Esri)': L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { maxZoom: 19, attribution: 'Esri WorldImagery' }
            ),
            'OpenStreetMap': L.tileLayer(
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                { maxZoom: 19, attribution: '&copy; OpenStreetMap' }
            ),
            'CartoDB Dark': L.tileLayer(
                'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                { maxZoom: 19, attribution: '&copy; CartoDB' }
            ),
        };

        // Satélite como padrão
        basemaps['Satélite (Esri)'].addTo(this.map);

        // Controles
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
        L.control.layers(basemaps, {}, { position: 'bottomright' }).addTo(this.map);

        // Legenda
        this._createLegend();

        return this.map;
    }

    /**
     * Carrega os talhões no mapa sem classificação (estilo neutro)
     */
    loadTalhoes(geojson) {
        if (this.talhaoLayer) this.map.removeLayer(this.talhaoLayer);
        if (this.thematicLayer) { this.map.removeLayer(this.thematicLayer); this.thematicLayer = null; }

        this.talhaoLayer = L.geoJSON(geojson, {
            style: {
                fillColor: 'rgba(46,196,182,0.2)',
                color: '#2ec4b6',
                weight: 2,
                fillOpacity: 0.3,
                dashArray: '4'
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const popup = `
                    <div class="ieh-popup">
                        <h3>Talhão ${p.id_talhao}</h3>
                        <div class="metric"><span class="metric-label">Variedade</span><span class="metric-value">${p.variedade || 'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">Área</span><span class="metric-value">${(p.area_ha||0).toFixed(1)} ha</span></div>
                        <div class="metric"><span class="metric-label">Estágio</span><span class="metric-value">${p.estagio_desenvolvimento || 'N/D'}</span></div>
                        <em style="font-size:11px;color:#94a3b8">Execute a análise para ver o IEH</em>
                    </div>`;
                layer.bindPopup(popup, { maxWidth: 280 });
                layer.on('click', () => { if (this.onFeatureClickCb) this.onFeatureClickCb(feature, layer); });
            }
        }).addTo(this.map);

        const bounds = this.talhaoLayer.getBounds();
        if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [40, 40] });
        return bounds;
    }

    /**
     * Renderiza camada temática do IEH com classificação por cores
     */
    renderIEH(resultadoGeoJSON) {
        if (this.thematicLayer) this.map.removeLayer(this.thematicLayer);
        if (this.talhaoLayer) this.map.removeLayer(this.talhaoLayer);

        const getColor = (props) => {
            if (!props.ieh_cor) return '#64748b';
            return props.ieh_cor;
        };

        this.thematicLayer = L.geoJSON(resultadoGeoJSON, {
            style: (feature) => ({
                fillColor: getColor(feature.properties),
                color: '#ffffff',
                weight: 1.5,
                fillOpacity: 0.72,
            }),
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const iehPct = p.ieh_value != null ? (p.ieh_value * 100).toFixed(1) + '%' : 'N/D';
                const popup = `
                    <div class="ieh-popup">
                        <h3>Talhão ${p.id_talhao}</h3>
                        <div style="display:flex;justify-content:center;margin-bottom:8px">
                            <span style="background:${p.ieh_cor||'#64748b'};color:${p.ieh_classe==='Estresse Leve'?'#000':'#fff'};padding:3px 14px;border-radius:20px;font-size:12px;font-weight:700">
                                ${p.ieh_classe || 'Sem Dados'}
                            </span>
                        </div>
                        <div class="metric"><span class="metric-label">Variedade</span><span class="metric-value">${p.variedade||'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">Área</span><span class="metric-value">${(p.area_ha||0).toFixed(1)} ha</span></div>
                        <hr style="border:0;border-top:1px solid #e2e8f0;margin:8px 0">
                        <div class="metric"><span class="metric-label">IEH</span><span class="metric-value" style="font-size:15px;color:${p.ieh_cor}">${iehPct}</span></div>
                        <div class="metric"><span class="metric-label">NDVI</span><span class="metric-value">${p.ndvi != null ? p.ndvi.toFixed(3) : 'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">NDWI</span><span class="metric-value">${p.ndwi != null ? p.ndwi.toFixed(3) : 'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">MSI</span><span class="metric-value">${p.msi != null ? p.msi.toFixed(3) : 'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">Argila</span><span class="metric-value">${p.argila_pct != null ? p.argila_pct.toFixed(1) + '%' : 'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">TWI</span><span class="metric-value">${p.twi != null ? p.twi.toFixed(2) : 'N/D'}</span></div>
                        ${p.data_imagem ? `<div style="font-size:10px;color:#94a3b8;margin-top:8px">Imagem: ${p.data_imagem} &bull; Nuvens: ${p.cobertura_nuvens_pct||'?'}%</div>` : ''}
                    </div>`;
                layer.bindPopup(popup, { maxWidth: 300 });
                layer.on('click', () => { if (this.onFeatureClickCb) this.onFeatureClickCb(feature, layer); });
                layer.on('mouseover', () => layer.setStyle({ weight: 3, color: '#fff' }));
                layer.on('mouseout', () => this.thematicLayer.resetStyle(layer));
            }
        }).addTo(this.map);

        this.currentLayer = 'ieh';
        this.updateLegend('ieh');

        const bounds = this.thematicLayer.getBounds();
        if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [30, 30] });
    }

    /**
     * Renderiza camada colorizada por um índice espectral
     */
    renderLayerIndex(indexName, resultadoGeoJSON) {
        if (this.thematicLayer) this.map.removeLayer(this.thematicLayer);
        if (this.talhaoLayer) this.map.removeLayer(this.talhaoLayer);

        const colorFn = this.indexColorScales[indexName] || (() => '#94a3b8');

        this.thematicLayer = L.geoJSON(resultadoGeoJSON, {
            style: (feature) => {
                const val = feature.properties[indexName];
                return {
                    fillColor: val != null ? colorFn(val) : '#64748b',
                    color: '#ffffff',
                    weight: 1.5,
                    fillOpacity: 0.72,
                };
            },
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const val = p[indexName];
                layer.bindPopup(`
                    <div class="ieh-popup">
                        <h3>Talhão ${p.id_talhao}</h3>
                        <div class="metric"><span class="metric-label">${indexName.toUpperCase()}</span><span class="metric-value" style="font-size:16px">${val != null ? val.toFixed(4) : 'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">Variedade</span><span class="metric-value">${p.variedade||'N/D'}</span></div>
                        <div class="metric"><span class="metric-label">IEH</span><span class="metric-value">${p.ieh_value != null ? (p.ieh_value*100).toFixed(1)+'%' : 'N/D'}</span></div>
                    </div>`, { maxWidth: 250 });
                layer.on('mouseover', () => layer.setStyle({ weight: 3, color: '#fff' }));
                layer.on('mouseout', () => this.thematicLayer.resetStyle(layer));
            }
        }).addTo(this.map);

        this.currentLayer = indexName;
        this.updateLegend(indexName);
    }

    /**
     * Atualiza o painel de legenda
     */
    updateLegend(type) {
        if (!this.legendEl) return;

        const legends = {
            ieh: [
                { cor: '#22c55e', label: 'Sem Estresse (IEH \u2264 0.25)' },
                { cor: '#eab308', label: 'Estresse Leve (0.25-0.50)' },
                { cor: '#f97316', label: 'Estresse Moderado (0.50-0.75)' },
                { cor: '#ef4444', label: 'Estresse Severo (> 0.75)' },
                { cor: '#64748b', label: 'Sem dados' },
            ],
            ndvi: [
                { cor: '#ef4444', label: 'Baixo NDVI (< 0.3)' },
                { cor: '#eab308', label: 'Médio (0.3-0.6)' },
                { cor: '#22c55e', label: 'Alto NDVI (> 0.6)' },
            ],
            ndwi: [
                { cor: '#ef4444', label: 'Solo Seco (< -0.2)' },
                { cor: '#eab308', label: 'Médio' },
                { cor: '#22c55e', label: 'Elevada Umidade (> 0.2)' },
            ],
            msi: [
                { cor: '#22c55e', label: 'Baixo MSI (úmido)' },
                { cor: '#eab308', label: 'Médio' },
                { cor: '#ef4444', label: 'Alto MSI (seco)' },
            ],
            nmdi: [
                { cor: '#22c55e', label: 'Sem Seca' },
                { cor: '#eab308', label: 'Seca Moderada' },
                { cor: '#ef4444', label: 'Seca Severa' },
            ],
        };

        const titles = { ieh: 'IEH — Estresse Hídrico', ndvi: 'Índice NDVI', ndwi: 'Índice NDWI', msi: 'MSI (Umidade)', nmdi: 'NMDI (Seca)' };
        const items = legends[type] || legends.ieh;

        this.legendEl.innerHTML = `
            <div class="legend-title">${titles[type] || type.toUpperCase()}</div>
            ${items.map(i => `<div class="legend-item"><div class="legend-dot" style="background:${i.cor}"></div>${i.label}</div>`).join('')}`;
    }

    onFeatureClick(callback) {
        this.onFeatureClickCb = callback;
    }

    clearResults() {
        if (this.thematicLayer) { this.map.removeLayer(this.thematicLayer); this.thematicLayer = null; }
        if (this.talhaoLayer) { this.map.removeLayer(this.talhaoLayer); this.talhaoLayer = null; }
    }

    fitToTalhoes() {
        const layer = this.thematicLayer || this.talhaoLayer;
        if (layer) {
            const b = layer.getBounds();
            if (b.isValid()) this.map.fitBounds(b, { padding: [40, 40] });
        }
    }

    _createLegend() {
        const LegendControl = L.Control.extend({
            onAdd: (map) => {
                const div = L.DomUtil.create('div', 'map-legend');
                this.legendEl = div;
                this.updateLegend('ieh');
                return div;
            }
        });
        new LegendControl({ position: 'bottomright' }).addTo(this.map);
    }

    /**
     * Interpola cores em uma escala linear de paradas
     */
    _linearColor(t, stops) {
        t = Math.max(0, Math.min(1, t));
        for (let i = 0; i < stops.length - 1; i++) {
            const [t0, c0] = stops[i];
            const [t1, c1] = stops[i+1];
            if (t >= t0 && t <= t1) {
                const f = (t - t0) / (t1 - t0);
                return this._lerpColor(c0, c1, f);
            }
        }
        return stops[stops.length - 1][1];
    }

    _lerpColor(c0, c1, t) {
        const hex = (s) => parseInt(s, 16);
        const r = (h) => [hex(h.slice(1,3)), hex(h.slice(3,5)), hex(h.slice(5,7))];
        const [r0, g0, b0] = r(c0);
        const [r1, g1, b1] = r(c1);
        const ri = Math.round(r0 + (r1 - r0) * t).toString(16).padStart(2,'0');
        const gi = Math.round(g0 + (g1 - g0) * t).toString(16).padStart(2,'0');
        const bi = Math.round(b0 + (b1 - b0) * t).toString(16).padStart(2,'0');
        return `#${ri}${gi}${bi}`;
    }
}
