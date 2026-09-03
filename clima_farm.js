// =====================================================================
// CLIMA FARM — Módulo Climático Agrícola
// API: Open-Meteo (https://open-meteo.com) — Gratuita, sem chave
// Modelo: ECMWF / NOAA | Atualização: a cada hora
// =====================================================================

(function () {
    'use strict';

    // ─── Estado do módulo ─────────────────────────────────────────────
    let isActive = false;
    let currentRequest = null; // AbortController para cancelar fetch
    let lastFetchedLatLng = null;

    // ─── Mapeamento WMO Weather Codes → PT-BR ─────────────────────────
    const WMO_MAP = {
        0:  { label: 'Céu Limpo',           icon: '☀️' },
        1:  { label: 'Principalmente Limpo', icon: '🌤️' },
        2:  { label: 'Parcialmente Nublado', icon: '⛅' },
        3:  { label: 'Nublado',              icon: '☁️' },
        45: { label: 'Névoa',                icon: '🌫️' },
        48: { label: 'Névoa com Geada',      icon: '🌫️' },
        51: { label: 'Garoa Leve',           icon: '🌦️' },
        53: { label: 'Garoa Moderada',       icon: '🌦️' },
        55: { label: 'Garoa Intensa',        icon: '🌧️' },
        61: { label: 'Chuva Leve',           icon: '🌧️' },
        63: { label: 'Chuva Moderada',       icon: '🌧️' },
        65: { label: 'Chuva Forte',          icon: '🌧️' },
        71: { label: 'Neve Leve',            icon: '🌨️' },
        73: { label: 'Neve Moderada',        icon: '🌨️' },
        75: { label: 'Neve Intensa',         icon: '❄️' },
        77: { label: 'Granizo',              icon: '🌨️' },
        80: { label: 'Pancadas Leves',       icon: '⛈️' },
        81: { label: 'Pancadas Moderadas',   icon: '⛈️' },
        82: { label: 'Pancadas Fortes',      icon: '⛈️' },
        85: { label: 'Neve com Vento',       icon: '❄️' },
        86: { label: 'Neve Forte',           icon: '❄️' },
        95: { label: 'Tempestade',           icon: '⛈️' },
        96: { label: 'Tempestade c/ Granizo',icon: '⛈️' },
        99: { label: 'Tempestade Severa',    icon: '🌩️' },
    };

    function getWMO(code) {
        if (code === undefined || code === null) return { label: '—', icon: '🌡️' };
        return WMO_MAP[code] || { label: `Cód. ${code}`, icon: '🌡️' };
    }

    // ─── Nomes dos dias da semana ─────────────────────────────────────
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    function formatDate(dateStr) {
        // dateStr = "2024-08-15"
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return `${DIAS[date.getDay()]} ${d}/${m}`;
    }

    function windDir(deg) {
        if (deg === undefined || deg === null) return '';
        const dirs = ['N','NE','L','SE','S','SO','O','NO'];
        return dirs[Math.round(deg / 45) % 8];
    }

    // ─── Mostrar painel no estado "esperando talhão" ──────────────────
    function showWaitingState() {
        const panel = document.getElementById('clima-farm-panel');
        if (!panel) return;

        panel.style.display = 'flex';
        requestAnimationFrame(() => { panel.classList.add('cf-visible'); });

        panel.innerHTML = `
            <div class="cf-waiting-state">
                <div class="cf-waiting-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                    </svg>
                </div>
                <div class="cf-waiting-text">
                    <div class="cf-waiting-title">Clima Farm Ativado</div>
                    <div class="cf-waiting-sub">Clique em qualquer talhão no mapa para ver os dados climáticos</div>
                </div>
                <button id="cf-close-btn" class="cf-close-btn" title="Fechar Clima Farm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;
        document.getElementById('cf-close-btn').addEventListener('click', deactivate);
    }

    // ─── Mostrar estado de loading ────────────────────────────────────
    function showLoadingState(talhaoName) {
        const panel = document.getElementById('clima-farm-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="cf-loading-state">
                <div class="cf-spinner"></div>
                <div>
                    <div class="cf-loading-title">Buscando dados climáticos...</div>
                    <div class="cf-loading-sub">${talhaoName || 'Talhão selecionado'}</div>
                </div>
                <button id="cf-close-btn" class="cf-close-btn" title="Fechar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;
        document.getElementById('cf-close-btn').addEventListener('click', deactivate);
    }

    // ─── Renderizar dados meteorológicos ──────────────────────────────
    function renderWeather(data, props, lat, lng) {
        const panel = document.getElementById('clima-farm-panel');
        if (!panel) return;

        const cur = data.current;
        const daily = data.daily;

        const talhaoName = (props && (props.COD_TALHAO || props.TALHAO || props.NOME || props.CODIGO || props.ID)) || '—';
        const fazendaName = (props && (props.NOME_FAZ || props.FAZENDA || props.nome_faz)) || '';
        const wmo = getWMO(cur.weather_code);
        const temp = cur.temperature_2m !== undefined ? `${Math.round(cur.temperature_2m)}°C` : '—';
        const feelsLike = cur.apparent_temperature !== undefined ? `${Math.round(cur.apparent_temperature)}°C` : '—';
        const humidity = cur.relative_humidity_2m !== undefined ? `${cur.relative_humidity_2m}%` : '—';
        const windSpeed = cur.wind_speed_10m !== undefined ? `${Math.round(cur.wind_speed_10m * 3.6)} km/h` : '—';
        const windDirStr = cur.wind_direction_10m !== undefined ? windDir(cur.wind_direction_10m) : '';
        const rain = cur.precipitation !== undefined ? `${cur.precipitation.toFixed(1)} mm` : '—';
        const cloud = cur.cloud_cover !== undefined ? `${cur.cloud_cover}%` : '—';

        // Previsão 7 dias
        let forecastHtml = '';
        if (daily && daily.time) {
            daily.time.forEach((dateStr, i) => {
                const dayWmo = getWMO(daily.weather_code ? daily.weather_code[i] : 0);
                const tmax = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[i]) : '—';
                const tmin = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[i]) : '—';
                const rainDay = daily.precipitation_sum ? daily.precipitation_sum[i].toFixed(1) : '0.0';
                const dayLabel = formatDate(dateStr);
                forecastHtml += `
                    <div class="cf-day-card">
                        <div class="cf-day-label">${dayLabel}</div>
                        <div class="cf-day-icon">${dayWmo.icon}</div>
                        <div class="cf-day-temps">
                            <span class="cf-day-max">${tmax}°</span>
                            <span class="cf-day-min">${tmin}°</span>
                        </div>
                        <div class="cf-day-rain">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#60a5fa" stroke="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                            ${rainDay}mm
                        </div>
                    </div>
                `;
            });
        }

        const coordStr = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        panel.innerHTML = `
            <div class="cf-header">
                <div class="cf-header-left">
                    <div class="cf-condition-icon">${wmo.icon}</div>
                    <div>
                        <div class="cf-talhao-name">
                            ${fazendaName ? `<span class="cf-fazenda-tag">${fazendaName}</span>` : ''}
                            Talhão <strong>${talhaoName}</strong>
                        </div>
                        <div class="cf-condition-label">${wmo.label} · ${coordStr}</div>
                    </div>
                </div>
                <div class="cf-header-right">
                    <div class="cf-big-temp">${temp}</div>
                    <div class="cf-feels">Sensação ${feelsLike}</div>
                    <button id="cf-close-btn" class="cf-close-btn" title="Fechar Clima Farm">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>

            <div class="cf-metrics-row">
                <div class="cf-metric-card">
                    <div class="cf-metric-icon">🌧️</div>
                    <div class="cf-metric-value">${rain}</div>
                    <div class="cf-metric-label">Chuva Hoje</div>
                </div>
                <div class="cf-metric-card">
                    <div class="cf-metric-icon">💧</div>
                    <div class="cf-metric-value">${humidity}</div>
                    <div class="cf-metric-label">Umidade</div>
                </div>
                <div class="cf-metric-card">
                    <div class="cf-metric-icon">💨</div>
                    <div class="cf-metric-value">${windSpeed}</div>
                    <div class="cf-metric-label">Vento ${windDirStr}</div>
                </div>
                <div class="cf-metric-card">
                    <div class="cf-metric-icon">☁️</div>
                    <div class="cf-metric-value">${cloud}</div>
                    <div class="cf-metric-label">Nebulosidade</div>
                </div>
            </div>

            <div class="cf-forecast-row">
                ${forecastHtml}
            </div>

            <div class="cf-source-tag">
                ⚡ Open-Meteo · ECMWF · Atualizado há poucos minutos
            </div>
        `;

        document.getElementById('cf-close-btn').addEventListener('click', deactivate);
    }

    // ─── Buscar dados da API Open-Meteo ──────────────────────────────
    async function fetchData(lat, lng, props) {
        if (!isActive) return;

        // Cancela request anterior
        if (currentRequest) {
            currentRequest.abort();
        }
        currentRequest = new AbortController();

        const talhaoName = (props && (props.COD_TALHAO || props.TALHAO || props.NOME || props.CODIGO)) || 'Talhão';
        showLoadingState(talhaoName);

        const url = `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}` +
            `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,precipitation,cloud_cover` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
            `&wind_speed_unit=ms` +
            `&timezone=America%2FSao_Paulo` +
            `&forecast_days=7`;

        try {
            const resp = await fetch(url, { signal: currentRequest.signal });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            lastFetchedLatLng = { lat, lng };
            renderWeather(data, props, lat, lng);
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('[ClimaFarm] Erro ao buscar dados:', err);
            showError(talhaoName);
        }
    }

    // ─── Mostrar estado de erro ───────────────────────────────────────
    function showError(talhaoName) {
        const panel = document.getElementById('clima-farm-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="cf-loading-state">
                <div style="font-size:28px;">⚠️</div>
                <div>
                    <div class="cf-loading-title" style="color:#f87171;">Erro ao buscar dados climáticos</div>
                    <div class="cf-loading-sub">${talhaoName || ''} · Verifique sua conexão</div>
                </div>
                <button id="cf-close-btn" class="cf-close-btn" title="Fechar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;
        document.getElementById('cf-close-btn').addEventListener('click', deactivate);
    }

    // ─── Ativar ferramenta ────────────────────────────────────────────    // 🚀 Ativar ferramenta 🚀
    function activate() {
        isActive = true;
        window.climaFarmActive = true;
        document.body.classList.add('clima-farm-active');

        // Hide side controls
        document.querySelectorAll('.leaflet-right, .leaflet-left').forEach(el => el.style.display = 'none');

        const btn = document.getElementById('btn-clima-farm-control');
        if (btn) {
            btn.style.borderColor = '#38bdf8';
            btn.style.boxShadow = '0 0 14px rgba(56,189,248,0.4)';
            btn.style.background = 'rgba(56,189,248,0.2)';
            const icon = btn.querySelector('.cf-btn-icon');
            if (icon) icon.style.fill = '#38bdf8';
        }

        showWaitingState();
    }

    // 🚀 Desativar ferramenta 🚀
    function deactivate() {
        isActive = false;
        window.climaFarmActive = false;
        document.body.classList.remove('clima-farm-active');

        // Show side controls
        document.querySelectorAll('.leaflet-right, .leaflet-left').forEach(el => el.style.display = '');

        // Clear selection
        if (window.clearAllSelections) window.clearAllSelections();

        if (currentRequest) {
            currentRequest.abort();
            currentRequest = null;
        }

        const btn = document.getElementById('btn-clima-farm-control');
        if (btn) {
            btn.style.borderColor = 'rgba(255,255,255,0.1)';
            btn.style.boxShadow = 'none';
            btn.style.background = 'var(--bg-secondary)';
            const icon = btn.querySelector('.cf-btn-icon');
            if (icon) icon.style.opacity = '0.85';
        }

        const panel = document.getElementById('clima-farm-panel');
        if (panel) {
            panel.classList.remove('cf-visible');
            setTimeout(() => {
                panel.style.display = 'none';
                panel.innerHTML = '';
            }, 320);
        }
    }


    // ─── Toggle ───────────────────────────────────────────────────────
    function toggle() {
        if (isActive) {
            deactivate();
        } else {
            activate();
        }
    }

    // ─── Expor para uso global (app.js + controle Leaflet) ───────────
    window.climaFarmActive  = false;
    window.climaFarmFetchData = fetchData;
    window.climaFarmToggle  = toggle;
    window.climaFarmDeactivate = deactivate;

    // ─── Inicializar após DOM pronto ──────────────────────────────────
    function init() {
        // O painel HTML já está no index.html, nada a criar aqui.
        // O controle Leaflet é adicionado pelo app.js.
        console.log('[ClimaFarm] Módulo carregado ✓');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
