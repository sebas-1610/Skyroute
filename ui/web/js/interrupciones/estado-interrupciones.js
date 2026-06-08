(function () {
    "use strict";

    const state = {
        blockedRoutes: new Map(),
        currentFlight: null,
        history: [],
        lastRecalculation: null
    };

    function normalizeCode(code) {
        return String(code || "").trim().toUpperCase();
    }

    function createRouteKey(origen, destino) {
        return `${normalizeCode(origen)}->${normalizeCode(destino)}`;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function nowISO() {
        return new Date().toISOString();
    }

    function addHistory(type, payload) {
        state.history.push({
            type,
            payload: clone(payload),
            createdAt: nowISO()
        });
    }

    function validateRoute(origen, destino) {
        const cleanOrigin = normalizeCode(origen);
        const cleanDestination = normalizeCode(destino);

        if (!cleanOrigin) {
            throw new Error("El origen de la ruta es obligatorio.");
        }

        if (!cleanDestination) {
            throw new Error("El destino de la ruta es obligatorio.");
        }

        if (cleanOrigin === cleanDestination) {
            throw new Error("El origen y el destino no pueden ser iguales.");
        }

        return {
            origen: cleanOrigin,
            destino: cleanDestination
        };
    }

    function blockRoute(origen, destino, motivo, extraData) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);

        const blockedRoute = {
            key,
            origen: route.origen,
            destino: route.destino,
            bloqueada: true,
            motivoBloqueo: motivo ? String(motivo).trim() : "Interrupción de red",
            createdAt: nowISO(),
            extraData: extraData ? clone(extraData) : {}
        };

        state.blockedRoutes.set(key, blockedRoute);
        addHistory("ROUTE_BLOCKED", blockedRoute);

        return clone(blockedRoute);
    }

    function unblockRoute(origen, destino) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);

        const existed = state.blockedRoutes.has(key);
        state.blockedRoutes.delete(key);

        const result = {
            removed: existed,
            key,
            origen: route.origen,
            destino: route.destino,
            removedAt: nowISO()
        };

        addHistory("ROUTE_UNBLOCKED", result);

        return clone(result);
    }

    function isRouteBlocked(origen, destino) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);

        return state.blockedRoutes.has(key);
    }

    function getBlockedRoute(origen, destino) {
        const route = validateRoute(origen, destino);
        const key = createRouteKey(route.origen, route.destino);
        const blockedRoute = state.blockedRoutes.get(key);

        return blockedRoute ? clone(blockedRoute) : null;
    }

    function getBlockedRoutes() {
        return Array.from(state.blockedRoutes.values()).map(route => clone(route));
    }

    function clearBlockedRoutes() {
        state.blockedRoutes.clear();
        addHistory("ALL_ROUTES_CLEARED", {
            message: "Se limpiaron todas las rutas bloqueadas."
        });
    }

    function setCurrentFlight(flightData) {
        if (!flightData) {
            throw new Error("No se recibió información del vuelo actual.");
        }

        const route = validateRoute(flightData.origen, flightData.destino);

        state.currentFlight = {
            origen: route.origen,
            destino: route.destino,
            aeronave: flightData.aeronave || null,
            distanciaKm: Number(flightData.distanciaKm || 0),
            costoUSD: Number(flightData.costoUSD || 0),
            tiempoMin: Number(flightData.tiempoMin || 0),
            progreso: Number(flightData.progreso || 0),
            estado: flightData.estado || "EN_TRANSITO",
            startedAt: nowISO()
        };

        addHistory("CURRENT_FLIGHT_SET", state.currentFlight);

        return clone(state.currentFlight);
    }

    function getCurrentFlight() {
        return state.currentFlight ? clone(state.currentFlight) : null;
    }

    function clearCurrentFlight() {
        const previousFlight = state.currentFlight ? clone(state.currentFlight) : null;

        state.currentFlight = null;

        addHistory("CURRENT_FLIGHT_CLEARED", {
            previousFlight
        });

        return previousFlight;
    }

    function isCurrentFlightAffected(origen, destino) {
        if (!state.currentFlight) {
            return false;
        }

        return (
            normalizeCode(state.currentFlight.origen) === normalizeCode(origen) &&
            normalizeCode(state.currentFlight.destino) === normalizeCode(destino)
        );
    }

    function interruptRoute(origen, destino, motivo, extraData) {
        const blockedRoute = blockRoute(origen, destino, motivo, extraData);
        const affectedCurrentFlight = isCurrentFlightAffected(origen, destino);

        if (affectedCurrentFlight && state.currentFlight) {
            state.currentFlight.estado = "INTERRUMPIDO";
            state.currentFlight.interruptedAt = nowISO();
            state.currentFlight.returnToAirport = blockedRoute.origen;
        }

        const result = {
            blockedRoute,
            affectedCurrentFlight,
            returnToAirport: affectedCurrentFlight ? blockedRoute.origen : null,
            needsRecalculation: true,
            createdAt: nowISO()
        };

        addHistory("ROUTE_INTERRUPTED", result);

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

        state.lastRecalculation = recalculation;
        addHistory("ROUTE_RECALCULATED", recalculation);

        return clone(recalculation);
    }

    function getLastRecalculation() {
        return state.lastRecalculation ? clone(state.lastRecalculation) : null;
    }

    function getHistory() {
        return state.history.map(entry => clone(entry));
    }

    function clearHistory() {
        state.history = [];
    }

    function resetState() {
        state.blockedRoutes.clear();
        state.currentFlight = null;
        state.history = [];
        state.lastRecalculation = null;
    }

    function applyBlockedStateToRoutes(routes) {
        if (!Array.isArray(routes)) {
            return [];
        }

        return routes.map(route => {
            const updatedRoute = clone(route);
            const key = createRouteKey(updatedRoute.origen, updatedRoute.destino);
            const blockedRoute = state.blockedRoutes.get(key);

            if (blockedRoute) {
                updatedRoute.bloqueada = true;
                updatedRoute.motivoBloqueo = blockedRoute.motivoBloqueo;
            } else {
                updatedRoute.bloqueada = updatedRoute.bloqueada === true;
                updatedRoute.motivoBloqueo = updatedRoute.motivoBloqueo || null;
            }

            return updatedRoute;
        });
    }

    function getAvailableRoutes(routes) {
        return applyBlockedStateToRoutes(routes).filter(route => route.bloqueada !== true);
    }

    function importBlockedRoutes(routes) {
        if (!Array.isArray(routes)) {
            return;
        }

        routes.forEach(route => {
            if (route && route.origen && route.destino) {
                blockRoute(
                    route.origen,
                    route.destino,
                    route.motivoBloqueo || "Ruta bloqueada desde JSON",
                    route.extraData || {}
                );
            }
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

    window.EstadoInterrupciones = {
        normalizeCode,
        createRouteKey,

        blockRoute,
        unblockRoute,
        isRouteBlocked,
        getBlockedRoute,
        getBlockedRoutes,
        clearBlockedRoutes,

        setCurrentFlight,
        getCurrentFlight,
        clearCurrentFlight,
        isCurrentFlightAffected,

        interruptRoute,

        recordRecalculation,
        getLastRecalculation,

        getHistory,
        clearHistory,
        resetState,

        applyBlockedStateToRoutes,
        getAvailableRoutes,
        importBlockedRoutes,
        exportState
    };
})();