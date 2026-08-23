/**
 * Cliente de comunicação com a API do backend FastAPI
 * Gerencia todas as requisições ao servidor de estresse hídrico
 */
export default class ApiClient {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.sessionId = null;
        this.varietiesCache = null;
        this.lastResults = null;
    }

    /**
     * Verifica se o backend está acessível
     */
    async checkConnection() {
        try {
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(`${this.baseUrl}/`, { signal: ctrl.signal });
            clearTimeout(timeout);
            return res.ok;
        } catch {
            return false;
        }
    }

    /**
     * Envia GeoJSON + parâmetros e inicia a análise completa
     */
    async analyzeGeoJSON(geojson, options = {}) {
        const {
            startDate = '',
            endDate = '',
            cloudThreshold = 20,
            weights = null
        } = options;

        const body = {
            geojson,
            start_date: startDate,
            end_date: endDate,
            cloud_threshold: cloudThreshold,
        };
        if (weights) body.weights = weights;

        // Timeout de 10 minutos para análise (múltiplos talhões podem demorar)
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 10 * 60 * 1000);

        try {
            const res = await fetch(`${this.baseUrl}/api/analyze/json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: ctrl.signal
            });
            clearTimeout(timeout);

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Erro desconhecido' }));
                throw new Error(err.detail || `Erro ${res.status}`);
            }

            const data = await res.json();
            this.sessionId = data.session_id;
            this.lastResults = data;
            return data;
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') throw new Error('Tempo limite excedido (10 min). Reduza o número de talhões ou aumente o período.');
            throw err;
        }
    }

    /**
     * Envia arquivo (GeoJSON/SHP/KML) via FormData
     */
    async analyzeFile(file, options = {}) {
        const { startDate = '', endDate = '', cloudThreshold = 20 } = options;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('start_date', startDate);
        formData.append('end_date', endDate);
        formData.append('cloud_threshold', String(cloudThreshold));

        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 10 * 60 * 1000);

        try {
            const res = await fetch(`${this.baseUrl}/api/analyze`, {
                method: 'POST',
                body: formData,
                signal: ctrl.signal
            });
            clearTimeout(timeout);

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Erro desconhecido' }));
                throw new Error(err.detail || `Erro ${res.status}`);
            }

            const data = await res.json();
            this.sessionId = data.session_id;
            this.lastResults = data;
            return data;
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') throw new Error('Tempo limite excedido.');
            throw err;
        }
    }

    /**
     * Busca lista de variedades (com cache)
     */
    async getVarieties() {
        if (this.varietiesCache) return this.varietiesCache;
        const data = await this._request('/api/varieties');
        this.varietiesCache = data.variedades || [];
        return this.varietiesCache;
    }

    /**
     * Exporta CSV
     */
    async exportCSV(sessionId = null) {
        const sid = sessionId || this.sessionId;
        if (!sid) throw new Error('Nenhuma sessão ativa. Execute a análise primeiro.');
        const res = await fetch(`${this.baseUrl}/api/export/csv?session_id=${sid}`);
        if (!res.ok) throw new Error('Falha ao exportar CSV');
        return res.blob();
    }

    /**
     * Exporta PDF
     */
    async exportPDF(sessionId = null) {
        const sid = sessionId || this.sessionId;
        if (!sid) throw new Error('Nenhuma sessão ativa. Execute a análise primeiro.');
        const res = await fetch(`${this.baseUrl}/api/export/pdf?session_id=${sid}`);
        if (!res.ok) throw new Error('Falha ao exportar PDF');
        return res.blob();
    }

    /**
     * Exporta GeoJSON classificado
     */
    async exportGeoJSON(sessionId = null) {
        const sid = sessionId || this.sessionId;
        if (!sid) throw new Error('Nenhuma sessão ativa. Execute a análise primeiro.');
        return this._request(`/api/export/geojson?session_id=${sid}`);
    }

    /**
     * Trigger de download de Blob no browser
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Request genérico com tratamento de erros
     */
    async _request(endpoint, options = {}) {
        const res = await fetch(`${this.baseUrl}${endpoint}`, options);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: `Erro HTTP ${res.status}` }));
            throw new Error(err.detail || `Erro ${res.status}`);
        }
        return res.json();
    }
}
