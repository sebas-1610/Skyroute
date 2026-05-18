// Renders the placeholder screen shown before any JSON is loaded.
function drawEmptyState() {
    const ctx = CONFIG.ctx;
    const w = CONFIG.width;
    const h = CONFIG.height;

    ctx.fillStyle = CONFIG.bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.font = 'bold 96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d4870a';
    ctx.fillText('✈', w / 2, h / 2 - 48);
    ctx.restore();

    ctx.fillStyle = '#e8dfc0';
    ctx.font = '500 20px Syne, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Carga un archivo JSON para visualizar la red aérea', w / 2, h / 2 + 28);

    ctx.fillStyle = '#8b949e';
    ctx.font = '13px JetBrains Mono, monospace';
    ctx.fillText('Usa el botón "Cargar JSON" en la esquina superior izquierda', w / 2, h / 2 + 60);
}

// Main render loop: clears canvas, draws all edges then all nodes.
function draw() {
    const ctx = CONFIG.ctx;
    const w = CONFIG.width;
    const h = CONFIG.height;

    ctx.fillStyle = CONFIG.bgColor;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    edges.forEach(edge => {
        const isHighlighted = selectedNode &&
            (edge.origen === selectedNode.id || edge.destino === selectedNode.id);
        const isOutgoing = selectedNode && edge.origen === selectedNode.id;
        drawEdge(edge, isHighlighted, isOutgoing);
    });

    nodes.forEach(drawNode);

    ctx.restore();
}

// Draws a single directed edge with optional curvature for bidirectional pairs,
// an arrowhead at the target, and distance/aircraft labels.
function drawEdge(edge, isHighlighted, isOutgoing) {
    const ctx = CONFIG.ctx;
    const source = nodeMap.get(edge.origen);
    const target = nodeMap.get(edge.destino);

    if (!source || !target) return;

    const hasReverse = edges.some(e => e.origen === edge.destino && e.destino === edge.origen);
    const curvature = hasReverse ? CONFIG.curvature : CONFIG.curvature * 0.5;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    let midX = (source.x + target.x) / 2;
    let midY = (source.y + target.y) / 2;

    if (hasReverse) {
        const perpX = -dy / dist;
        const perpY =  dx / dist;
        midX += perpX * curvature;
        midY += perpY * curvature;
    }

    let opacity = 1;
    let lineWidth  = CONFIG.defaultEdgeWidth;
    let strokeColor = edge.costoBase === 0 ? CONFIG.subsidizedColor : CONFIG.edgeColor;

    if (selectedNode) {
        const isIncoming = selectedNode && edge.destino === selectedNode.id;
        
        if (isOutgoing) {
            strokeColor = CONFIG.outgoingEdgeColor;
            lineWidth   = CONFIG.highlightWidth;
        } else if (isIncoming) {
            strokeColor = CONFIG.incomingEdgeColor;
            lineWidth   = CONFIG.highlightWidth;
        } else if (isHighlighted) {
            strokeColor = CONFIG.edgeColor;
            opacity = 1;
        } else {
            opacity = CONFIG.dimOpacity;
        }
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = lineWidth;

    if (edge.costoBase === 0) ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    if (hasReverse) {
        ctx.quadraticCurveTo(midX, midY, target.x, target.y);
    } else {
        ctx.lineTo(target.x, target.y);
    }
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(target.y - midY, target.x - midX);
    const arrowSize = CONFIG.arrowSize;

    ctx.setLineDash([]);
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y);
    ctx.lineTo(
        target.x - arrowSize * Math.cos(angle - Math.PI / 6),
        target.y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        target.x - arrowSize * Math.cos(angle + Math.PI / 6),
        target.y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // Distance label
    drawEdgeLabel(midX, midY, edge.distanciaKm + ' km', false);

    // Aircraft label
    if (edge.aeronaves && edge.aeronaves.length > 0) {
        drawEdgeLabel(midX, midY + 8, edge.aeronaves.join(' · '), true);
    }

    ctx.restore();
}

// Draws a pill-shaped label on an edge midpoint.
function drawEdgeLabel(x, y, text, isAircraft) {
    const ctx = CONFIG.ctx;

    ctx.font = (isAircraft ? '8px ' : '9px ') + CONFIG.fontMono;

    const metrics = ctx.measureText(text);
    const padding = 3;
    const w = metrics.width + padding * 2;
    const h = isAircraft ? 12 : 14;
    const r = h / 2;

    ctx.fillStyle   = CONFIG.pillBgColor;
    ctx.strokeStyle = CONFIG.pillBorderColor;
    ctx.lineWidth   = 1;

    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle    = isAircraft ? CONFIG.aircraftColor : CONFIG.textColor;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}

// Draws a single node circle with its IATA label. Dims unconnected nodes
// when another node is selected.
function drawNode(node) {
    const ctx = CONFIG.ctx;
    const r     = node.esHub ? CONFIG.hubRadius : CONFIG.secondaryRadius;
    const color = node.esHub ? CONFIG.hubColor  : CONFIG.secondaryColor;

    let opacity = 1;
    if (selectedNode && selectedNode !== node) {
        const connected = edges.some(e =>
            (e.origen === selectedNode.id && e.destino === node.id) ||
            (e.destino === selectedNode.id && e.origen === node.id)
        );
        if (!connected) opacity = CONFIG.dimOpacity;
    }

    ctx.save();
    ctx.globalAlpha = opacity;

    ctx.fillStyle   = color;
    ctx.strokeStyle = lightenColor(color, 0.2);
    ctx.lineWidth   = 2;

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold ' + (node.esHub ? 14 : 12) + 'px ' + CONFIG.fontMono;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.id, node.x, node.y);

    ctx.restore();
}

// Returns a lightened version of a hex colour for node stroke highlights.
function lightenColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 255 * amount);
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 255 * amount);
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 255 * amount);
    return `rgb(${r}, ${g}, ${b})`;
}