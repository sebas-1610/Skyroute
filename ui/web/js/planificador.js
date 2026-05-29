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

                // comparación estática por tramo (sin controles)
                const comparisonCards = result.segments.map((seg, i) => {
                    const distance = Number(seg.distancia || 0);
                    const options = getRouteAircraftOptions(seg.origen, seg.destino, distance, seg.aeronave);
                    const optionsRows = options.map(opt => `
                        <tr class="${opt.selected ? 'route-option-selected' : ''}">
                            <td>${opt.name}${opt.selected ? ' <span class="route-option-tag">Elegida</span>' : ''}</td>
                            <td>$${opt.cost.toFixed(2)}</td>
                            <td>${opt.time.toFixed(1)} min</td>
                        </tr>`).join('');

                    return `
                        <article class="route-option-card">
                            <div class="route-option-head">
                                <strong>Tramo ${i + 1}: ${seg.origen} → ${seg.destino}</strong>
                                <span class="rbadge ${options.some(opt => opt.selected) ? 'rbadge-teal' : 'rbadge-muted'}">${distance.toLocaleString()} km</span>
                            </div>
                            <p class="budget-hint">Comparación de aeronaves disponibles para este tramo${options[0]?.subsidized ? ' · Ruta subsidiada' : ''}.</p>
                            <table class="seg-table route-option-table">
                                <thead>
                                    <tr>
                                        <th>Aeronave</th>
                                        <th>Costo tramo</th>
                                        <th>Tiempo tramo</th>
                                    </tr>
                                </thead>
                                <tbody>${optionsRows}</tbody>
                            </table>
                        </article>`;
                }).join('');

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

                        <div class="rc-section">
                            <div class="rc-section-label">Comparación de aeronaves por tramo</div>
                            <div class="route-options-grid">${comparisonCards}</div>
                        </div>

                    </div>`;
            }
        routeSelectionState.tiempo = tiempo;
    }

    const view = calculateRouteView(result);

    const totalDist = view.totalDist;
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
    const rows = view.segments.map((seg, i) => `
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

    const comparisonCards = result.segments.map((seg, i) => {
        const routeSegment = view.segments[i];
        const distance = Number(seg.distancia || 0);
        const choices = getRouteAircraftChoices(seg.origen, seg.destino);
        const route = aristas.find(a => a.origen === seg.origen && a.destino === seg.destino) || {};
        const subsidized = Number(route.costoBase || 0) === 0;
        const currentAircraft = routeSegment?.aeronave || seg.aeronave;
        const options = choices.map(name => {
            const aircraft = getAircraftData(name);
            return {
                name,
                cost: subsidized ? 0 : distance * Number(aircraft.costoKm || 0),
                time: distance * Number(aircraft.tiempoKm || 0),
                selected: name === currentAircraft,
                subsidized
            };
        });
        const optionsRows = options.map(opt => `
            <tr class="${opt.selected ? 'route-option-selected' : ''}">
                <td>${opt.name}${opt.selected ? ' <span class="route-option-tag">Elegida</span>' : ''}</td>
                <td>$${opt.cost.toFixed(2)}</td>
                <td>${opt.time.toFixed(1)} min</td>
            </tr>`).join('');

        return `
            <article class="route-option-card">
                <div class="route-option-head">
                    <strong>Tramo ${i + 1}: ${seg.origen} → ${seg.destino}</strong>
                    <span class="rbadge ${options.some(opt => opt.selected) ? 'rbadge-teal' : 'rbadge-muted'}">${distance.toLocaleString()} km</span>
                </div>
                <p class="budget-hint">Comparación de aeronaves disponibles para este tramo${options[0]?.subsidized ? ' · Ruta subsidiada' : ''}.</p>
                ${renderRouteAircraftSelector(routeSegment || seg)}
                <table class="seg-table route-option-table">
                    <thead>
                        <tr>
                            <th>Aeronave</th>
                            <th>Costo tramo</th>
                            <th>Tiempo tramo</th>
                        </tr>
                    </thead>
                    <tbody>${optionsRows}</tbody>
                </table>
            </article>`;
    }).join('');

    // ── Single card
    area.innerHTML = `
        <div class="result-card">

            <div class="rc-header">
                <span class="rc-title">Ruta óptima encontrada</span>
                <div class="rc-badges">
                    <span class="rbadge rbadge-amber">${result.destinos_visitados} aeropuertos</span>
                    <span class="rbadge rbadge-teal">${escalas} escalas</span>
                    <span class="rbadge rbadge-muted">$${view.totalCost.toFixed(2)} USD</span>
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
                    <span class="s-value">$${view.totalCost.toFixed(2)}</span>
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

            <div class="rc-section">
                <div class="rc-section-label">Comparación de aeronaves por tramo</div>
                <div class="route-options-grid">${comparisonCards}</div>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Ruta recalculada con selección actual</div>
                <div class="rc-stats route-recalc-stats">
                    <div class="stat-cell accent">
                        <span class="s-label">Costo recalculado</span>
                        <span class="s-value">$${view.totalCost.toFixed(2)}</span>
                    </div>
                    <div class="stat-cell teal">
                        <span class="s-label">Tiempo recalculado</span>
                        <span class="s-value">${view.totalTimeHours.toFixed(2)} h</span>
                    </div>
                    <div class="stat-cell">
                        <span class="s-label">Selecciones activas</span>
                        <span class="s-value">${view.segments.length}</span>
                    </div>
                    <div class="stat-cell coral">
                        <span class="s-label">Presupuesto restante</span>
                        <span class="s-value">${mode === 'budget'
                            ? '$' + (presupuesto - view.totalCost).toFixed(2)
                            : (result.tiempo_total != null ? result.tiempo_total + ' h' : tiempo + ' h (límite)')
                        }</span>
                    </div>
                </div>
            </div>

        </div>`;

    area.querySelectorAll('.route-apply-btn').forEach(btn => {
        btn.addEventListener('click', () => applySegmentAircraftSelection(btn.getAttribute('data-seg-key')));
    });
}

function setLoading(on) {
    const btn = document.getElementById('submit-btn');
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.querySelector('.btn-text').textContent = on ? 'Calculando...' : 'Calcular ruta óptima';
}