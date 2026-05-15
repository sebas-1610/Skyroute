// No embedded data — graph loads from user JSON file
let graphLoaded = false;

const CONFIG = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    padding: 60,
    minNodeSeparation: 20,
    maxIterations: 300,
    hubRadius: 28,
    secondaryRadius: 20,
    hubColor: '#d4870a',
    secondaryColor: '#2abfa0',
    edgeColor: 'rgba(180, 160, 110, 0.45)',
    subsidizedColor: '#d4634a',
    highlightColor: '#f0a500',
    highlightWidth: 2.5,
    dimOpacity: 0.15,
    defaultEdgeWidth: 1.5,
    arrowSize: 10,
    curvature: 18,
    bgColor: '#0d1117',
    textColor: '#e8dfc0',
    pillBgColor: '#1a1f2e',
    pillBorderColor: '#333333',
    aircraftColor: '#2abfa0',
    fontMono: 'JetBrains Mono, monospace',
    zoomMin: 0.3,
    zoomMax: 3.0
};

let nodes = [];
let edges = [];
let nodeMap = new Map();
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let selectedNode = null;
let draggedNode = null;
let dragStartX = 0;
let dragStartY = 0;
let isPanning = false;
let animationFrameId = null;