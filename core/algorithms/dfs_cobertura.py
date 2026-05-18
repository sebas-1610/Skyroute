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

from core.errors import BudgetExceededError, RouteNotFoundError, ValidationError


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
    modo: str = "budget",
) -> dict[str, Any]:
    """
    Find the route from `origen` to `destino` that visits the maximum number
    of intermediate airports without exceeding the given limit.

    Args:
        airports:      List of airport dicts with at least an 'id' field.
        routes:        List of route dicts with origen, destino, distanciaKm,
                       aeronaves, costoBase.
        origen:        Departure airport code.
        destino:       Required final airport code.
        presupuesto:   Maximum total cost in USD (budget mode) or maximum
                       travel time in hours (time mode).
        configuracion: Optional dict with aircraft cost/time data.
        modo:          "budget" uses costoKm as edge weight (USD);
                       "time"   uses tiempoKm as edge weight (minutes).

    Returns:
        Dict with keys: success, path, segments, total_costo,
        destinos_visitados, and optionally message / tiempo_total.
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
        raise ValidationError(f"Aeropuerto de origen '{origen}' no encontrado.")
    if destino not in airport_ids:
        raise ValidationError(f"Aeropuerto de destino '{destino}' no encontrado.")
    if origen == destino:
        raise ValidationError("El origen y el destino no pueden ser el mismo.")

    graph = _build_adjacency_graph(routes, aircraft_types, modo)

    # In time mode the limit arrives in hours; edge weights are in minutes.
    limite = presupuesto * 60 if modo == "time" else presupuesto

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
        presupuesto=limite,
        visited={origen},
        best_result=best_result,
    )

    if best_result["destinos_visitados"] < 0:
        # Reachability check ignoring cost: if a path exists but was pruned
        # by budget, the error is insufficient funds — not missing connectivity.
        if _is_reachable(graph, origen, destino):
            raise BudgetExceededError(modo)
        raise RouteNotFoundError(origen, destino)

    response: dict[str, Any] = {
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

    if modo == "time":
        response["tiempo_total"] = round(best_result["total_costo"] / 60, 2)

    return response


# ── Internal helpers ──────────────────────────────────────────────────────────


def _build_adjacency_graph(
    routes: list[dict[str, Any]],
    aircraft_types: dict[str, dict[str, float]],
    modo: str = "budget",
) -> dict[str, list[dict[str, Any]]]:
    """Build an adjacency-list representation of the route network.

    Edge weight is costoKm-based (USD) for budget mode and
    tiempoKm-based (minutes) for time mode.
    """
    graph: dict[str, list[dict[str, Any]]] = {}
    weight_key = "tiempoKm" if modo == "time" else "costoKm"

    for route in routes:
        src = route["origen"]
        dst = route["destino"]
        distancia = route.get("distanciaKm", 0)
        aeronaves = route.get("aeronaves", ["Avión Comercial"])
        costo_base = route.get("costoBase", 0)

        if src not in graph:
            graph[src] = []

        best_aircraft = aeronaves[0]
        aircraft_data = aircraft_types.get(
            best_aircraft, {"costoKm": 0.18, "tiempoKm": 0.7}
        )

        # Subsidised routes (costoBase == 0) are free in budget mode,
        # but still take time — never skip the time weight.
        if modo == "budget" and costo_base == 0:
            peso_tramo = 0.0
        else:
            peso_tramo = distancia * aircraft_data.get(weight_key, 0.18)

        graph[src].append(
            {
                "destino": dst,
                "distancia": distancia,
                "costo": peso_tramo,
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


def _is_reachable(
    graph: dict[str, list[dict[str, Any]]], origen: str, destino: str
) -> bool:
    """
    BFS reachability check ignoring edge costs.

    Returns True if `destino` is reachable from `origen` in the graph,
    regardless of budget. Used to distinguish RouteNotFoundError
    (no path exists) from BudgetExceededError (path exists but too costly).
    """
    visited: set[str] = {origen}
    queue: list[str] = [origen]

    while queue:
        current = queue.pop(0)
        if current == destino:
            return True
        for edge in graph.get(current, []):
            neighbor = edge["destino"]
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    return False
