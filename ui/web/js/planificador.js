let nodos = [], aristas = [], configuracion = {};

// Toggle entre modos
document.querySelectorAll('input[name="search-mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'budget') {
            document.getElementById('budget-group').style.display = 'block';
            document.getElementById('time-group').style.display = 'none';
            document.getElementById('presupuesto').removeAttribute('required');
            document.getElementById('tiempo').removeAttribute('required');
        } else {
            document.getElementById('budget-group').style.display = 'none';
            document.getElementById('time-group').style.display = 'block';
            document.getElementById('presupuesto').removeAttribute('required');
            document.getElementById('tiempo').removeAttribute('required');
        }
    });
});

document.getElementById('json-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const json = JSON.parse(ev.target.result);
            nodos         = json.nodos        || [];
            aristas       = json.aristas       || [];
            configuracion = json.configuracion || {};
            populateSelects();
            populateTransportOptions();
            document.getElementById('file-label').classList.add('loaded');
            document.getElementById('file-label-text').textContent = '✓ ' + file.name;
            document.getElementById('file-name').textContent =
                nodos.length + ' aeropuertos · ' + aristas.length + ' rutas cargadas';
        } catch (err) { ErrorHandler.handle('PARSING_ERROR', err.message, 'planificador.js:25'); }
    };
    reader.readAsText(file);
    e.target.value = '';
});

function populateSelects() {
    ['origen', 'destino'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">Seleccionar...</option>';
        nodos.forEach(a => {
            const opt = new Option(
                a.id + (a.ciudad ? ' — ' + a.ciudad + (a.pais ? ', ' + a.pais : '') : ''),
                a.id
            );
            sel.appendChild(opt);
        });
    });
}

// Populates transport type checkboxes based on loaded routes/configuracion
function populateTransportOptions() {
    const container = document.getElementById('transportes-list');
    if (!container) return;
    container.innerHTML = '';

    const set = new Set();
    // From routes
    aristas.forEach(a => {
        if (a.aeronaves && Array.isArray(a.aeronaves)) a.aeronaves.forEach(t => set.add(t));
    });
    // From configuracion
    if (configuracion && configuracion.aeronaves) {
        Object.keys(configuracion.aeronaves).forEach(k => set.add(k));
    }

    if (set.size === 0) {
        container.innerHTML = '<div class="transport-none">Sin datos de aeronaves</div>';
        return;
    }

    Array.from(set).sort().forEach((t, i) => {
        const id = 'transport-' + i;
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="transport-checkbox" id="${id}" value="${t}" ${i===0? 'checked': ''}> ${t}`;
        container.appendChild(label);
    });
}

document.getElementById('route-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const origen      = document.getElementById('origen').value;
    const destino     = document.getElementById('destino').value;
    const mode        = document.querySelector('input[name="search-mode"]:checked').value;
    const presupuesto = document.getElementById('presupuesto').value;
    const tiempo      = document.getElementById('tiempo').value;

    if (!nodos.length)                          { ErrorHandler.handle('FILE_LOAD_ERROR', 'Carga un archivo JSON primero.', 'planificador.js:60'); return; }
    if (!origen)                                { ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona un aeropuerto de origen.', 'planificador.js:61'); return; }
    if (!destino)                               { ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona un aeropuerto de destino final.', 'planificador.js:62'); return; }
    if (origen === destino)                     { ErrorHandler.handle('VALIDATION_ERROR', 'El origen y el destino deben ser distintos.', 'planificador.js:63'); return; }
    
    if (mode === 'budget') {
        if (isNaN(presupuesto) || presupuesto <= 0) { ErrorHandler.handle('VALIDATION_ERROR', 'Ingresa un presupuesto mayor a 0.', 'planificador.js:65'); return; }
    } else {
        if (isNaN(tiempo) || tiempo <= 0) { ErrorHandler.handle('VALIDATION_ERROR', 'Ingresa un tiempo válido.', 'planificador.js:67'); return; }
    }

    setLoading(true);
    document.getElementById('results-area').innerHTML = '';

    try {
        const body = {
            origen,
            destino,
            modo: mode,
            airports: nodos,
            routes: aristas,
            configuracion
        };


            // Recoger criterios y transportes desde UI
            const criterios = Array.from(document.querySelectorAll('input[name="criterio"]:checked')).map(n => n.value);
            const transportes = Array.from(document.querySelectorAll('.transport-checkbox:checked')).map(n => n.value);
            const incluir_secundarios = document.getElementById('incluir-secundarios') ? document.getElementById('incluir-secundarios').checked : true;

            body.criterios = criterios;
            body.transportes = transportes;
            body.incluir_secundarios = incluir_secundarios;

            // Validaciones adicionales: al menos un criterio y un transporte
            if (!body.criterios || body.criterios.length === 0) { ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona al menos un criterio de optimización.', 'planificador.js:125'); return; }
            if (!body.transportes || body.transportes.length === 0) { ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona al menos un tipo de transporte.', 'planificador.js:126'); return; }

        // Agregar presupuesto o tiempo según corresponda
        if (mode === 'budget') {
            body.presupuesto = parseFloat(presupuesto);
        } else {
            body.tiempo = parseFloat(tiempo);
        }

        const res = await fetch('/api/planificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            // Intentar leer el cuerpo JSON del error antes de caer al mensaje genérico HTTP.
            // El backend puede devolver 400/422 con {"success": false, "message": "..."}.
            let errBody = null;
            try { errBody = await res.json(); } catch (_) { /* body no es JSON */ }
            if (errBody && errBody.message) {
                ErrorHandler.handleBackendError(errBody, 'planificador.js:99');
            } else {
                ErrorHandler.handleApiError(res, 'planificador.js:101');
            }
            return;
        }

        const data = await res.json();
        if (!data.success) { ErrorHandler.handleBackendError(data, 'planificador.js:105'); return; }
        renderResults(data, mode, parseFloat(presupuesto) || 0, parseFloat(tiempo) || 0);
    } catch (err) {
        ErrorHandler.handle('NETWORK_ERROR', err.message, 'planificador.js:95');
    } finally {
        setLoading(false);
    }
});

function renderResults(result, mode, presupuesto, tiempo) {
    const area = document.getElementById('results-area');
    area.innerHTML = '';

    const totalDist = result.segments.reduce((s, seg) => s + (seg.distancia || 0), 0);
    const escalas   = Math.max(0, result.destinos_visitados - 1);

    // ── Route path HTML
    const lastIdx  = result.path.length - 1;
    const pathHtml = result.path.map((code, i) => {
        const ap      = nodos.find(a => a.id === code);
        const city    = ap ? (ap.ciudad || '') : '';
        const cls     = i === 0 ? 'origin' : i === lastIdx ? 'final' : '';
        const tooltip = i === 0 ? 'Origen' : i === lastIdx ? 'Destino final' : 'Escala';
        const conn    = i < lastIdx ? `<div class="route-connector"><span class="route-arrow">→</span></div>` : '';
        return `<div class="route-node">
                    <div class="route-node-code ${cls}" data-tooltip="${tooltip}">${code}</div>
                    ${city ? `<div class="route-node-label">${city}</div>` : ''}
                </div>${conn}`;
    }).join('');

    // ── Segment rows
    const rows = result.segments.map((seg, i) => `
        <tr>
            <td><span class="seg-num">${i + 1}.</span><span class="seg-route">
                <span class="seg-iata">${seg.origen}</span>
                <span class="seg-arrow">→</span>
                <span class="seg-iata">${seg.destino}</span>
            </span></td>
            <td><span class="seg-aircraft">${seg.aeronave}</span></td>
            <td>${Math.round(seg.distancia).toLocaleString()} km</td>
            <td>$${seg.costo.toFixed(2)}</td>
            <td class="seg-accumulated">$${seg.costo_acumulado.toFixed(2)}</td>
        </tr>`).join('');

    // ── Single card
    area.innerHTML = `
        <div class="result-card">

            <div class="rc-header">
                <span class="rc-title">Ruta óptima encontrada</span>
                <div class="rc-badges">
                    <span class="rbadge rbadge-amber">${result.destinos_visitados} aeropuertos</span>
                    <span class="rbadge rbadge-teal">${escalas} escalas</span>
                    <span class="rbadge rbadge-muted">$${result.total_costo.toFixed(2)} USD</span>
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
                <div class="stat-cell teal">
                    <span class="s-label">Distancia total</span>
                    <span class="s-value">${Math.round(totalDist).toLocaleString()} km</span>
                </div>
                <div class="stat-cell">
                    <span class="s-label">Costo total</span>
                    <span class="s-value">$${result.total_costo.toFixed(2)}</span>
                </div>
                <div class="stat-cell">
                    <span class="s-label">Tramos de vuelo</span>
                    <span class="s-value">${result.segments.length}</span>
                </div>
                <div class="stat-cell coral">
                    <span class="s-label">${mode === 'budget' ? 'Presupuesto restante' : 'Tiempo límite'}</span>
                    <span class="s-value">${mode === 'budget'
                        ? '$' + (presupuesto - result.total_costo).toFixed(2)
                        : (result.tiempo_total != null ? result.tiempo_total + ' h' : tiempo + ' h (límite)')
                    }</span>
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
                            <th>Costo tramo</th>
                            <th>Acumulado</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>

        </div>`;
}

function setLoading(on) {
    const btn = document.getElementById('submit-btn');
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.querySelector('.btn-text').textContent = on ? 'Calculando...' : 'Calcular ruta óptima';
}