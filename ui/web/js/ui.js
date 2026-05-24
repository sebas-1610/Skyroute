// Returns the topmost node whose hit-radius contains (x, y), or null.
function findNodeAtPosition(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const r  = node.esHub ? CONFIG.hubRadius : CONFIG.secondaryRadius;
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy <= r * r) return node;
    }
    return null;
}

// Shows or hides the hover tooltip near the cursor.
function showTooltip(node, mouseX, mouseY) {
    const tooltip = document.getElementById('tooltip');

    if (node) {
        tooltip.querySelector('.iata').textContent = node.id;
        tooltip.querySelector('.city').textContent = node.ciudad + ', ' + node.pais;
        tooltip.style.display = 'block';
        tooltip.style.left    = (mouseX + 15) + 'px';
        tooltip.style.top     = (mouseY + 15) + 'px';
    } else {
        tooltip.style.display = 'none';
    }
}

// Returns all airports (both directions) connected to nodeId, sorted by IATA code.
function getAdjacentAirports(nodeId) {
    const adjacent = new Set();
    edges.forEach(edge => {
        if (edge.origen  === nodeId) adjacent.add(edge.destino);
        if (edge.destino === nodeId) adjacent.add(edge.origen);
    });
    return Array.from(adjacent)
        .map(id => {
            const node = nodeMap.get(id);
            return node ? { id: node.id, ciudad: node.ciudad } : { id, ciudad: '?' };
        })
        .sort((a, b) => a.id.localeCompare(b.id));
}

// Returns the unique aircraft types operating on outgoing routes from nodeId.
function getAircraftFromNode(nodeId) {
    const aircraft = new Set();
    edges.forEach(edge => {
        if (edge.origen === nodeId && edge.aeronaves) {
            edge.aeronaves.forEach(a => aircraft.add(a));
        }
    });
    return Array.from(aircraft).sort();
}

// Returns airlines operating at the node (if provided in node data)
function getAirlinesFromNode(nodeId) {
    const node = nodeMap.get(nodeId);
    if (!node) return [];
    if (Array.isArray(node.aerolineas)) return node.aerolineas.slice().sort();
    // Fallback: attempt to infer from outgoing routes (if route has 'aerolinea')
    const set = new Set();
    edges.forEach(edge => {
        if (edge.origen === nodeId && edge.aerolineas && Array.isArray(edge.aerolineas)) {
            edge.aerolineas.forEach(a => set.add(a));
        }
    });
    return Array.from(set).sort();
}

// Populates and shows the airport info panel for the given node.
function showAirportPanel(node) {
    const panel = document.getElementById('airport-panel');

    panel.querySelector('.panel-iata').textContent = node.id;

    const typeSpan = panel.querySelector('.panel-type');
    typeSpan.textContent = node.esHub ? 'Hub' : 'Secundario';
    typeSpan.className   = 'panel-type' + (node.esHub ? ' hub' : '');

    panel.querySelector('.panel-info .city').textContent     = node.ciudad;
    panel.querySelector('.panel-info .country').textContent  = node.pais;
    panel.querySelector('.panel-info .timezone').textContent = node.zonaHoraria;

    const adjacentContainer = panel.querySelector('.adjacent-list');
    adjacentContainer.innerHTML = '';
    const adjacentAirports = getAdjacentAirports(node.id);
    if (adjacentAirports.length > 0) {
        adjacentAirports.forEach(adj => {
            const tag = document.createElement('span');
            tag.className   = 'adjacent-tag';
            tag.textContent = adj.id + ' (' + adj.ciudad + ')';
            adjacentContainer.appendChild(tag);
        });
    } else {
        adjacentContainer.innerHTML = '<span class="adjacent-tag">Sin conexiones</span>';
    }

    const aircraftContainer = panel.querySelector('.aircraft-list');
    aircraftContainer.innerHTML = '';
    const aircraft = getAircraftFromNode(node.id);
    if (aircraft.length > 0) {
        aircraft.forEach(ac => {
            const tag = document.createElement('span');
            tag.className   = 'aircraft-tag';
            tag.textContent = ac;
            aircraftContainer.appendChild(tag);
        });
    } else {
        aircraftContainer.innerHTML = '<span class="aircraft-tag">Sin rutas</span>';
    }

    const airlinesContainer = panel.querySelector('.airlines-list');
    airlinesContainer.innerHTML = '';
    const airlines = getAirlinesFromNode(node.id);
    if (airlines.length > 0) {
        airlines.forEach(al => {
            const tag = document.createElement('span');
            tag.className = 'airline-tag';
            tag.textContent = al;
            airlinesContainer.appendChild(tag);
        });
    } else {
        airlinesContainer.innerHTML = '<span class="airline-tag">No disponible</span>';
    }

    panel.classList.add('active');
}

// Hides the airport info panel.
function hideAirportPanel() {
    document.getElementById('airport-panel').classList.remove('active');
}