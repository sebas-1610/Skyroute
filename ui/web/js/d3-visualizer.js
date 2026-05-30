/**
 * SkyRoute D3 — Visualizer Module
 * Renders the airport network graph using D3.js v7 (SVG + force simulation).
 * Uses visualEdges: one visual edge per node pair, bidirectional pairs merged.
 */

var SkyRouteD3 = (function () {
    'use strict';

    // ── Configuration ────────────────────────────────────────────────────────
    var CFG = {
        hubRadius: 28,
        secondaryRadius: 20,
        hubColor: '#d4870a',
        secondaryColor: '#2abfa0',
        edgeColor: 'rgba(180,160,110,0.45)',
        subsidizedColor: '#d4634a',
        outgoingEdgeColor: '#ff6b6b',
        incomingEdgeColor: '#4ecdc4',
        dimOpacity: 0.15,
        pillBg: '#1a1f2e',
        pillBorder: '#333333',
        textColor: '#e8dfc0',
        aircraftColor: '#2abfa0',
        bgColor: '#0d1117',
        arrowDefault: '#d4870a',
        forceStrength: -400,
        linkDistanceBase: 120,
        linkDistanceFactor: 0.02,
        collisionPad: 6,
        zoomMin: 0.08,
        zoomMax: 4
    };

    // ── State ────────────────────────────────────────────────────────────────
    var svg = null;
    var rootG = null;
    var simulation = null;
    var graphData = null;
    var selectedNode = null;
    var width = 0;
    var height = 0;
    var container = null;
    var nodeSelectedCallback = null;
    var nodeDblClickCallback = null;

    // ── Initialization ───────────────────────────────────────────────────────
    function init(containerSelector, opts) {
        container = d3.select(containerSelector);
        if (opts) {
            if (opts.onNodeSelected) nodeSelectedCallback = opts.onNodeSelected;
            if (opts.onNodeDblClick) nodeDblClickCallback = opts.onNodeDblClick;
        }

        width = container.node().offsetWidth || window.innerWidth;
        height = container.node().offsetHeight || window.innerHeight;

        svg = container.append('svg')
            .attr('id', 'graph-svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('display', 'block')
            .style('background', CFG.bgColor);

        defs = svg.append('defs');
        buildDefs();

        rootG = svg.append('g').attr('class', 'root-group');

        setupZoom();
        showEmptyState();
        return svg;
    }

    // ── Defs (arrow markers + filters) ──────────────────────────────────────
    var defs = null;

    function buildDefs() {
        var arrowSize = 7;

        // Forward arrow (for marker-end): triangle pointing right
        defs.append('marker')
            .attr('id', 'arrow-default')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 10)
            .attr('refY', 5)
            .attr('markerWidth', arrowSize)
            .attr('markerHeight', arrowSize)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M 0 0 L 10 5 L 0 10 Z')
            .attr('fill', CFG.arrowDefault);

        // Reversed arrow (for marker-start on bidirectional): triangle pointing left
        defs.append('marker')
            .attr('id', 'arrow-reversed')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 0)
            .attr('refY', 5)
            .attr('markerWidth', arrowSize)
            .attr('markerHeight', arrowSize)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M 10 0 L 0 5 L 10 10 Z')
            .attr('fill', CFG.arrowDefault);

        // Drop shadow filter
        var filter = defs.append('filter')
            .attr('id', 'drop-shadow')
            .attr('x', '-50%').attr('y', '-50%')
            .attr('width', '200%').attr('height', '200%');
        filter.append('feDropShadow')
            .attr('dx', 0).attr('dy', 1)
            .attr('stdDeviation', 2)
            .attr('flood-color', '#000')
            .attr('flood-opacity', 0.4);
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────
    function setupZoom() {
        var zoom = d3.zoom()
            .scaleExtent([CFG.zoomMin, CFG.zoomMax])
            .on('zoom', function (event) {
                rootG.attr('transform', event.transform);
            });

        svg.call(zoom);
        svg.on('dblclick.zoom', null);
    }

    // ── Empty State ──────────────────────────────────────────────────────────
    function showEmptyState() {
        clearGraph();

        var eg = rootG.append('g').attr('class', 'empty-group');

        eg.append('text')
            .attr('class', 'empty-icon')
            .attr('x', width / 2)
            .attr('y', height / 2 - 48)
            .attr('text-anchor', 'middle')
            .attr('font-size', '96px')
            .text('\u2708');

        eg.append('text')
            .attr('class', 'empty-title')
            .attr('x', width / 2)
            .attr('y', height / 2 + 28)
            .text('Carga un archivo JSON para visualizar la red aérea');

        eg.append('text')
            .attr('class', 'empty-sub')
            .attr('x', width / 2)
            .attr('y', height / 2 + 60)
            .text('Usa el botón "Cargar JSON" en la esquina superior izquierda');
    }

    function clearGraph() {
        rootG.selectAll('*').remove();
    }

    // ── Main Render ──────────────────────────────────────────────────────────
    function loadGraph(json) {
        graphData = transformGraphData(json);
        if (graphData.nodes.length === 0) {
            showEmptyState();
            return;
        }

        clearGraph();
        selectedNode = null;

        width = container.node().offsetWidth || window.innerWidth;
        height = container.node().offsetHeight || window.innerHeight;

        // Create simulation (uses original links for force physics)
        simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links)
                .id(function (d) { return d.id; })
                .distance(function (d) {
                    return CFG.linkDistanceBase + d.distanciaKm * CFG.linkDistanceFactor;
                })
            )
            .force('charge', d3.forceManyBody().strength(CFG.forceStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide()
                .radius(function (d) {
                    return (d.esHub ? CFG.hubRadius : CFG.secondaryRadius) + CFG.collisionPad;
                })
            )
            .alphaDecay(0.02)
            .velocityDecay(0.4);

        // Resolve visualEdges source/target from strings to node objects
        var nodeById = new Map();
        graphData.nodes.forEach(function (n) { nodeById.set(n.id, n); });
        graphData.visualEdges.forEach(function (e) {
            e.source = nodeById.get(e.source) || e.source;
            e.target = nodeById.get(e.target) || e.target;
        });

        // Render layers (uses visualEdges for drawing)
        renderLinks();
        renderEdgeLabels();
        renderNodes();

        simulation.on('tick', tickHandler);

        simulation.on('end', function () {
            simulation.stop();
        });
    }

    // ── Offset a point by radius toward the other node ──────────────────────
    function offsetPoint(from, to, radius) {
        var dx = to.x - from.x;
        var dy = to.y - from.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
            x: from.x + (dx / dist) * radius,
            y: from.y + (dy / dist) * radius
        };
    }

    // ── Tick Handler ─────────────────────────────────────────────────────────
    function tickHandler() {
        rootG.selectAll('.links-group line')
            .attr('x1', function (d) {
                var r = d.source.esHub ? CFG.hubRadius : CFG.secondaryRadius;
                return offsetPoint(d.source, d.target, r).x;
            })
            .attr('y1', function (d) {
                var r = d.source.esHub ? CFG.hubRadius : CFG.secondaryRadius;
                return offsetPoint(d.source, d.target, r).y;
            })
            .attr('x2', function (d) {
                var r = d.target.esHub ? CFG.hubRadius : CFG.secondaryRadius;
                return offsetPoint(d.target, d.source, r).x;
            })
            .attr('y2', function (d) {
                var r = d.target.esHub ? CFG.hubRadius : CFG.secondaryRadius;
                return offsetPoint(d.target, d.source, r).y;
            });

        rootG.selectAll('.node-group')
            .attr('transform', function (d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            });

        rootG.selectAll('.edge-label-group')
            .attr('transform', function (d) {
                var mx = (d.source.x + d.target.x) / 2;
                var my = (d.source.y + d.target.y) / 2;
                return 'translate(' + mx + ',' + my + ')';
            });
    }

    // ── Render Links (uses visualEdges) ─────────────────────────────────────
    function renderLinks() {
        var linksGroup = rootG.append('g').attr('class', 'links-group');

        linksGroup.selectAll('line')
            .data(graphData.visualEdges)
            .join('line')
            .attr('class', function (d) {
                var cls = 'link-line';
                if (d.costoBase === 0) cls += ' subsidized';
                if (d.bidirectional) cls += ' bidirectional';
                return cls;
            })
            .attr('marker-end', 'url(#arrow-default)')
            .attr('marker-start', function (d) {
                return d.bidirectional ? 'url(#arrow-reversed)' : null;
            });

        linksGroup.selectAll('line')
            .on('click', function (event) {
                event.stopPropagation();
            });
    }

    // ── Render Edge Labels (uses visualEdges) ───────────────────────────────
    function renderEdgeLabels() {
        var labelSel = rootG.append('g').attr('class', 'edge-labels-group')
            .selectAll('g')
            .data(graphData.visualEdges)
            .join('g')
            .attr('class', 'edge-label-group');

        labelSel.append('rect')
            .attr('class', 'edge-label-bg')
            .attr('x', -22)
            .attr('y', -8)
            .attr('width', 44)
            .attr('height', 14)
            .attr('rx', 7);

        labelSel.append('text')
            .attr('class', 'edge-label')
            .attr('y', 0)
            .text(function (d) { return d.distanciaKm + ' km'; });

        labelSel.append('text')
            .attr('class', 'edge-label edge-aircraft')
            .attr('y', 14)
            .text(function (d) {
                return d.aeronaves.length > 0 ? d.aeronaves.join(' \u00b7 ') : '';
            });
    }

    // ── Render Nodes ─────────────────────────────────────────────────────────
    function renderNodes() {
        var nodeSel = rootG.append('g').attr('class', 'nodes-group')
            .selectAll('g')
            .data(graphData.nodes)
            .join('g')
            .attr('class', 'node-group');

        nodeSel.append('circle')
            .attr('class', 'node-circle')
            .attr('r', function (d) { return d.esHub ? CFG.hubRadius : CFG.secondaryRadius; })
            .attr('fill', function (d) { return d.esHub ? CFG.hubColor : CFG.secondaryColor; })
            .attr('stroke', function (d) {
                return d.esHub ? lightenColor(CFG.hubColor, 0.2) : lightenColor(CFG.secondaryColor, 0.2);
            });

        nodeSel.append('text')
            .attr('class', 'node-label')
            .attr('font-size', function (d) { return d.esHub ? '14px' : '12px'; })
            .text(function (d) { return d.id; });

        nodeSel.call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded)
        );

        nodeSel.on('click', function (event, d) {
            event.stopPropagation();
            selectNode(d);
        });

        nodeSel.on('dblclick', function (event, d) {
            event.stopPropagation();
            event.preventDefault();
            if (nodeDblClickCallback) nodeDblClickCallback(d);
        });

        nodeSel.on('mouseenter', function (event, d) {
            showTooltip(d, event.clientX, event.clientY);
        });
        nodeSel.on('mousemove', function (event) {
            var tooltip = document.getElementById('tooltip');
            if (tooltip && tooltip.style.display === 'block') {
                tooltip.style.left = (event.clientX + 15) + 'px';
                tooltip.style.top = (event.clientY + 15) + 'px';
            }
        });
        nodeSel.on('mouseleave', function () {
            hideTooltip();
        });
    }

    // ── Drag Handlers ────────────────────────────────────────────────────────
    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = event.x;
        d.fy = event.y;
    }

    // ── Selection ────────────────────────────────────────────────────────────
    function selectNode(d) {
        selectedNode = d;
        updateHighlighting();
        if (nodeSelectedCallback) nodeSelectedCallback(d);
    }

    function deselectNode() {
        selectedNode = null;
        updateHighlighting();
    }

    function updateHighlighting() {
        if (!graphData) return;

        var nodesG = rootG.select('.nodes-group');
        var linksG = rootG.select('.links-group');
        var labelsG = rootG.select('.edge-labels-group');

        if (!selectedNode) {
            nodesG.selectAll('.node-group').classed('dimmed', false);
            linksG.selectAll('line').classed('dimmed', false)
                .classed('outgoing', false).classed('incoming', false);
            labelsG.selectAll('.edge-label-group').classed('dimmed', false);
            return;
        }

        var selId = selectedNode.id;

        nodesG.selectAll('.node-group')
            .classed('dimmed', function (d) {
                if (d.id === selId) return false;
                var adj = graphData.adjacencyMap.get(selId);
                return adj ? !adj.has(d.id) : true;
            });

        linksG.selectAll('line')
            .classed('dimmed', function (d) {
                return d.source.id !== selId && d.target.id !== selId;
            })
            .classed('outgoing', function (d) {
                if (d.bidirectional) return d.source.id === selId || d.target.id === selId;
                return d.source.id === selId;
            })
            .classed('incoming', function (d) {
                if (d.bidirectional) return false;
                return d.target.id === selId;
            });

        labelsG.selectAll('.edge-label-group')
            .classed('dimmed', function (d) {
                return d.source.id !== selId && d.target.id !== selId;
            });
    }

    // ── Tooltip ──────────────────────────────────────────────────────────────
    function showTooltip(d, mx, my) {
        var tooltip = document.getElementById('tooltip');
        if (!tooltip) return;

        tooltip.querySelector('.iata').textContent = d.id;
        tooltip.querySelector('.city').textContent = d.ciudad + ', ' + d.pais;
        tooltip.style.display = 'block';
        tooltip.style.left = (mx + 15) + 'px';
        tooltip.style.top = (my + 15) + 'px';
    }

    function hideTooltip() {
        var tooltip = document.getElementById('tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    // ── Public API ──────────────────────────────────────────────────────────
    function getSelectedNode() {
        return selectedNode;
    }

    function getGraphData() {
        return graphData;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function lightenColor(hex, amount) {
        hex = hex.replace('#', '');
        var r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 255 * amount);
        var g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 255 * amount);
        var b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 255 * amount);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    // ── Expose API ──────────────────────────────────────────────────────────
    return {
        init: init,
        loadGraph: loadGraph,
        deselectNode: deselectNode,
        selectNode: selectNode,
        getSelectedNode: getSelectedNode,
        getGraphData: getGraphData,
        showEmptyState: showEmptyState,
        width: function () { return width; },
        height: function () { return height; }
    };
})();
