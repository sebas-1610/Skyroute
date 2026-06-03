/* ─────────────────────────────────────────────────────────────────
   planificador.js
   R2 — Planificación básica: criterios múltiples, filtro de hubs,
        restricciones condicionales y render multi-resultado.
   ───────────────────────────────────────────────────────────────── */

'use strict';

// ── State ────────────────────────────────────────────────────────
let nodos         = [];
let aristas       = [];
let configuracion = {};

// ── Criteria → constraint-input mapping ─────────────────────────
const CRITERIO_META = {
    costo:     { group: 'budget-group',   input: 'presupuesto',   label: 'Costo USD',  unit: 'USD', icon: '💲' },
    tiempo:    { group: 'time-group',     input: 'tiempo',        label: 'Tiempo',     unit: 'h',   icon: '⏱' },
    distancia: { group: 'distance-group', input: 'distancia-max', label: 'Distancia',  unit: 'km',  icon: '📏' },
};

// ── Restore state from localStorage ──────────────────────────────
function restorePlannerState() {
    const saved = localStorage.getItem('skyroute_planner_state');
    if (!saved) return;

    try {
        const state = JSON.parse(saved);

        // Restore network JSON if available
        const networkRaw = localStorage.getItem('skyroute_network');
        if (networkRaw) {
            const network = JSON.parse(networkRaw);
            nodos         = network.nodos   || [];
            aristas       = network.aristas || [];
            configuracion = network.configuracion || {};
            populateSelects();
            document.getElementById('file-label').classList.add('loaded');
            document.getElementById('file-label-text').textContent = '✓ JSON restaurado';
            document.getElementById('file-name').textContent =
                nodos.length + ' aeropuertos · ' + aristas.length + ' rutas cargadas';
        }

        // Restore form fields
        if (state.origen)   document.getElementById('origen').value = state.origen;
        if (state.destino)  document.getElementById('destino').value = state.destino;

        // Restore criteria checkboxes
        if (state.criterios) {
            state.criterios.forEach(c => {
                const cb = document.querySelector('input[name="criterio"][value="' + c + '"]');
                if (cb) cb.checked = true;
            });
            syncConstraintVisibility();
        }

        // Restore constraint values
        if (state.presupuesto)   document.getElementById('presupuesto').value = state.presupuesto;
        if (state.tiempo)        document.getElementById('tiempo').value = state.tiempo;
        if (state.distanciaMax)  document.getElementById('distancia-max').value = state.distanciaMax;

        // Restore secondary airports toggle
        if (state.secundarios !== undefined) {
            document.getElementById('toggle-secundarios')
                .setAttribute('aria-pressed', String(state.secundarios));
        }

        // Restore results panels
        const resultsRaw = localStorage.getItem('skyroute_results');
        if (resultsRaw) {
            const results = JSON.parse(resultsRaw);
            renderMultiResults(results);
        }
    } catch (_) { /* ignore corrupt state */ }
}

restorePlannerState();

// ── JSON load ────────────────────────────────────────────────────
document.getElementById('json-file').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            const json    = JSON.parse(ev.target.result);
            nodos         = json.nodos   || json.aeropuertos || [];
            aristas       = json.aristas || json.rutas       || [];
            configuracion = json.configuracion || {};
            localStorage.setItem('skyroute_network', JSON.stringify({ nodos, aristas, configuracion }));
            localStorage.removeItem('skyroute_results');
            populateSelects();
            document.getElementById('file-label').classList.add('loaded');
            document.getElementById('file-label-text').textContent = '✓ ' + file.name;
            document.getElementById('file-name').textContent =
                nodos.length + ' aeropuertos · ' + aristas.length + ' rutas cargadas';
        } catch (err) {
            ErrorHandler.handle('PARSING_ERROR', err.message, 'planificador.js:36');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ── Populate origin/destination selects ─────────────────────────
function populateSelects() {
    ['origen', 'destino'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">Seleccionar...</option>';
        nodos.forEach(a => {
            const label = a.id +
                (a.ciudad ? ' — ' + a.ciudad + (a.pais ? ', ' + a.pais : '') : '') +
                (a.esHub  ? ' ★' : '');
            sel.appendChild(new Option(label, a.id));
        });
    });
}

// ── Criteria checkboxes → show/hide constraint inputs ────────────
document.querySelectorAll('input[name="criterio"]').forEach(cb => {
    cb.addEventListener('change', syncConstraintVisibility);
});

function syncConstraintVisibility() {
    const checked = getCheckedCriteria();
    const wrapper = document.getElementById('constraints-wrapper');

    wrapper.style.display = checked.length ? 'flex' : 'none';

    Object.entries(CRITERIO_META).forEach(([key, meta]) => {
        document.getElementById(meta.group).style.display =
            checked.includes(key) ? 'block' : 'none';
    });

    const hint = document.getElementById('criteria-hint');
    if (checked.length === 0) {
        hint.textContent = 'Selecciona al menos un criterio. Con varios se calculará una ruta por cada uno.';
    } else if (checked.length === 1) {
        hint.textContent = '1 criterio seleccionado → 1 ruta calculada.';
    } else {
        hint.textContent = checked.length + ' criterios → se calculará una ruta por cada uno.';
    }
}

// ── Secondary airports toggle ────────────────────────────────────
document.getElementById('toggle-secundarios').addEventListener('click', function () {
    const pressed = this.getAttribute('aria-pressed') === 'true';
    this.setAttribute('aria-pressed', String(!pressed));
});

function incluirSecundarios() {
    return document.getElementById('toggle-secundarios').getAttribute('aria-pressed') === 'true';
}

// ── Helpers ──────────────────────────────────────────────────────
function getCheckedCriteria() {
    return [...document.querySelectorAll('input[name="criterio"]:checked')]
        .map(cb => cb.value);
}

function getConstraintValue(criterio) {
    const inputId = CRITERIO_META[criterio].input;
    const val     = parseFloat(document.getElementById(inputId).value);
    return isNaN(val) || val <= 0 ? null : val;
}

// ── Form submit ──────────────────────────────────────────────────
document.getElementById('route-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const origen    = document.getElementById('origen').value;
    const destino   = document.getElementById('destino').value;
    const criterios = getCheckedCriteria();

    if (!nodos.length) {
        ErrorHandler.handle('FILE_LOAD_ERROR', 'Carga un archivo JSON primero.', 'planificador.js:100');
        return;
    }
    if (!origen) {
        ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona un aeropuerto de origen.', 'planificador.js:104');
        return;
    }
    if (!destino) {
        ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona un aeropuerto de destino final.', 'planificador.js:108');
        return;
    }
    if (origen === destino) {
        ErrorHandler.handle('VALIDATION_ERROR', 'El origen y el destino deben ser distintos.', 'planificador.js:112');
        return;
    }
    if (criterios.length === 0) {
        ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona al menos un criterio de optimización.', 'planificador.js:116');
        return;
    }

    for (const criterio of criterios) {
        if (getConstraintValue(criterio) === null) {
            const label = CRITERIO_META[criterio].label;
            ErrorHandler.handle('VALIDATION_ERROR', `Ingresa un valor válido para la restricción de ${label}.`, 'planificador.js:122');
            return;
        }
    }

    // Build single request with criterios array
    const body = {
        origen,
        destino,
        criterios,
        airports: nodos,
        routes: aristas,
        configuracion,
        incluir_secundarios: incluirSecundarios(),
    };

    // Attach constraint value for each selected criterio
    criterios.forEach(criterio => {
        body[CRITERIO_META[criterio].input] = getConstraintValue(criterio);
    });

    localStorage.setItem('skyroute_planner_state', JSON.stringify({
        origen, destino, criterios,
        presupuesto: document.getElementById('presupuesto').value,
        tiempo: document.getElementById('tiempo').value,
        distanciaMax: document.getElementById('distancia-max').value,
        secundarios: incluirSecundarios()
    }));

    setLoading(true);
    document.getElementById('results-area').innerHTML = '';

    try {
        const data = await fetchPlan(body);

        // Transform multi-criteria response → renderMultiResults format
        const items = criterios.map(criterio => {
            const r = data.results[criterio];
            if (r && r.success) {
                return { criterio, resultado: r, error: null };
            }
            const errMsg = r?.error?.message || r?.message || 'Sin resultado.';
            return { criterio, resultado: null, error: { message: errMsg } };
        });

        renderMultiResults(items);
        localStorage.setItem('skyroute_results', JSON.stringify(items));
    } catch (err) {
        const errItems = criterios.map(c => ({ criterio: c, resultado: null, error: err }));
        renderMultiResults(errItems);
        localStorage.setItem('skyroute_results', JSON.stringify(errItems));
    } finally {
        setLoading(false);
    }
});

// ── "Ver mapa" button handler ─────────────────────────────────────
document.getElementById('results-area').addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-ver-mapa');
    if (!btn) return;

    const criterio  = btn.dataset.criterio;
    const path      = JSON.parse(btn.dataset.path);
    const segments  = JSON.parse(btn.dataset.segments);

    localStorage.setItem('skyroute_route', JSON.stringify({ criterio, path, segments }));
    localStorage.setItem('skyroute_active_criterio', criterio);
    window.location.href = 'visualizador.html?from=planificador';
});

// ── Single fetch helper ──────────────────────────────────────────
async function fetchPlan(body) {
    const res = await fetch('/api/planificar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });

    if (!res.ok) {
        let errBody = null;
        try { errBody = await res.json(); } catch (_) { /* not JSON */ }
        const msg = (errBody && errBody.message) ? errBody.message : `HTTP ${res.status}`;
        throw new Error(msg);
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Error en el servidor.');
    return data;
}

// ── Render multiple result cards ─────────────────────────────────
function renderMultiResults(items) {
    const area = document.getElementById('results-area');
    area.innerHTML = '';

    items.forEach(({ criterio, resultado, error }) => {
        area.appendChild(
            (error || !resultado)
                ? buildErrorCard(criterio, error ? error.message : 'Sin resultado.')
                : buildResultCard(criterio, resultado)
        );
    });
}

function buildErrorCard(criterio, message) {
    const meta = CRITERIO_META[criterio];
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
        <div class="rc-header">
            <span class="rc-title">${meta.icon} Criterio: ${meta.label}</span>
            <div class="rc-badges">
                <span class="rbadge" style="background:oklch(68% 0.17 25 / 0.12);color:var(--coral,#d4634a)">Sin ruta</span>
            </div>
        </div>
        <p style="font-size:13px;color:var(--text-muted);padding:8px 0;">${message}</p>`;
    return card;
}

function calcSegmentCostUSD(seg) {
    const ac = configuracion?.aeronaves?.[seg.aeronave];
    return seg.distancia * (ac?.costoKm || 0.18);
}

function calcSegmentTimeHours(seg) {
    const ac = configuracion?.aeronaves?.[seg.aeronave];
    return seg.distancia * (ac?.tiempoKm || 0.7) / 60;
}

function buildResultCard(criterio, result) {
    const meta       = CRITERIO_META[criterio];
    const totalDist  = result.segments.reduce((s, seg) => s + (seg.distancia || 0), 0);
    const escalas    = Math.max(0, result.destinos_visitados - 1);
    const constraint = getConstraintValue(criterio);

    const totalCostUSD = result.segments.reduce((s, seg) => s + calcSegmentCostUSD(seg), 0);
    const totalTimeH   = result.segments.reduce((s, seg) => s + calcSegmentTimeHours(seg), 0);

    const isCost = criterio === 'costo';
    const isDist = criterio === 'distancia';
    const isTime = criterio === 'tiempo';

    // Route path nodes
    const lastIdx  = result.path.length - 1;
    const pathHtml = result.path.map((code, i) => {
        const ap      = nodos.find(a => a.id === code);
        const city    = ap ? (ap.ciudad || '') : '';
        const cls     = i === 0 ? 'origin' : i === lastIdx ? 'final' : '';
        const tooltip = i === 0 ? 'Origen' : i === lastIdx ? 'Destino final' : 'Escala';
        const conn    = i < lastIdx
            ? `<div class="route-connector"><span class="route-arrow">→</span></div>`
            : '';
        return `<div class="route-node">
                    <div class="route-node-code ${cls}" data-tooltip="${tooltip}">${code}</div>
                    ${city ? `<div class="route-node-label">${city}</div>` : ''}
                </div>${conn}`;
    }).join('');

    // Segment table rows
    const rows = result.segments.map((seg, i) => `
        <tr>
            <td><span class="seg-num">${i + 1}.</span><span class="seg-route">
                <span class="seg-iata">${seg.origen}</span>
                <span class="seg-arrow">→</span>
                <span class="seg-iata">${seg.destino}</span>
            </span></td>
            <td><span class="seg-aircraft">${seg.aeronave}</span></td>
            <td>${Math.round(seg.distancia).toLocaleString()} km</td>
            <td>$${calcSegmentCostUSD(seg).toFixed(2)}</td>
            <td>${calcSegmentTimeHours(seg).toFixed(1)} h</td>
        </tr>`).join('');

    // Bottom-right stat depends on criterion
    let remainLabel, remainValue;
    if (isCost) {
        remainLabel = 'Presupuesto restante';
        remainValue = '$' + (constraint - totalCostUSD).toFixed(2);
    } else if (isTime) {
        remainLabel = 'Tiempo límite';
        remainValue = totalTimeH.toFixed(1) + ' h / ' + constraint + ' h';
    } else {
        remainLabel = 'Distancia límite';
        remainValue = Math.round(totalDist).toLocaleString() + ' / ' + constraint.toLocaleString() + ' km';
    }

    // Badge value with correct unit for the criterion
    const badgeValue = isCost
        ? `$${totalCostUSD.toFixed(2)} USD`
        : isDist
            ? `${Math.round(totalDist).toLocaleString()} km`
            : `${totalTimeH.toFixed(1)} h`;

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
        <div class="rc-header">
            <span class="rc-title">${meta.icon} Criterio: ${meta.label}</span>
            <div class="rc-badges">
                <span class="rbadge rbadge-amber">${result.destinos_visitados} aeropuertos</span>
                <span class="rbadge rbadge-teal">${escalas} escalas</span>
                <span class="rbadge rbadge-muted">${badgeValue}</span>
            </div>
        </div>

        <div class="rc-stats">
            <div class="stat-cell accent">
                <span class="s-label">Aeropuertos visitados</span>
                <span class="s-value">${result.destinos_visitados}</span>
            </div>
            <div class="stat-cell">
                <span class="s-label">Escalas intermedias</span>
                <span class="s-value">${escalas}</span>
            </div>
            <div class="stat-cell ${isCost ? 'highlighted' : ''}">
                <span class="s-label">Costo total</span>
                <span class="s-value">$${totalCostUSD.toFixed(2)}</span>
            </div>
            <div class="stat-cell ${isDist ? 'highlighted' : ''}">
                <span class="s-label">Distancia total</span>
                <span class="s-value">${Math.round(totalDist).toLocaleString()} km</span>
            </div>
            <div class="stat-cell ${isTime ? 'highlighted' : ''}">
                <span class="s-label">Tiempo total</span>
                <span class="s-value">${totalTimeH.toFixed(1)} h</span>
            </div>
            <div class="stat-cell coral">
                <span class="s-label">${remainLabel}</span>
                <span class="s-value">${remainValue}</span>
            </div>
        </div>

        <div class="rc-section">
            <div class="rc-section-label">Secuencia de vuelos</div>
            <div class="route-path">${pathHtml}</div>
        </div>

        <div class="rc-section">
            <div class="rc-section-label">Detalle por tramo</div>
            <table class="seg-table">
                <thead>
                    <tr>
                        <th>Tramo</th>
                        <th>Aeronave</th>
                        <th>Distancia</th>
                        <th>Costo</th>
                        <th>Tiempo</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div class="rc-actions">
            <button class="btn-ver-mapa" data-criterio="${criterio}"
                data-path='${JSON.stringify(result.path)}'
                data-segments='${JSON.stringify(result.segments)}'>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Ver mapa
            </button>
        </div>`;
    return card;
}

// ── Loading state ────────────────────────────────────────────────
function setLoading(on) {
    const btn = document.getElementById('submit-btn');
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.querySelector('.btn-text').textContent =
        on ? 'Calculando...' : 'Calcular ruta óptima';
}