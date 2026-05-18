// Entry point — wires up the canvas, resize listener and event handlers.
function initLayout() {
    CONFIG.canvas = document.getElementById('graph-canvas');
    CONFIG.ctx    = CONFIG.canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupEventListeners();
    drawEmptyState();
}

// Keeps canvas dimensions in sync with the window and redraws.
function resizeCanvas() {
    CONFIG.width  = window.innerWidth;
    CONFIG.height = window.innerHeight;
    CONFIG.canvas.width  = CONFIG.width;
    CONFIG.canvas.height = CONFIG.height;
    if (graphLoaded) draw(); else drawEmptyState();
}

// Registers all canvas and document event listeners.
function setupEventListeners() {
    const canvas = CONFIG.canvas;

    canvas.addEventListener('mousedown',  handleMouseDown);
    canvas.addEventListener('dblclick',   handleDoubleClick);
    canvas.addEventListener('mousemove',  handleMouseMove);
    canvas.addEventListener('mouseup',    handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel',      handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.getElementById('file-input').addEventListener('change', handleFileLoad);
    document.getElementById('close-panel').addEventListener('click', handleClosePanel);

    // Toggle legend visibility
    const toggleLegendBtn = document.getElementById('toggle-legend');
    if (toggleLegendBtn) {
        toggleLegendBtn.addEventListener('click', handleToggleLegend);
    }
}

// ── Event handlers ────────────────────────────────────────────────────────────

function handleClosePanel() {
    selectedNode = null;
    hideAirportPanel();
    draw();
}

function handleDoubleClick(e) {
    if (!graphLoaded) return;
    const rect   = CONFIG.canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - offsetX) / scale;
    const worldY = (e.clientY - rect.top  - offsetY) / scale;

    const clickedNode = findNodeAtPosition(worldX, worldY);

    if (clickedNode) {
        selectedNode = clickedNode;
        showAirportPanel(clickedNode);
    } else {
        hideAirportPanel();
        selectedNode = null;
    }
    draw();
}

function handleMouseDown(e) {
    if (e.button !== 0 && e.button !== 1) return;
    const rect   = CONFIG.canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - offsetX) / scale;
    const worldY = (e.clientY - rect.top  - offsetY) / scale;

    const clickedNode = graphLoaded ? findNodeAtPosition(worldX, worldY) : null;

    if (clickedNode && e.button === 0) {
        draggedNode  = clickedNode;
        selectedNode = clickedNode;
        dragStartX   = e.clientX;
        dragStartY   = e.clientY;
        CONFIG.canvas.style.cursor = 'grabbing';
        draw();
    } else {
        isPanning  = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        CONFIG.canvas.style.cursor = 'grabbing';
        if (e.button === 0 && graphLoaded) {
            selectedNode = null;
            draw();
            hideAirportPanel();
        }
    }
}

function handleMouseMove(e) {
    const rect = CONFIG.canvas.getBoundingClientRect();

    if (isPanning) {
        offsetX += e.clientX - dragStartX;
        offsetY += e.clientY - dragStartY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        if (graphLoaded) draw(); else drawEmptyState();
        return;
    }

    if (draggedNode) {
        const worldX = (e.clientX - rect.left - offsetX) / scale;
        const worldY = (e.clientY - rect.top  - offsetY) / scale;
        draggedNode.x     = worldX;
        draggedNode.y     = worldY;
        draggedNode.fixed = true;
        draw();
        return;
    }

    if (graphLoaded) {
        const worldX      = (e.clientX - rect.left - offsetX) / scale;
        const worldY      = (e.clientY - rect.top  - offsetY) / scale;
        const hoveredNode = findNodeAtPosition(worldX, worldY);
        CONFIG.canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
        showTooltip(hoveredNode, e.clientX, e.clientY);
    }
}

function handleMouseUp() {
    if (draggedNode) draggedNode.fixed = true;
    draggedNode = null;
    isPanning   = false;
    CONFIG.canvas.style.cursor = 'grab';
}

function handleWheel(e) {
    e.preventDefault();

    const rect   = CONFIG.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Normalise deltaY to pixels regardless of deltaMode
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 24;   // lines → pixels
    if (e.deltaMode === 2) delta *= 240;  // pages → pixels

    // Continuous zoom: each pixel of scroll = 0.1% scale change
    const zoomFactor = Math.pow(0.999, delta);
    const newScale   = Math.max(CONFIG.zoomMin, Math.min(CONFIG.zoomMax, scale * zoomFactor));

    // Always update offset and redraw (avoids float-comparison dead zone at limits)
    offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
    offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
    scale   = newScale;
    if (graphLoaded) draw(); else drawEmptyState();
}

// Reads the selected JSON file, validates it, and loads the graph.
function handleFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const json = JSON.parse(event.target.result);
            if (json.nodos && json.aristas) {
                graphLoaded  = true;
                nodes        = [];
                edges        = [];
                selectedNode = null;
                nodeMap.clear();
                loadGraphData(json);
                initNodePositions();
                runSimulation();
                draw();
            } else {
                alert('JSON inválido: debe contener los campos "nodos" y "aristas".');
            }
        } catch (err) {
            alert('Error al parsear el JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function handleToggleLegend() {
    const legend = document.getElementById('legend');
    const icon = document.getElementById('legend-eye-icon');
    
    legend.classList.toggle('collapsed');
    
    if (legend.classList.contains('collapsed')) {
        // Ojo cerrado (línea con X)
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.98 9.98 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        // Ojo abierto
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

window.addEventListener('DOMContentLoaded', initLayout);