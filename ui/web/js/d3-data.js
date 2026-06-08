/**
 * SkyRoute D3 — Data Transformation
 * Converts the JSON format (nodos/aristas) into D3's standard { nodes, links } format.
 * Also builds visualEdges: one visual edge per pair (merges bidirectional duplicates).
 */

function transformGraphData(json) {
    var rawNodes = json.nodos || json.aeropuertos || [];
    var rawLinks = json.aristas || json.rutas || [];

    var nodeIndex = new Map();
    var adjacencyMap = new Map();

    var nodes = rawNodes.map(function (n) {
        return {
            id: n.id,
            nombre: n.nombre || '',
            ciudad: n.ciudad || '',
            pais: n.pais || '',
            zonaHoraria: n.zonaHoraria || '',
            esHub: !!n.esHub,
            costoAlojamiento: n.costoAlojamiento || 0,
            costoAlimentacion: n.costoAlimentacion || 0,
            actividades: n.actividades || [],
            trabajos: n.trabajos || [],
            aerolineas: n.aerolineas || []
        };
    });

    var links = rawLinks.map(function (l) {
        return {
            source: l.origen,
            target: l.destino,
            distanciaKm: l.distanciaKm || 0,
            aeronaves: l.aeronaves || [],
            costoBase: l.costoBase || 0,
            estanciaMinima: l.estanciaMinima || 0,
            bloqueada: l.bloqueada === true,
            motivoBloqueo: l.motivoBloqueo || null,
            isBidirectional: false
        };
    });

    nodes.forEach(function (n) {
        nodeIndex.set(n.id, n);
        adjacencyMap.set(n.id, new Set());
    });

    links.forEach(function (l) {
        if (adjacencyMap.has(l.source)) adjacencyMap.get(l.source).add(l.target);
        if (adjacencyMap.has(l.target)) adjacencyMap.get(l.target).add(l.source);
    });

    links.forEach(function (l) {
        l.isBidirectional = links.some(function (o) {
            return o !== l && o.source === l.target && o.target === l.source;
        });
    });

    return {
        nodes: nodes,
        links: links,
        nodeIndex: nodeIndex,
        adjacencyMap: adjacencyMap,
        visualEdges: buildVisualEdges(links)
    };
}

/**
 * Groups links by node pair (A,B) where A < B alphabetically.
 * Bidirectional pairs (A→B AND B→A) become ONE visual edge.
 * Unidirectional links become ONE visual edge each.
 */
function buildVisualEdges(links) {
    var pairMap = new Map();

    links.forEach(function (l) {
        var s = typeof l.source === 'object' ? l.source.id : l.source;
        var t = typeof l.target === 'object' ? l.target.id : l.target;

        var key = s < t ? s + '|' + t : t + '|' + s;
        var forward = s < t;

        if (!pairMap.has(key)) {
            pairMap.set(key, {
                source: s < t ? s : t,
                target: s < t ? t : s,
                hasForward: false,
                hasReverse: false,
                blockedForward: false,
                blockedReverse: false,
                blockedRoutes: [],
                data: l
            });
        }

        var pair = pairMap.get(key);

        if (forward) {
            pair.hasForward = true;

            if (l.bloqueada === true) {
                pair.blockedForward = true;
            }
        } else {
            pair.hasReverse = true;

            if (l.bloqueada === true) {
                pair.blockedReverse = true;
            }
        }

        if (l.bloqueada === true) {
            pair.blockedRoutes.push({
                origen: s,
                destino: t,
                motivoBloqueo: l.motivoBloqueo || 'Ruta bloqueada'
            });
        }
    });

    var visualEdges = [];
    pairMap.forEach(function (pair) {
        visualEdges.push({
            source: pair.source,
            target: pair.target,
            bidirectional: pair.hasForward && pair.hasReverse,
            distanciaKm: pair.data.distanciaKm,
            aeronaves: pair.data.aeronaves,
            costoBase: pair.data.costoBase,
            estanciaMinima: pair.data.estanciaMinima,
            bloqueada: pair.blockedForward || pair.blockedReverse,
            blockedForward: pair.blockedForward,
            blockedReverse: pair.blockedReverse,
            blockedRoutes: pair.blockedRoutes
        });
    });

    return visualEdges;
}
