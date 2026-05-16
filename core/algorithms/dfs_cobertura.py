"""
DFS Cobertura algorithm for SkyRoute planner.

Finds the route from `origen` to `destino` that visits the maximum number
of intermediate airports without exceeding the budget.

Algorithm:
- DFS with backtracking explores all paths from origen.
- A path is only recorded as a candidate when it reaches `destino`.
- Among all valid paths that reach `destino` within budget, the one
  with the most stops wins; cost breaks ties.
- Pruning: budget exceeded → backtrack immediately.
          node already visited → skip (no cycles).

Time complexity: O(V!) worst case, pruning reduces this significantly.

SOLID Principles:
- SRP: Only computes the optimal route, nothing else.
- OCP: Extendable without modifying the API layer.
- LSP: Returns a consistent dict structure compatible with callers.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Segmento:
    """Represents a single flight segment in the route."""

    origen: str
    destino: str
    aeronave: str
    distancia: float
    costo: float
    costo_acumulado: float


@dataclass
class ResultadoDFS:
    """Value object containing the algorithm execution results."""

    success: bool
    path: list[str] = field(default_factory=list)
    segments: list[Segmento] = field(default_factory=list)
    total_costo: float = 0.0
    destinos_visitados: int = 0
    message: str = ""


def find_max_destinations_by_budget(
    airports: list[dict[str, Any]],
    routes: list[dict[str, Any]],
    origen: str,
    destino: str,
    presupuesto: float,
    configuracion: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Find the route from `origen` to `destino` that visits the maximum number
    of intermediate airports without exceeding the budget.

    Args:
        airports:      List of airport dicts with at least an 'id' field.
        routes:        List of route dicts with origen, destino, distanciaKm,
                       aeronaves, costoBase.
        origen:        Departure airport code.
        destino:       Required final airport code.
        presupuesto:   Maximum total cost in USD.
        configuracion: Optional dict with aircraft cost/time data.

    Returns:
        Dict with keys: success, path, segments, total_costo,
        destinos_visitados, and optionally message.
    """
    if configuracion is None:
        configuracion = {}

    aircraft_types = configuracion.get(
        "aeronaves",
        {
            "Avión Comercial": {"costoKm": 0.18, "tiempoKm": 0.7},
            "Avión Regional": {"costoKm": 0.25, "tiempoKm": 1.1},
            "Hélice": {"costoKm": 0.12, "tiempoKm": 2.5},
        },
    )

    airport_ids = {a["id"] for a in airports}

    if origen not in airport_ids:
        return {
            "success": False,
            "message": f"Aeropuerto de origen '{origen}' no encontrado.",
        }
    if destino not in airport_ids:
        return {
            "success": False,
            "message": f"Aeropuerto de destino '{destino}' no encontrado.",
        }
    if origen == destino:
        return {
            "success": False,
            "message": "El origen y el destino no pueden ser el mismo.",
        }

    graph = _build_adjacency_graph(routes, aircraft_types)

    # best_result tracks the winning path so far.
    # A path is only valid when it ends exactly at `destino`.
    best_result: dict[str, Any] = {
        "path": [],
        "segments": [],
        "total_costo": float("inf"),
        "destinos_visitados": -1,  # -1 means no valid path found yet
    }

    _dfs_search(
        graph=graph,
        current=origen,
        destino=destino,
        current_path=[origen],
        current_segments=[],
        current_cost=0.0,
        presupuesto=presupuesto,
        visited={origen},
        best_result=best_result,
    )

    if best_result["destinos_visitados"] < 0:
        return {
            "success": False,
            "message": (
                f"No se encontró una ruta de {origen} a {destino} "
                "dentro del presupuesto indicado."
            ),
        }

    return {
        "success": True,
        "path": best_result["path"],
        "segments": [
            {
                "origen": s.origen,
                "destino": s.destino,
                "aeronave": s.aeronave,
                "distancia": s.distancia,
                "costo": round(s.costo, 2),
                "costo_acumulado": round(s.costo_acumulado, 2),
            }
            for s in best_result["segments"]
        ],
        "total_costo": round(best_result["total_costo"], 2),
        "destinos_visitados": best_result["destinos_visitados"],
    }


# ── Internal helpers ──────────────────────────────────────────────────────────


def _build_adjacency_graph(
    routes: list[dict[str, Any]],
    aircraft_types: dict[str, dict[str, float]],
) -> dict[str, list[dict[str, Any]]]:
    """Build an adjacency-list representation of the route network."""
    graph: dict[str, list[dict[str, Any]]] = {}

    for route in routes:
        src = route["origen"]
        dst = route["destino"]
        distancia = route.get("distanciaKm", 0)
        aeronaves = route.get("aeronaves", ["Avión Comercial"])
        costo_base = route.get("costoBase", 0)

        if src not in graph:
            graph[src] = []

        best_aircraft = aeronaves[0]
        aircraft_data = aircraft_types.get(best_aircraft, {"costoKm": 0.18})
        costo_tramo = 0.0 if costo_base == 0 else distancia * aircraft_data["costoKm"]

        graph[src].append(
            {
                "destino": dst,
                "distancia": distancia,
                "costo": costo_tramo,
                "aeronave": best_aircraft,
            }
        )

    return graph


def _dfs_search(
    graph: dict[str, list[dict[str, Any]]],
    current: str,
    destino: str,
    current_path: list[str],
    current_segments: list[Segmento],
    current_cost: float,
    presupuesto: float,
    visited: set[str],
    best_result: dict[str, Any],
) -> None:
    """
    Recursive DFS with backtracking.

    A candidate solution is recorded only when `current` == `destino`.
    The search does NOT continue past the destination node.
    """
    # ── Reached the destination: evaluate this path ───────────────────────────
    if current == destino:
        # destinos_visitados = number of stops excluding the origin
        stops = len(current_path) - 1  # includes destino itself

        if stops > best_result["destinos_visitados"]:
            _save_best(best_result, current_path, current_segments, current_cost, stops)
        elif (
            stops == best_result["destinos_visitados"]
            and current_cost < best_result["total_costo"]
        ):
            _save_best(best_result, current_path, current_segments, current_cost, stops)

        # Do not explore beyond the destination.
        return

    # ── Continue exploring neighbors ──────────────────────────────────────────
    for edge in graph.get(current, []):
        neighbor = edge["destino"]

        if neighbor in visited:
            continue

        new_cost = current_cost + edge["costo"]
        if new_cost > presupuesto:
            continue  # Prune: over budget

        _dfs_search(
            graph=graph,
            current=neighbor,
            destino=destino,
            current_path=current_path + [neighbor],
            current_segments=current_segments
            + [
                Segmento(
                    origen=current,
                    destino=neighbor,
                    aeronave=edge["aeronave"],
                    distancia=edge["distancia"],
                    costo=edge["costo"],
                    costo_acumulado=new_cost,
                )
            ],
            current_cost=new_cost,
            presupuesto=presupuesto,
            visited=visited | {neighbor},
            best_result=best_result,
        )


def _save_best(
    best_result: dict[str, Any],
    path: list[str],
    segments: list[Segmento],
    cost: float,
    stops: int,
) -> None:
    """Overwrite best_result with the current candidate."""
    best_result["path"] = list(path)
    best_result["segments"] = list(segments)
    best_result["total_costo"] = cost
    best_result["destinos_visitados"] = stops
