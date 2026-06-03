function getAdjacentAirports(nodeId) {
    var gd = SkyRouteD3.getGraphData();
    if (!gd) return [];
    var adj = gd.adjacencyMap.get(nodeId);
    if (!adj) return [];
    return Array.from(adj).map(function(id) {
        var n = gd.nodeIndex.get(id);
        return n ? { id: n.id, ciudad: n.ciudad } : { id: id, ciudad: '?' };
    }).sort(function(a, b) { return a.id.localeCompare(b.id); });
}

function getAircraftFromNode(nodeId) {
    var gd = SkyRouteD3.getGraphData();
    if (!gd) return [];
    var aircraft = new Set();
    gd.links.forEach(function(l) {
        if (l.source.id === nodeId || l.source === nodeId) {
            l.aeronaves.forEach(function(a) { aircraft.add(a); });
        }
    });
    return Array.from(aircraft).sort();
}

function showAirportPanel(node) {
    var panel = document.getElementById('airport-panel');
    panel.querySelector('.panel-iata').textContent = node.id;
    var typeSpan = panel.querySelector('.panel-type');
    typeSpan.textContent = node.esHub ? 'Hub' : 'Secundario';
    typeSpan.className = 'panel-type' + (node.esHub ? ' hub' : '');
    panel.querySelector('.panel-info .city').textContent = node.ciudad;
    panel.querySelector('.panel-info .country').textContent = node.pais;
    panel.querySelector('.panel-info .timezone').textContent = node.zonaHoraria;

    var adjContainer = panel.querySelector('.adjacent-list');
    adjContainer.innerHTML = '';
    var adjList = getAdjacentAirports(node.id);
    if (adjList.length > 0) {
        adjList.forEach(function(adj) {
            var tag = document.createElement('span');
            tag.className = 'adjacent-tag';
            tag.textContent = adj.id + ' (' + adj.ciudad + ')';
            adjContainer.appendChild(tag);
        });
    } else {
        adjContainer.innerHTML = '<span class="adjacent-tag">Sin conexiones</span>';
    }

    var acContainer = panel.querySelector('.aircraft-list');
    acContainer.innerHTML = '';
    var acList = getAircraftFromNode(node.id);
    if (acList.length > 0) {
        acList.forEach(function(ac) {
            var tag = document.createElement('span');
            tag.className = 'aircraft-tag';
            tag.textContent = ac;
            acContainer.appendChild(tag);
        });
    } else {
        acContainer.innerHTML = '<span class="aircraft-tag">Sin rutas</span>';
    }

    panel.classList.add('active');
}

function hideAirportPanel() {
    document.getElementById('airport-panel').classList.remove('active');
}

document.addEventListener('DOMContentLoaded', function() {
    var graphContainer = document.getElementById('graph-container');
    if (!graphContainer) return;

    SkyRouteD3.init('#graph-container', {
        onNodeSelected: function(node) { showAirportPanel(node); },
        onNodeDblClick: function(node) { showAirportPanel(node); }
    });

    // Check if coming from planificador
    var params = new URLSearchParams(window.location.search);
    var fromPlanner = params.get('from') === 'planificador';

    if (fromPlanner) {
        document.getElementById('btn-back').style.display = 'inline-flex';
    }

    // Auto-load from localStorage if available
    var networkRaw = localStorage.getItem('skyroute_network');
    if (networkRaw) {
        try {
            var json = JSON.parse(networkRaw);
            if ((json.nodos || json.aeropuertos) && (json.aristas || json.rutas)) {
                SkyRouteD3.loadGraph(json);

                // If coming from planner, also load and highlight the route
                if (fromPlanner) {
                    var routeRaw = localStorage.getItem('skyroute_route');
                    if (routeRaw) {
                        try {
                            var route = JSON.parse(routeRaw);
                            function waitForSim() {
                                if (typeof SkyRouteD3.getSimulation === 'function') {
                                    var sim = SkyRouteD3.getSimulation();
                                    if (sim && sim.alpha() > sim.alphaMin()) {
                                        setTimeout(waitForSim, 100);
                                        return;
                                    }
                                }
                                SkyRouteD3.highlightRoute(route.path, route.segments);
                            }
                            waitForSim();
                        } catch (_) {}
                    }
                }
            }
        } catch (_) {}
    }

    // File input handler (manual load)
    document.getElementById('file-input').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            try {
                var json = JSON.parse(ev.target.result);
                if ((json.nodos || json.aeropuertos) && (json.aristas || json.rutas)) {
                    SkyRouteD3.loadGraph(json);
                    localStorage.setItem('skyroute_network', JSON.stringify({
                        nodos: json.nodos || json.aeropuertos || [],
                        aristas: json.aristas || json.rutas || [],
                        configuracion: json.configuracion || {}
                    }));
                } else {
                    alert('JSON inválido: debe contener "nodos" y "aristas".');
                }
            } catch(err) {
                alert('Error al parsear JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // "Volver" button — clean up route data before navigating
    var backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            localStorage.removeItem('skyroute_route');
            localStorage.removeItem('skyroute_active_criterio');
        });
    }

    document.getElementById('close-panel').addEventListener('click', function() {
        SkyRouteD3.deselectNode();
        hideAirportPanel();
    });

    var toggleBtn = document.getElementById('toggle-legend');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            var legend = document.getElementById('legend');
            var icon = document.getElementById('legend-eye-icon');
            legend.classList.toggle('collapsed');
            if (legend.classList.contains('collapsed')) {
                icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.98 9.98 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
            } else {
                icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        });
    }
});
