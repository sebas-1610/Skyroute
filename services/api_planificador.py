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
from core.errors import (
    SkyRouteError,
    ValidationError,
    RouteNotFoundError,
    BudgetExceededError,
    InternalError,
)

api_planificador_bp = Blueprint("api_planificador", __name__, url_prefix="/api")


@api_planificador_bp.route("/planificar", methods=["POST"])
def planificar_ruta():
    """
    Calculate optimal route maximizing destinations within budget or time.

    Expected JSON body:
    {
        "origen": "BOG",
        "destino": "LIM",
        "modo": "budget" | "time",
        "presupuesto": 500,  // required if modo == "budget" (USD)
        "tiempo": 24,        // required if modo == "time"   (hours)
        "airports": [...],
        "routes": [...],
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
        400: {"success": false, "message": "...", "code": "VAL001", "type": "ValidationError"}
        404: {"success": false, "message": "...", "code": "ROUTE001", "type": "RouteNotFoundError"}
        500: {"success": false, "message": "...", "code": "SRV001", "type": "InternalError"}
    """
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")

        data = request.get_json()
        if not data:
            raise ValidationError("Invalid JSON body")

        origen = data.get("origen")
        destino = data.get("destino")
        modo = data.get("modo", "budget")
        presupuesto = data.get("presupuesto")
        tiempo = data.get("tiempo")
        airports = data.get("airports", [])
        routes = data.get("routes", [])
        configuracion = data.get("configuracion")

        _validate_request(origen, destino, presupuesto, airports, routes, modo, tiempo)

        limite = presupuesto if modo == "budget" else tiempo
        result = find_max_destinations_by_budget(
            airports=airports,
            routes=routes,
            origen=origen,
            destino=destino,
            presupuesto=limite,
            modo=modo,
            configuracion=configuracion,
        )
        return jsonify(result), 200

    except SkyRouteError as e:
        return jsonify(e.to_dict()), e.status_code
    except Exception as e:
        err = InternalError("Error interno en el cálculo de ruta.", original_error=e)
        return jsonify(err.to_dict()), err.status_code


def _validate_request(
    origen: str | None,
    destino: str | None,
    presupuesto: float | None,
    airports: list,
    routes: list,
    modo: str,
    tiempo: float | None,
) -> None:
    """
    Validate required fields in the request. Raises exceptions if validation fails.

    Raises:
        ValidationError: If any required field is missing or invalid
    """
    if not origen:
        raise ValidationError("Missing required field: origen")

    if not isinstance(origen, str):
        raise ValidationError("Field 'origen' must be a string")

    if not destino:
        raise ValidationError("Missing required field: destino")

    if not isinstance(destino, str):
        raise ValidationError("Field 'destino' must be a string")

    if origen == destino:
        raise ValidationError(
            "Fields 'origen' and 'destino' must be different airports"
        )

    if modo == "budget":
        if not presupuesto:
            raise ValidationError("Missing required field: presupuesto")
        if not isinstance(presupuesto, (int, float)) or presupuesto < 0:
            raise ValidationError("Field 'presupuesto' must be a non-negative number")
    elif modo == "time":
        if not tiempo:
            raise ValidationError("Missing required field: tiempo")
        if not isinstance(tiempo, (int, float)) or tiempo <= 0:
            raise ValidationError("Field 'tiempo' must be a positive number")

    if not airports:
        raise ValidationError("Missing required field: airports (empty list)")

    if not routes:
        raise ValidationError("Missing required field: routes (empty list)")
