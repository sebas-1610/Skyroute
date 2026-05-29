let nodos = [], aristas = [], configuracion = {};

const fileInput = document.getElementById('advanced-json-file');
const origenSelect = document.getElementById('advanced-origen');
const destinoSelect = document.getElementById('advanced-destino');
const currentPoint = document.getElementById('advanced-punto-actual');
const notesArea = document.getElementById('advanced-notas');
const resultsArea = document.getElementById('advanced-results-area');
const submitButton = document.getElementById('advanced-submit-btn');

const DEFAULT_AIRCRAFT = {
    'Avión Comercial': { costoKm: 0.18, tiempoKm: 0.7 },
    'Avión Regional': { costoKm: 0.25, tiempoKm: 1.1 },
    Hélice: { costoKm: 0.12, tiempoKm: 2.5 }
};

const DEFAULT_RULES = {
    intervaloAlojamiento: 20,
    intervaloAlimentacion: 8,
    presupuestoMinimoPorc: 35
};

let simulation = null;

function logNote(text) {
    const prefix = notesArea.value ? '\n' : '';
    notesArea.value += prefix + text;
    notesArea.scrollTop = notesArea.scrollHeight;
}

function getRule(name) {
    const value = Number(configuracion?.[name]);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_RULES[name];
}

function getAircraftData(name) {
    return (configuracion && configuracion.aeronaves && configuracion.aeronaves[name]) || DEFAULT_AIRCRAFT[name] || DEFAULT_AIRCRAFT['Avión Comercial'];
}

function populateSelects() {
    [origenSelect, destinoSelect].forEach(sel => {
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

function getAirport(nodeId) {
    return nodos.find(a => a.id === nodeId) || null;
}

function getRouteSegment(origen, destino) {
    return aristas.find(r => r.origen === origen && r.destino === destino) || null;
}

function getOutgoingRoutes(origen) {
    return aristas.filter(r => r.origen === origen);
}

function getAircraftOptionsForRoute(route) {
    const routeAircraft = Array.isArray(route?.aeronaves) && route.aeronaves.length
        ? route.aeronaves
        : Object.keys(configuracion?.aeronaves || DEFAULT_AIRCRAFT);

    return routeAircraft.map(name => {
        const aircraft = getAircraftData(name);
        const distance = Number(route?.distanciaKm || route?.distancia || 0);
        const cost = distance * Number(aircraft.costoKm || 0);
        const flightMinutes = distance * Number(aircraft.tiempoKm || 0);
        return { name, cost, flightMinutes, feasible: cost <= simulation.remainingBudget && (flightMinutes / 60) <= simulation.remainingTime };
    });
}

function buildAlternativeCards(state) {
    const currentNode = getAirport(state.route[state.currentIndex]);
    if (!currentNode) return '<div class="budget-hint">No hay aeropuerto actual para mostrar alternativas.</div>';

    const alternatives = getOutgoingRoutes(currentNode.id);
    if (!alternatives.length) {
        return '<div class="budget-hint">No hay rutas salientes disponibles desde este aeropuerto.</div>';
    }

    return alternatives.map(route => {
        const aircraftOptions = getAircraftOptionsForRoute(route);
        const distance = Number(route.distanciaKm || route.distancia || 0);
        const bestByCost = [...aircraftOptions].sort((a, b) => a.cost - b.cost)[0];
        const bestByTime = [...aircraftOptions].sort((a, b) => a.flightMinutes - b.flightMinutes)[0];
        const selectOptions = aircraftOptions.map(opt => `<option value="${opt.name}">${opt.name} · $${opt.cost.toFixed(2)} · ${opt.flightMinutes.toFixed(1)} min</option>`).join('');

        return `
            <div class="alt-card" data-next="${route.destino}">
                <div class="alt-card-header">
                    <strong>${currentNode.id} → ${route.destino}</strong>
                    <span class="rbadge ${bestByCost?.feasible ? 'rbadge-teal' : 'rbadge-amber'}">${distance.toLocaleString()} km</span>
                </div>
                <div class="alt-card-meta">
                    <span>Más barato: ${bestByCost ? `${bestByCost.name} ($${bestByCost.cost.toFixed(2)})` : 'N/D'}</span>
                    <span>Más rápido: ${bestByTime ? `${bestByTime.name} (${bestByTime.flightMinutes.toFixed(1)} min)` : 'N/D'}</span>
                </div>
                <label class="alt-selector-label">
                    Aeronave para esta decisión
                    <select class="alt-aircraft-select" data-next="${route.destino}">${selectOptions}</select>
                </label>
                <div class="step-actions">
                    <button type="button" class="step-action-btn choose-alt-btn" data-next="${route.destino}">Elegir siguiente tramo</button>
                </div>
            </div>`;
    }).join('');
}

function normalizeSegments(path, segments) {
    const byKey = new Map((segments || []).map(seg => [`${seg.origen}→${seg.destino}`, seg]));
    return path.slice(0, -1).map((origen, index) => {
        const destino = path[index + 1];
        const segment = byKey.get(`${origen}→${destino}`) || getRouteSegment(origen, destino) || null;
        const aeronave = segment?.aeronave || (segment?.aeronaves && segment.aeronaves[0]) || 'Avión Comercial';
        const aircraftData = getAircraftData(aeronave);
        const distance = Number(segment?.distancia || segment?.distanciaKm || 0);
        return {
            origen,
            destino,
            distancia: distance,
            aeronave,
            costo: segment?.costo != null ? Number(segment.costo) : distance * Number(aircraftData.costoKm || 0),
            flightMinutes: distance * Number(aircraftData.tiempoKm || 0)
        };
    });
}

function routePathToHtml(path) {
    if (!path || !path.length) return '<span class="budget-hint">No hay ruta calculada.</span>';

    const lastIdx = path.length - 1;
    return path.map((code, i) => {
        const ap = getAirport(code);
        const city = ap ? (ap.ciudad || '') : '';
        const cls = i === 0 ? 'origin' : i === lastIdx ? 'final' : '';
        const tooltip = i === 0 ? 'Origen' : i === lastIdx ? 'Destino final' : 'Escala';
        const conn = i < lastIdx ? `<div class="route-connector"><span class="route-arrow">→</span></div>` : '';
        return `<div class="route-node">
                    <div class="route-node-code ${cls}" data-tooltip="${tooltip}">${code}</div>
                    ${city ? `<div class="route-node-label">${city}</div>` : ''}
                </div>${conn}`;
    }).join('');
}

function airportSummaryCard(node, state) {
    const activities = Array.isArray(node?.actividades) ? node.actividades : [];
    const jobs = Array.isArray(node?.trabajos) ? node.trabajos : [];
    const minBudget = state.initialBudget * (getRule('presupuestoMinimoPorc') / 100);
    const jobsActive = state.remainingBudget <= minBudget;
    const alternativesHtml = buildAlternativeCards(state);

    const activityRows = activities.length
        ? activities.map((a, idx) => `
            <tr>
                <td>${a.nombre}</td>
                <td>${a.tipo || 'opcional'}</td>
                <td>${Number(a.duracionMin || 0)} min</td>
                <td>$${Number(a.costoUSD || 0).toFixed(2)}</td>
                <td><button type="button" class="step-action-btn" data-activity-index="${idx}">Agregar</button></td>
            </tr>`).join('')
        : '<tr><td colspan="5">Sin actividades registradas</td></tr>';

    const jobRows = jobs.length
        ? jobs.map((j, idx) => `
            <tr>
                <td>${j.nombre}</td>
                <td>$${Number(j.tarifaHora || 0).toFixed(2)}</td>
                <td>${Number(j.maxHoras || 0)}</td>
                <td><input type="number" min="1" max="${Number(j.maxHoras || 0)}" value="1" class="job-hours-input" data-job-index="${idx}"></td>
                <td><button type="button" class="step-action-btn" data-job-index="${idx}" ${jobsActive ? '' : 'disabled'}>Tomar trabajo</button></td>
            </tr>`).join('')
        : '<tr><td colspan="5">Sin trabajos registrados</td></tr>';

    return `
        <div class="result-card">
            <div class="rc-header">
                <span class="rc-title">${node.id} · ${node.nombre || 'Aeropuerto'}</span>
                <div class="rc-badges">
                    <span class="rbadge rbadge-amber">Nodo ${Math.min(state.currentIndex + 1, state.route.length)}/${state.route.length}</span>
                    <span class="rbadge rbadge-amber">Tramo ${Math.min(state.currentIndex, Math.max(0, state.route.length - 1))}/${Math.max(0, state.route.length - 1)}</span>
                    <span class="rbadge rbadge-teal">${node.esHub ? 'Hub' : 'Secundario'}</span>
                </div>
            </div>

            <div class="rc-stats">
                <div class="stat-cell accent"><span class="s-label">Ciudad</span><span class="s-value">${node.ciudad || '-'}</span></div>
                <div class="stat-cell"><span class="s-label">País</span><span class="s-value">${node.pais || '-'}</span></div>
                <div class="stat-cell teal"><span class="s-label">Zona horaria</span><span class="s-value">${node.zonaHoraria || '-'}</span></div>
                <div class="stat-cell coral"><span class="s-label">Alojamiento</span><span class="s-value">$${Number(node.costoAlojamiento || 0).toFixed(2)}</span></div>
                <div class="stat-cell"><span class="s-label">Alimentación</span><span class="s-value">$${Number(node.costoAlimentacion || 0).toFixed(2)}</span></div>
                <div class="stat-cell"><span class="s-label">Trabajos activos</span><span class="s-value">${jobsActive ? 'Sí' : 'No'}</span></div>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Reglas obligatorias</div>
                <p class="budget-hint">Alojamiento cada ${getRule('intervaloAlojamiento')} h y alimentación cada ${getRule('intervaloAlimentacion')} h de tiempo acumulado.</p>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Decisión actual</div>
                <p class="budget-hint">Presupuesto restante: $${state.remainingBudget.toFixed(2)} · Tiempo restante: ${state.remainingTime.toFixed(2)} h · Umbral de trabajos: $${minBudget.toFixed(2)}</p>
                <div class="step-actions">
                    <button type="button" class="step-nav-btn" id="auto-mandatory-btn">Aplicar obligatorias</button>
                    <button type="button" class="step-nav-btn" id="next-step-btn">${state.currentIndex < state.route.length - 1 ? 'Siguiente tramo' : 'Finalizar viaje'}</button>
                </div>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Alternativas del siguiente tramo</div>
                <p class="budget-hint">El viajero puede elegir manualmente el siguiente destino desde el aeropuerto actual y recalcular el resto del viaje.</p>
                <div class="alt-list">${alternativesHtml}</div>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Actividades disponibles</div>
                <table class="seg-table">
                    <thead><tr><th>Nombre</th><th>Tipo</th><th>Tiempo</th><th>Costo</th><th>Acción</th></tr></thead>
                    <tbody>${activityRows}</tbody>
                </table>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Trabajos disponibles</div>
                <table class="seg-table">
                    <thead><tr><th>Trabajo</th><th>Tarifa/hora</th><th>Máx.</th><th>Horas</th><th>Acción</th></tr></thead>
                    <tbody>${jobRows}</tbody>
                </table>
            </div>
        </div>`;
}

function buildFinalReport() {
    const remaining = Math.max(0, simulation.remainingBudget);
    const totalTripHours = Math.max(0, simulation.initialTime - simulation.remainingTime);
    const jobsHtml = simulation.jobHistory.length
        ? simulation.jobHistory.map(job => `
            <tr>
                <td>${job.airport}</td>
                <td>${job.name}</td>
                <td>${job.hours} h</td>
                <td>$${job.income.toFixed(2)}</td>
            </tr>`).join('')
        : '<tr><td colspan="4">No se aceptaron trabajos temporales</td></tr>';

    return `
        <div class="result-card">
            <div class="rc-header">
                <span class="rc-title">Reporte final</span>
                <div class="rc-badges">
                    <span class="rbadge rbadge-teal">Completado</span>
                    <span class="rbadge rbadge-muted">${simulation.route.length - 1} tramos</span>
                </div>
            </div>
            <div class="rc-stats">
                <div class="stat-cell accent"><span class="s-label">Presupuesto final</span><span class="s-value">$${remaining.toFixed(2)}</span></div>
                <div class="stat-cell"><span class="s-label">Gasto total</span><span class="s-value">$${simulation.totalSpent.toFixed(2)}</span></div>
                <div class="stat-cell teal"><span class="s-label">Ingresos totales</span><span class="s-value">$${simulation.totalEarned.toFixed(2)}</span></div>
                <div class="stat-cell coral"><span class="s-label">Horas consumidas</span><span class="s-value">${totalTripHours.toFixed(2)} h</span></div>
                <div class="stat-cell"><span class="s-label">Comidas obligatorias</span><span class="s-value">${simulation.mandatoryMeals}</span></div>
                <div class="stat-cell"><span class="s-label">Alojamientos obligatorios</span><span class="s-value">${simulation.mandatoryHotels}</span></div>
            </div>
            <div class="rc-section">
                <div class="rc-section-label">Resumen</div>
                <p class="budget-hint">La simulación aplicó servicios obligatorios automáticamente y registró cada decisión en el log.</p>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Trabajos realizados</div>
                <table class="seg-table">
                    <thead><tr><th>Aeropuerto</th><th>Trabajo</th><th>Horas</th><th>Ingreso</th></tr></thead>
                    <tbody>${jobsHtml}</tbody>
                </table>
            </div>
        </div>`;
}

function renderSimulation() {
    if (!simulation) return;

    const node = getAirport(simulation.route[simulation.currentIndex]);
    currentPoint.value = node ? `${node.id} · ${node.ciudad || ''}` : '';

    const pathHtml = routePathToHtml(simulation.route);
    const segmentsHtml = simulation.segments.map((seg, i) => `
        <tr>
            <td><span class="seg-num">${i + 1}.</span><span class="seg-route"><span class="seg-iata">${seg.origen}</span><span class="seg-arrow">→</span><span class="seg-iata">${seg.destino}</span></span></td>
            <td><span class="seg-aircraft">${seg.aeronave}</span></td>
            <td>${Math.round(seg.distancia).toLocaleString()} km</td>
            <td>$${seg.costo.toFixed(2)}</td>
            <td class="seg-accumulated">${seg.flightMinutes.toFixed(1)} h</td>
        </tr>`).join('');

    resultsArea.innerHTML = `
        <div class="result-card">
            <div class="rc-header">
                <span class="rc-title">Planificación Avanzada</span>
                <div class="rc-badges">
                    <span class="rbadge rbadge-amber">Nodo ${Math.min(simulation.currentIndex + 1, simulation.route.length)}/${simulation.route.length}</span>
                    <span class="rbadge rbadge-amber">Tramo ${Math.min(simulation.currentIndex, Math.max(0, simulation.route.length - 1))}/${Math.max(0, simulation.route.length - 1)}</span>
                    <span class="rbadge rbadge-teal">${simulation.finished ? 'Completado' : 'En progreso'}</span>
                    <span class="rbadge rbadge-muted">2.3.3</span>
                </div>
            </div>

            <div class="rc-stats">
                <div class="stat-cell accent"><span class="s-label">Presupuesto inicial</span><span class="s-value">$${simulation.initialBudget.toFixed(2)}</span></div>
                <div class="stat-cell"><span class="s-label">Restante</span><span class="s-value">$${simulation.remainingBudget.toFixed(2)}</span></div>
                <div class="stat-cell teal"><span class="s-label">Tiempo inicial</span><span class="s-value">${simulation.initialTime.toFixed(2)} h</span></div>
                <div class="stat-cell coral"><span class="s-label">Tiempo restante</span><span class="s-value">${simulation.remainingTime.toFixed(2)} h</span></div>
                <div class="stat-cell"><span class="s-label">Gastado</span><span class="s-value">$${simulation.totalSpent.toFixed(2)}</span></div>
                <div class="stat-cell"><span class="s-label">Ganado</span><span class="s-value">$${simulation.totalEarned.toFixed(2)}</span></div>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Ruta sugerida</div>
                <div class="route-path">${pathHtml}</div>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Tramos de vuelo</div>
                <table class="seg-table">
                    <thead><tr><th>Tramo</th><th>Aeronave</th><th>Distancia</th><th>Costo</th><th>Duración</th></tr></thead>
                    <tbody>${segmentsHtml || '<tr><td colspan="5">Sin tramos</td></tr>'}</tbody>
                </table>
            </div>

            <div class="rc-section">
                <div class="rc-section-label">Log de decisiones</div>
                <textarea class="decision-log" readonly>${simulation.log.join('\n')}</textarea>
            </div>
        </div>`;

    if (node) {
        resultsArea.insertAdjacentHTML('beforeend', airportSummaryCard(node, simulation));
        bindStepActions();
    }
}

function appendLog(message) {
    simulation.log.push(message);
    notesArea.value = simulation.log.join('\n');
    notesArea.scrollTop = notesArea.scrollHeight;
}

function advanceTime(minutes, airportNode) {
    const hours = minutes / 60;
    simulation.remainingTime = Math.max(0, simulation.remainingTime - hours);
    simulation.hoursSinceMeal += hours;
    simulation.hoursSinceHotel += hours;

    const alimentacionInterval = getRule('intervaloAlimentacion');
    const alojamientoInterval = getRule('intervaloAlojamiento');

    while (simulation.hoursSinceMeal >= alimentacionInterval) {
        const mealCost = Number(airportNode?.costoAlimentacion || 0);
        simulation.remainingBudget -= mealCost;
        simulation.totalSpent += mealCost;
        simulation.mandatoryMeals += 1;
        simulation.hoursSinceMeal -= alimentacionInterval;
        appendLog(`Alimentación obligatoria en ${airportNode?.id || 'nodo'}: -$${mealCost.toFixed(2)}.`);
    }

    while (simulation.hoursSinceHotel >= alojamientoInterval) {
        const hotelCost = Number(airportNode?.costoAlojamiento || 0);
        simulation.remainingBudget -= hotelCost;
        simulation.totalSpent += hotelCost;
        simulation.mandatoryHotels += 1;
        simulation.hoursSinceHotel -= alojamientoInterval;
        appendLog(`Alojamiento obligatorio en ${airportNode?.id || 'nodo'}: -$${hotelCost.toFixed(2)}.`);
    }
}

function applyOptionalActivity(activityIndex) {
    const airportNode = getAirport(simulation.route[simulation.currentIndex]);
    const activities = Array.isArray(airportNode?.actividades) ? airportNode.actividades : [];
    const activity = activities[activityIndex];
    if (!activity) return;

    const cost = Number(activity.costoUSD || 0);
    const minutes = Number(activity.duracionMin || 0);

    simulation.remainingBudget -= cost;
    simulation.totalSpent += cost;
    appendLog(`Actividad elegida en ${airportNode.id}: ${activity.nombre} (-$${cost.toFixed(2)}, ${minutes} min).`);
    advanceTime(minutes, airportNode);
    renderSimulation();
}

function applyJob(jobIndex) {
    const airportNode = getAirport(simulation.route[simulation.currentIndex]);
    const jobs = Array.isArray(airportNode?.trabajos) ? airportNode.trabajos : [];
    const job = jobs[jobIndex];
    if (!job) return;

    const hoursInput = resultsArea.querySelector(`.job-hours-input[data-job-index="${jobIndex}"]`);
    const hours = Math.max(1, Math.min(Number(hoursInput?.value || 1), Number(job.maxHoras || 1)));

    const minBudget = simulation.initialBudget * (getRule('presupuestoMinimoPorc') / 100);
    if (simulation.remainingBudget > minBudget) {
        appendLog(`El trabajo ${job.nombre} no se activó porque el presupuesto aún no cae bajo el umbral.`);
        return;
    }

    const income = Number(job.tarifaHora || 0) * hours;
    simulation.remainingBudget += income;
    simulation.totalEarned += income;
    simulation.jobHistory.push({
        airport: airportNode.id,
        name: job.nombre,
        hours,
        income
    });
    appendLog(`Trabajo tomado en ${airportNode.id}: ${job.nombre} (${hours} h, +$${income.toFixed(2)}).`);
    advanceTime(hours * 60, airportNode);
    renderSimulation();
}

function applyMandatoryServices() {
    const airportNode = getAirport(simulation.route[simulation.currentIndex]);
    if (!airportNode) return;

    const beforeLogCount = simulation.log.length;
    advanceTime(0, airportNode);
    if (simulation.log.length === beforeLogCount) {
        appendLog(`Sin servicios obligatorios pendientes en ${airportNode.id}.`);
    }
    renderSimulation();
}

function moveToNextStep() {
    if (!simulation) return;

    if (simulation.currentIndex >= simulation.route.length - 1) {
        simulation.finished = true;
        appendLog('Viaje finalizado. Se generó el reporte final.');
        renderSimulation();
        return;
    }

    const segment = simulation.segments[simulation.currentIndex];
    const currentAirport = getAirport(segment.origen);
    const nextAirport = getAirport(segment.destino);
    const aircraftData = getAircraftData(segment.aeronave);
    const flightMinutes = Number(segment.distancia || 0) * Number(aircraftData.tiempoKm || 0);
    const flightCost = Number(segment.distancia || 0) * Number(aircraftData.costoKm || 0);

    simulation.remainingBudget -= flightCost;
    simulation.totalSpent += flightCost;
    appendLog(`Vuelo ${segment.origen} → ${segment.destino} en ${segment.aeronave}: -$${flightCost.toFixed(2)}, ${flightMinutes.toFixed(1)} min.`);
    advanceTime(flightMinutes, currentAirport);

    simulation.currentIndex += 1;
    currentPoint.value = nextAirport ? `${nextAirport.id} · ${nextAirport.ciudad || ''}` : '';
    appendLog(`Llegada a ${nextAirport?.id || segment.destino}.`);
    renderSimulation();
}

async function chooseAlternative(nextAirportId) {
    if (!simulation) return;

    const currentAirport = getAirport(simulation.route[simulation.currentIndex]);
    const route = getRouteSegment(currentAirport.id, nextAirportId);
    if (!route) {
        appendLog(`No existe tramo directo entre ${currentAirport.id} y ${nextAirportId}.`);
        return;
    }

    const aircraftSelect = resultsArea.querySelector(`.alt-aircraft-select[data-next="${nextAirportId}"]`);
    const aircraftName = aircraftSelect?.value || (route.aeronaves?.[0] || 'Avión Comercial');
    const aircraftData = getAircraftData(aircraftName);
    const distance = Number(route.distanciaKm || route.distancia || 0);
    const chosenSegment = {
        origen: currentAirport.id,
        destino: nextAirportId,
        distancia: distance,
        aeronave: aircraftName,
        costo: distance * Number(aircraftData.costoKm || 0),
        flightMinutes: distance * Number(aircraftData.tiempoKm || 0)
    };

    appendLog(`Alternativa elegida: ${currentAirport.id} → ${nextAirportId} usando ${aircraftName}.`);

    try {
        const suffix = await fetchSuffixPlan(nextAirportId, simulation.destination);
        const suffixPath = Array.isArray(suffix.path) && suffix.path.length ? suffix.path : [nextAirportId, simulation.destination].filter(Boolean);
        const suffixSegments = normalizeSegments(suffixPath, suffix.segments || []);

        simulation.route = simulation.route.slice(0, simulation.currentIndex + 1).concat(suffixPath);
        simulation.segments = simulation.segments.slice(0, simulation.currentIndex)
            .concat([chosenSegment], suffixSegments);

        appendLog(`Se recalculó el resto de la ruta desde ${nextAirportId} hacia ${simulation.destination}.`);
        renderSimulation();
    } catch (err) {
        appendLog(`No fue posible recalcular la ruta desde ${nextAirportId}: ${err.message}`);
        simulation.route = simulation.route.slice(0, simulation.currentIndex + 1).concat([nextAirportId, simulation.destination].filter(Boolean));
        simulation.segments = simulation.segments.slice(0, simulation.currentIndex).concat([chosenSegment]);
        renderSimulation();
    }
}

async function fetchSuffixPlan(origen, destino) {
    const transportes = Object.keys(configuracion?.aeronaves || DEFAULT_AIRCRAFT);
    const response = await fetch('/api/planificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            origen,
            destino,
            modo: 'budget',
            presupuesto: Math.max(Number(simulation.remainingBudget), 1),
            airports: nodos,
            routes: aristas,
            configuracion,
            criterios: ['costo'],
            transportes,
            incluir_secundarios: true
        })
    });

    const data = await response.json();
    const planner = data.results ? data.results.costo : data;
    if (!planner || !planner.success) {
        throw new Error(planner?.error?.message || planner?.message || 'No se pudo calcular el sufijo de ruta.');
    }

    return planner;
}

function bindStepActions() {
    const mandatoryBtn = document.getElementById('auto-mandatory-btn');
    const nextBtn = document.getElementById('next-step-btn');

    if (mandatoryBtn) mandatoryBtn.addEventListener('click', applyMandatoryServices);
    if (nextBtn) nextBtn.addEventListener('click', moveToNextStep);

    resultsArea.querySelectorAll('[data-activity-index]').forEach(btn => {
        btn.addEventListener('click', () => applyOptionalActivity(Number(btn.getAttribute('data-activity-index'))));
    });

    resultsArea.querySelectorAll('[data-job-index]').forEach(btn => {
        btn.addEventListener('click', () => applyJob(Number(btn.getAttribute('data-job-index'))));
    });

    resultsArea.querySelectorAll('.choose-alt-btn').forEach(btn => {
        btn.addEventListener('click', () => chooseAlternative(btn.getAttribute('data-next')));
    });
}

function startAdvancedSimulation(origen, destino, presupuesto, tiempo) {
    const transportes = Object.keys(configuracion?.aeronaves || DEFAULT_AIRCRAFT);

    return fetch('/api/planificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            origen,
            destino,
            modo: 'budget',
            presupuesto: Number(presupuesto),
            airports: nodos,
            routes: aristas,
            configuracion,
            criterios: ['costo'],
            transportes,
            incluir_secundarios: true
        })
    })
    .then(res => res.json())
    .then(data => {
        const planner = data.results ? data.results.costo : data;
        if (!planner || !planner.success) {
            throw new Error(planner?.error?.message || planner?.message || 'No se pudo calcular la ruta inicial.');
        }

        const path = planner.path || [];
        const segments = normalizeSegments(path, planner.segments || []);

        simulation = {
            origin,
            destination: destino,
            route: path,
            segments,
            currentIndex: 0,
            initialBudget: Number(presupuesto),
            remainingBudget: Number(presupuesto),
            initialTime: Number(tiempo),
            remainingTime: Number(tiempo),
            totalSpent: 0,
            totalEarned: 0,
            hoursSinceMeal: 0,
            hoursSinceHotel: 0,
            mandatoryMeals: 0,
            mandatoryHotels: 0,
            jobHistory: [],
            log: [
                `Ruta calculada: ${path.join(' → ')}`,
                `Presupuesto inicial: $${Number(presupuesto).toFixed(2)}.`,
                `Tiempo disponible: ${Number(tiempo).toFixed(2)} h.`
            ],
            finished: false
        };

        if (!simulation.route.length) {
            throw new Error('La ruta calculada está vacía.');
        }

        appendLog(`Simulación inicializada desde ${origen} hacia ${destino}.`);
        renderSimulation();
    });
}

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const json = JSON.parse(ev.target.result);
            nodos = json.nodos || json.aeropuertos || [];
            aristas = json.aristas || json.rutas || [];
            configuracion = json.configuracion || {};
            populateSelects();
            document.getElementById('advanced-file-label').classList.add('loaded');
            document.getElementById('advanced-file-label-text').textContent = '✓ ' + file.name;
            document.getElementById('advanced-file-name').textContent = nodos.length + ' aeropuertos · ' + aristas.length + ' rutas cargadas';
            logNote(`Archivo cargado: ${file.name}.`);
        } catch (err) {
            ErrorHandler.handle('PARSING_ERROR', err.message, 'planificador_avanzado.js:314');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

origenSelect.addEventListener('change', function() {
    const node = getAirport(this.value);
    if (!node) {
        currentPoint.value = '';
        return;
    }

    if (simulation.finished) {
        resultsArea.insertAdjacentHTML('beforeend', buildFinalReport());
    }

    currentPoint.value = node.id + ' · ' + (node.ciudad || '');
    const activities = Array.isArray(node.actividades) ? node.actividades : [];
    const jobs = Array.isArray(node.trabajos) ? node.trabajos : [];
    resultsArea.innerHTML = `
        <div class="result-card">
            <div class="rc-header">
                <span class="rc-title">Contexto del aeropuerto origen</span>
                <div class="rc-badges">
                    <span class="rbadge rbadge-amber">${node.id}</span>
                    <span class="rbadge rbadge-teal">${node.esHub ? 'Hub' : 'Secundario'}</span>
                </div>
            </div>
            <div class="rc-stats">
                <div class="stat-cell accent"><span class="s-label">Ciudad</span><span class="s-value">${node.ciudad || '-'}</span></div>
                <div class="stat-cell"><span class="s-label">País</span><span class="s-value">${node.pais || '-'}</span></div>
                <div class="stat-cell teal"><span class="s-label">Zona horaria</span><span class="s-value">${node.zonaHoraria || '-'}</span></div>
                <div class="stat-cell coral"><span class="s-label">Actividades</span><span class="s-value">${activities.length}</span></div>
                <div class="stat-cell"><span class="s-label">Trabajos</span><span class="s-value">${jobs.length}</span></div>
                <div class="stat-cell"><span class="s-label">Alojamiento</span><span class="s-value">$${Number(node.costoAlojamiento || 0).toFixed(2)}</span></div>
            </div>
            <div class="rc-section">
                <div class="rc-section-label">Actividades disponibles</div>
                <p class="budget-hint">El viajero puede seleccionar actividades opcionales durante la simulación. Las obligatorias se registran automáticamente según el tiempo transcurrido.</p>
            </div>
        </div>`;
    logNote(`Origen seleccionado: ${node.id}. Actividades: ${activities.length}. Trabajos: ${jobs.length}.`);
});

document.getElementById('advanced-route-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!nodos.length) {
        ErrorHandler.handle('FILE_LOAD_ERROR', 'Carga un archivo JSON primero.', 'planificador_avanzado.js:369');
        return;
    }

    const origen = origenSelect.value;
    const destino = destinoSelect.value;
    const presupuesto = document.getElementById('advanced-presupuesto-inicial').value;
    const tiempo = document.getElementById('advanced-tiempo-disponible').value;

    if (!origen || !destino) {
        ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona origen y destino.', 'planificador_avanzado.js:379');
        return;
    }

    if (origen === destino) {
        ErrorHandler.handle('VALIDATION_ERROR', 'El origen y el destino deben ser distintos.', 'planificador_avanzado.js:384');
        return;
    }

    if (isNaN(presupuesto) || presupuesto <= 0) {
        ErrorHandler.handle('VALIDATION_ERROR', 'Ingresa un presupuesto inicial válido.', 'planificador_avanzado.js:389');
        return;
    }

    if (isNaN(tiempo) || tiempo <= 0) {
        ErrorHandler.handle('VALIDATION_ERROR', 'Ingresa un tiempo disponible válido.', 'planificador_avanzado.js:394');
        return;
    }

    setLoading(true);
    notesArea.value = '';
    resultsArea.innerHTML = '';

    startAdvancedSimulation(origen, destino, presupuesto, tiempo)
        .catch(err => {
            ErrorHandler.handle('NETWORK_ERROR', err.message, 'planificador_avanzado.js:403');
            resultsArea.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠</div><p>No se pudo iniciar la simulación avanzada.</p></div>';
        })
        .finally(() => setLoading(false));
});

function setLoading(on) {
    if (!submitButton) return;
    submitButton.disabled = on;
    submitButton.classList.toggle('loading', on);
    submitButton.querySelector('.btn-text').textContent = on ? 'Simulando...' : 'Simular planificación avanzada';
}
