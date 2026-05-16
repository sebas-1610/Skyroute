"""
Flask Blueprint for SkyRoute Planner API.

Provides REST endpoints for route planning using the DFS Cobertura algorithm.
All endpoints return JSON responses and follow REST conventions.

SOLID Principles:
- ISP: Only exposes /planificar endpoint, no unnecessary methods
- DIP: Depends on algorithm function, not concrete class
- SRP: Only handles HTTP request/response, delegates algorithm logic
"""

from flask import Blueprint, request, jsonify
from core.algorithms.dfs_cobertura import find_max_destinations_by_budget

api_planificador_bp = Blueprint("api_planificador", __name__, url_prefix="/api")


@api_planificador_bp.route("/planificar", methods=["POST"])
def planificar_ruta():
    """
    Calculate optimal route maximizing destinations within budget.

    Expected JSON body:
    {
        "origen": "BOG",
        "presupuesto": 500,
        "aeropuertos": [...],
        "rutas": [...],
        "configuracion": {...}  // optional
    }

    Returns:
        200: {
            "success": true,
            "path": ["BOG", "MDE", "LIM"],
            "segments": [...],
            "total_costo": 350.00,
            "destinos_visitados": 3
        }
        400: {"success": false, "error": "Missing required field: origen"}
        500: {"success": false, "error": "Internal error message"}
    """
    if not request.is_json:
        return (
            jsonify(
                {"success": False, "error": "Content-Type must be application/json"}
            ),
            400,
        )

    try:
        data = request.get_json()
    except Exception:
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    origen = data.get("origen")
    destino = data.get("destino")
    presupuesto = data.get("presupuesto")
    airports = data.get("aeropuertos", [])
    routes = data.get("rutas", [])
    configuracion = data.get("configuracion")

    validation_error = _validate_request(origen, destino, presupuesto, airports, routes)
    if validation_error:
        return jsonify({"success": False, "error": validation_error}), 400

    try:
        result = find_max_destinations_by_budget(
            airports=airports,
            routes=routes,
            origen=origen,
            destino=destino,
            presupuesto=presupuesto,
            configuracion=configuracion,
        )
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"success": False, "error": f"Internal error: {str(e)}"}), 500


def _validate_request(
    origen: str | None,
    destino: str | None,
    presupuesto: float | None,
    airports: list,
    routes: list,
) -> str | None:
    """
    Validate required fields in the request.

    Returns:
        Error message string if validation fails, None if valid.
    """
    if not origen:
        return "Missing required field: origen"

    if not isinstance(origen, str):
        return "Field 'origen' must be a string"

    if not destino:
        return "Missing required field: destino"

    if not isinstance(destino, str):
        return "Field 'destino' must be a string"

    if origen == destino:
        return "Fields 'origen' and 'destino' must be different airports"

    if presupuesto is None:
        return "Missing required field: presupuesto"

    if presupuesto is not None and (
        not isinstance(presupuesto, (int, float)) or presupuesto < 0
    ):
        return "Field 'presupuesto' must be a non-negative number"

    if not airports:
        return "Missing required field: airports (empty list)"

    if not routes:
        return "Missing required field: routes (empty list)"

    return None
