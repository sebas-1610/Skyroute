(function () {
    "use strict";

    const EstadoInterrupciones = {
        blockedRoutes: new Map(),
        currentFlight: null,
        history: [],
        lastRecalculation: null
    };

    function normalizeCode(code) {
        if (code === undefined || code === null) {
            return "";
        }

        return String(code).trim().toUpperCase();
    }

    function createRouteKey(origen, destino) {
        const normalizedOrigin = normalizeCode(origen);
        const normalizedDestination = normalizeCode(destino);

        return `${normalizedOrigin}->${normalizedDestination}`;
    }

    function nowISO() {
        return new Date().toISOString();
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function addHistoryEntry(type, payload) {
        const entry = {
            type: type,
            payload: clone(payload),
            createdAt: nowISO()
        };

        EstadoInterrupciones.history.push(entry);
        return clone(entry);
    }

    function validateRoute(origen, destino) {
        const normalizedOrigin = normalizeCode(origen);
        const normalizedDestination = normalizeCode(destino);

        if (normalizedOrigin.length === 0) {
            throw new Error("El aeropuerto de origen es obligatorio.");
        }

        if (normalizedDestination.length === 0) {
            throw new Error("El aeropuerto de destino es obligatorio.");
        }

        if (normalizedOrigin === normalizedDestination) {
            throw new Error("El origen y el destino no pueden ser el mismo aeropuerto.");
        }

        return {
            origen: normalizedOrigin,
            destino: normalizedDestination
        };
    }

    function blockRoute(origen, destino, motivo, extraData) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);

        const blockedRoute = {
            key: key,
            origen: route.origen,
            destino: route.destino,
            bloqueada: true,
            motivoBloqueo: motivo ? String(motivo).trim() : "Interrupción de red",
            createdAt: nowISO(),
            extraData: extraData ? clone(extraData) : {}
        };

        EstadoInterrupciones.blockedRoutes.set(key, blockedRoute);

        addHistoryEntry("ROUTE_BLOCKED", blockedRoute);

        return clone(blockedRoute);
    }

    function unblockRoute(origen, destino) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);

        const existingRoute = EstadoInterrupciones.blockedRoutes.get(key);

        if (!existingRoute) {
            return {
                removed: false,
                key: key,
                origen: route.origen,
                destino: route.destino
            };
        }

        EstadoInterrupciones.blockedRoutes.delete(key);

        const result = {
            removed: true,
            key: key,
            origen: route.origen,
            destino: route.destino,
            removedAt: nowISO()
        };

        addHistoryEntry("ROUTE_UNBLOCKED", result);

        return clone(result);
    }

    function isRouteBlocked(origen, destino) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);

        return EstadoInterrupciones.blockedRoutes.has(key);
    }

    function getBlockedRoute(origen, destino) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);

        const blockedRoute = EstadoInterrupciones.blockedRoutes.get(key);

        if (!blockedRoute) {
            return null;
        }

        return clone(blockedRoute);
    }

    function getBlockedRoutes() {
        return Array.from(EstadoInterrupciones.blockedRoutes.values()).map(function (route) {
            return clone(route);
        });
    }

    function clearBlockedRoutes() {
        EstadoInterrupciones.blockedRoutes.clear();

        addHistoryEntry("ALL_ROUTES_UNBLOCKED", {
            message: "Todas las rutas bloqueadas fueron limpiadas."
        });
    }

    function setCurrentFlight(flightData) {
        if (!flightData) {
            throw new Error("No se recibió información del vuelo actual.");
        }

        const route = validateRoute(flightData.origen, flightData.destino);

        EstadoInterrupciones.currentFlight = {
            origen: route.origen,
            destino: route.destino,
            aeronave: flightData.aeronave ? String(flightData.aeronave) : null,
            distanciaKm: Number(flightData.distanciaKm || 0),
            costoUSD: Number(flightData.costoUSD || 0),
            tiempoMin: Number(flightData.tiempoMin || 0),
            progreso: Number(flightData.progreso || 0),
            estado: flightData.estado ? String(flightData.estado) : "EN_TRANSITO",
            startedAt: flightData.startedAt ? String(flightData.startedAt) : nowISO(),
            extraData: flightData.extraData ? clone(flightData.extraData) : {}
        };

        addHistoryEntry("CURRENT_FLIGHT_SET", EstadoInterrupciones.currentFlight);

        return clone(EstadoInterrupciones.currentFlight);
    }

    function updateCurrentFlightProgress(progreso) {
        if (!EstadoInterrupciones.currentFlight) {
            return null;
        }

        let safeProgress = Number(progreso);

        if (Number.isNaN(safeProgress)) {
            safeProgress = 0;
        }

        if (safeProgress < 0) {
            safeProgress = 0;
        }

        if (safeProgress > 100) {
            safeProgress = 100;
        }

        EstadoInterrupciones.currentFlight.progreso = safeProgress;

        addHistoryEntry("CURRENT_FLIGHT_PROGRESS_UPDATED", {
            origen: EstadoInterrupciones.currentFlight.origen,
            destino: EstadoInterrupciones.currentFlight.destino,
            progreso: safeProgress
        });

        return clone(EstadoInterrupciones.currentFlight);
    }

    function getCurrentFlight() {
        if (!EstadoInterrupciones.currentFlight) {
            return null;
        }

        return clone(EstadoInterrupciones.currentFlight);
    }

    function clearCurrentFlight() {
        const previousFlight = EstadoInterrupciones.currentFlight;

        EstadoInterrupciones.currentFlight = null;

        addHistoryEntry("CURRENT_FLIGHT_CLEARED", {
            previousFlight: previousFlight
        });

        return previousFlight ? clone(previousFlight) : null;
    }

    function isCurrentFlightAffected(origen, destino) {
        if (!EstadoInterrupciones.currentFlight) {
            return false;
        }

        const route = validateRoute(origen, destino);
        const currentOrigin = normalizeCode(EstadoInterrupciones.currentFlight.origen);
        const currentDestination = normalizeCode(EstadoInterrupciones.currentFlight.destino);

        return currentOrigin === route.origen && currentDestination === route.destino;
    }

    function interruptRoute(origen, destino, motivo, extraData) {
        const blockedRoute = blockRoute(origen, destino, motivo, extraData);
        const affectedCurrentFlight = isCurrentFlightAffected(origen, destino);

        const result = {
            blockedRoute: blockedRoute,
            affectedCurrentFlight: affectedCurrentFlight,
            returnToAirport: affectedCurrentFlight ? blockedRoute.origen : null,
            needsRecalculation: true,
            createdAt: nowISO()
        };

        if (affectedCurrentFlight && EstadoInterrupciones.currentFlight) {
            EstadoInterrupciones.currentFlight.estado = "INTERRUMPIDO";
            EstadoInterrupciones.currentFlight.interruptedAt = nowISO();
            EstadoInterrupciones.currentFlight.returnToAirport = blockedRoute.origen;
        }

        addHistoryEntry("ROUTE_INTERRUPTED", result);

        return clone(result);
    }

    function recordRecalculation(origenActual, destinoFinal, nuevaRuta, extraData) {
        const recalculation = {
            origenActual: normalizeCode(origenActual),
            destinoFinal: normalizeCode(destinoFinal),
            nuevaRuta: Array.isArray(nuevaRuta) ? clone(nuevaRuta) : [],
            extraData: extraData ? clone(extraData) : {},
            createdAt: nowISO()
        };

        EstadoInterrupciones.lastRecalculation = recalculation;

        addHistoryEntry("ROUTE_RECALCULATED", recalculation);

        return clone(recalculation);
    }

    function getLastRecalculation() {
        if (!EstadoInterrupciones.lastRecalculation) {
            return null;
        }

        return clone(EstadoInterrupciones.lastRecalculation);
    }

    function getHistory() {
        return EstadoInterrupciones.history.map(function (entry) {
            return clone(entry);
        });
    }

    function clearHistory() {
        EstadoInterrupciones.history = [];
    }

    function resetState() {
        EstadoInterrupciones.blockedRoutes.clear();
        EstadoInterrupciones.currentFlight = null;
        EstadoInterrupciones.history = [];
        EstadoInterrupciones.lastRecalculation = null;
    }

    function applyBlockedStateToRoutes(routes) {
        if (!Array.isArray(routes)) {
            return [];
        }

        return routes.map(function (route) {
            const origen = route.origen;
            const destino = route.destino;
            const key = createRouteKey(origen, destino);
            const blockedRoute = EstadoInterrupciones.blockedRoutes.get(key);
            const updatedRoute = clone(route);

            if (blockedRoute) {
                updatedRoute.bloqueada = true;
                updatedRoute.motivoBloqueo = blockedRoute.motivoBloqueo;
            } else {
                updatedRoute.bloqueada = Boolean(route.bloqueada);
                updatedRoute.motivoBloqueo = route.motivoBloqueo ? route.motivoBloqueo : null;
            }

            return updatedRoute;
        });
    }

    function getAvailableRoutes(routes) {
        if (!Array.isArray(routes)) {
            return [];
        }

        return applyBlockedStateToRoutes(routes).filter(function (route) {
            return route.bloqueada !== true;
        });
    }

    function exportState() {
        return {
            blockedRoutes: getBlockedRoutes(),
            currentFlight: getCurrentFlight(),
            history: getHistory(),
            lastRecalculation: getLastRecalculation()
        };
    }

    function importBlockedRoutes(routes) {
        if (!Array.isArray(routes)) {
            return;
        }

        routes.forEach(function (route) {
            if (route && route.origen && route.destino) {
                blockRoute(
                    route.origen,
                    route.destino,
                    route.motivoBloqueo ? route.motivoBloqueo : "Ruta bloqueada importada",
                    route.extraData ? route.extraData : {}
                );
            }
        });
    }

    window.EstadoInterrupciones = {
        blockRoute: blockRoute,
        unblockRoute: unblockRoute,
        isRouteBlocked: isRouteBlocked,
        getBlockedRoute: getBlockedRoute,
        getBlockedRoutes: getBlockedRoutes,
        clearBlockedRoutes: clearBlockedRoutes,

        setCurrentFlight: setCurrentFlight,
        updateCurrentFlightProgress: updateCurrentFlightProgress,
        getCurrentFlight: getCurrentFlight,
        clearCurrentFlight: clearCurrentFlight,
        isCurrentFlightAffected: isCurrentFlightAffected,

        interruptRoute: interruptRoute,
        recordRecalculation: recordRecalculation,
        getLastRecalculation: getLastRecalculation,

        getHistory: getHistory,
        clearHistory: clearHistory,
        resetState: resetState,

        applyBlockedStateToRoutes: applyBlockedStateToRoutes,
        getAvailableRoutes: getAvailableRoutes,

        exportState: exportState,
        importBlockedRoutes: importBlockedRoutes,

        createRouteKey: createRouteKey,
        normalizeCode: normalizeCode
    };
})();