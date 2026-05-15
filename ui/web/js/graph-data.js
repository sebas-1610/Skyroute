// Parses JSON into nodes/edges and populates the shared nodeMap.
function loadGraphData(json) {
    const nodos = json.nodos || json.aeropuertos || [];
    const aristas = json.aristas || json.rutas || [];

    nodes = nodos.map(nodo => ({
        id: nodo.id,
        ciudad: nodo.ciudad,
        pais: nodo.pais,
        esHub: nodo.esHub,
        zonaHoraria: nodo.zonaHoraria || 'N/A',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        fixed: false
    }));

    edges = aristas.map(arista => ({
        origen: arista.origen,
        destino: arista.destino,
        distanciaKm: arista.distanciaKm,
        aeronaves: arista.aeronaves,
        costoBase: arista.costoBase
    }));

    nodes.forEach(node => nodeMap.set(node.id, node));
}

// Places nodes evenly around a circle before the simulation runs.
function initNodePositions() {
    const centerX = CONFIG.width / 2;
    const centerY = CONFIG.height / 2;
    const radius = Math.min(CONFIG.width, CONFIG.height) * 0.22;

    nodes.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / nodes.length;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
    });
}

// Force-directed layout: repulsion between all nodes, attraction along edges,
// and a weak gravity pull toward the canvas centre.
function runSimulation() {
    const k = CONFIG.minNodeSeparation;
    const centerX = CONFIG.width / 2;
    const centerY = CONFIG.height / 2;

    for (let iter = 0; iter < CONFIG.maxIterations; iter++) {
        nodes.forEach(node => {
            if (node.fixed) return;
            node.vx = 0;
            node.vy = 0;
        });

        // Repulsion between every pair of nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i];
                const b = nodes[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = (k * k) / dist;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
                if (!b.fixed) { b.vx += fx; b.vy += fy; }
            }
        }

        // Attraction along edges
        edges.forEach(edge => {
            const source = nodeMap.get(edge.origen);
            const target = nodeMap.get(edge.destino);
            if (!source || !target) return;

            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = dist * 0.01;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!source.fixed) { source.vx += fx; source.vy += fy; }
            if (!target.fixed) { target.vx -= fx; target.vy -= fy; }
        });

        // Gravity toward centre
        nodes.forEach(node => {
            if (node.fixed) return;
            const dx = centerX - node.x;
            const dy = centerY - node.y;
            node.vx += dx * 0.001;
            node.vy += dy * 0.001;
        });

        const damping = 0.85;
        nodes.forEach(node => {
            if (node.fixed) return;
            node.x += node.vx * damping;
            node.y += node.vy * damping;
        });
    }

    centerGraph();
}

// Fits and centres the graph inside the visible canvas after simulation.
function centerGraph() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
    });

    const graphWidth  = maxX - minX;
    const graphHeight = maxY - minY;
    const availWidth  = CONFIG.width  - CONFIG.padding * 2;
    const availHeight = CONFIG.height - CONFIG.padding * 2;

    const scaleX = availWidth  / graphWidth;
    const scaleY = availHeight / graphHeight;
    scale = Math.min(scaleX, scaleY, 1.5);

    const centerX = CONFIG.width  / 2;
    const centerY = CONFIG.height / 2;
    offsetX = centerX - (minX + maxX) / 2 * scale;
    offsetY = centerY - (minY + maxY) / 2 * scale;

    // Allow zooming out to 40% of the fitted scale, but never below 0.05
    CONFIG.zoomMin = Math.max(0.05, scale * 0.4);
}