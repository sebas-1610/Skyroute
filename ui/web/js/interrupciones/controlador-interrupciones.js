(function () {
    "use strict";

    function ensureEstadoDisponible() {
        if (!window.EstadoInterrupciones) {
            throw new Error("EstadoInterrupciones no está cargado. Revisa el orden de los scripts.");
        }
    }

    function normalizeCode(code) {
        ensureEstadoDisponible();
        return window.EstadoInterrupciones.normalizeCode(code);
    }

    function dispatchInterruptionEvent(eventName, detail) {
        const event = new CustomEvent(eventName, {
            detail: detail
        });

        window.dispatchEvent(event);
    }

    function showMessage(message, type) {
        const messageBox = document.getElementById("interruption-message");

        if (!messageBox) {
            console.log(`[${type || "info"}] ${message}`);
            return;
        }

        messageBox.textContent = message;
        messageBox.className = `interruption-message ${type || "info"}`;
    }

    function getRouteFormData() {
        const originInput = document.getElementById("interrupt-origin");
        const destinationInput = document.getElementById("interrupt-destination");
        const reasonInput = document.getElementById("interrupt-reason");

        const origen = originInput ? originInput.value : "";
        const destino = destinationInput ? destinationInput.value : "";
        const motivo = reasonInput && reasonInput.value.trim()
            ? reasonInput.value.trim()
            : "Interrupción de red";

        return {
            origen: normalizeCode(origen),
            destino: normalizeCode(destino),
            motivo: motivo
        };
    }

    function renderBlockedRoutes() {
        ensureEstadoDisponible();

        const container = document.getElementById("blocked-routes-list");

        if (!container) {
            return;
        }

        const blockedRoutes = window.EstadoInterrupciones.getBlockedRoutes();

        if (blockedRoutes.length === 0) {
            container.innerHTML = `
                <p class="empty-blocked-routes">
                    No hay rutas bloqueadas actualmente.
                </p>
            `;
            return;
        }

        container.innerHTML = blockedRoutes.map(function (route) {
            return `
                <div class="blocked-route-card" data-origin="${route.origen}" data-destination="${route.destino}">
                    <div>
                        <strong>${route.origen} → ${route.destino}</strong>
                        <p>${route.motivoBloqueo}</p>
                    </div>

                    <button 
                        type="button" 
                        class="btn-unblock-route"
                        data-origin="${route.origen}"
                        data-destination="${route.destino}">
                        Desbloquear
                    </button>
                </div>
            `;
        }).join("");

        container.querySelectorAll(".btn-unblock-route").forEach(function (button) {
            button.addEventListener("click", function () {
                const origen = button.dataset.origin;
                const destino = button.dataset.destination;

                unblockRoute(origen, destino);
            });
        });
    }

    function blockRoute(origen, destino, motivo) {
        ensureEstadoDisponible();

        const result = window.EstadoInterrupciones.interruptRoute(origen, destino, motivo);

        renderBlockedRoutes();

        if (result.affectedCurrentFlight) {
            showMessage(
                `Ruta ${origen} → ${destino} bloqueada. El viajero debe regresar a ${result.returnToAirport}.`,
                "warning"
            );
        } else {
            showMessage(
                `Ruta ${origen} → ${destino} bloqueada correctamente.`,
                "success"
            );
        }

        dispatchInterruptionEvent("skyroute:route-blocked", result);

        if (result.affectedCurrentFlight) {
            dispatchInterruptionEvent("skyroute:current-flight-interrupted", result);
        }

        dispatchInterruptionEvent("skyroute:recalculation-needed", result);

        return result;
    }

    function unblockRoute(origen, destino) {
        ensureEstadoDisponible();

        const result = window.EstadoInterrupciones.unblockRoute(origen, destino);

        renderBlockedRoutes();

        if (result.removed) {
            showMessage(`Ruta ${origen} → ${destino} desbloqueada.`, "success");
        } else {
            showMessage(`La ruta ${origen} → ${destino} no estaba bloqueada.`, "info");
        }

        dispatchInterruptionEvent("skyroute:route-unblocked", result);

        return result;
    }

    function handleBlockRouteFromForm() {
        try {
            const formData = getRouteFormData();

            if (!formData.origen || !formData.destino) {
                showMessage("Debes seleccionar origen y destino de la ruta.", "error");
                return;
            }

            blockRoute(formData.origen, formData.destino, formData.motivo);
        } catch (error) {
            showMessage(error.message, "error");
            console.error(error);
        }
    }

    function setCurrentFlight(flightData) {
        ensureEstadoDisponible();

        const flight = window.EstadoInterrupciones.setCurrentFlight(flightData);

        dispatchInterruptionEvent("skyroute:current-flight-set", flight);

        return flight;
    }

    function clearCurrentFlight() {
        ensureEstadoDisponible();

        const previousFlight = window.EstadoInterrupciones.clearCurrentFlight();

        dispatchInterruptionEvent("skyroute:current-flight-cleared", {
            previousFlight: previousFlight
        });

        return previousFlight;
    }

    function applyBlockedRoutesToDataset(routes) {
        ensureEstadoDisponible();

        return window.EstadoInterrupciones.applyBlockedStateToRoutes(routes);
    }

    function getAvailableRoutes(routes) {
        ensureEstadoDisponible();

        return window.EstadoInterrupciones.getAvailableRoutes(routes);
    }

    function getBlockedRoutes() {
        ensureEstadoDisponible();

        return window.EstadoInterrupciones.getBlockedRoutes();
    }

    function setupPanelEvents() {
        const blockButton = document.getElementById("btn-block-route");

        if (blockButton) {
            blockButton.addEventListener("click", handleBlockRouteFromForm);
        }

        renderBlockedRoutes();
    }

    function init() {
        ensureEstadoDisponible();
        setupPanelEvents();

        console.log("ControladorInterrupciones cargado correctamente.");
    }

    window.ControladorInterrupciones = {
        init: init,

        blockRoute: blockRoute,
        unblockRoute: unblockRoute,
        getBlockedRoutes: getBlockedRoutes,

        setCurrentFlight: setCurrentFlight,
        clearCurrentFlight: clearCurrentFlight,

        applyBlockedRoutesToDataset: applyBlockedRoutesToDataset,
        getAvailableRoutes: getAvailableRoutes,

        renderBlockedRoutes: renderBlockedRoutes
    };

    document.addEventListener("DOMContentLoaded", function () {
        try {
            init();
        } catch (error) {
            console.error("Error inicializando ControladorInterrupciones:", error);
        }
    });
})();