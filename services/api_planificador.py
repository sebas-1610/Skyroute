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
import json
from werkzeug.exceptions import BadRequest
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

        # Parse JSON robustly: try Flask's parser first, then fallback to
        # attempting different decodings if the client used a non-UTF-8
        # encoding (PowerShell's ConvertTo-Json can produce Latin1 bytes).
        try:
            data = request.get_json()
        except BadRequest:
            # Try to decode raw bytes with latin-1 as a fallback
            raw = request.get_data()
            try:
                text = raw.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    text = raw.decode('latin-1')
                except Exception:
                    raise ValidationError("Failed to decode request body as JSON (unknown encoding)")
            try:
                data = json.loads(text)
            except Exception:
                raise ValidationError("Invalid JSON body (fallback decode failed)")

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

        # Nuevos campos (contrato extendido)
        criterios = data.get("criterios") or []  # list of 'distancia'|'tiempo'|'costo'
        incluir_secundarios = data.get("incluir_secundarios", data.get("incluirSecundarios", True))
        transportes = data.get("transportes", None)  # list of aircraft types to prefer

        # Backwards-compatible validation: if no criterios specified, use legacy modo
        if criterios:
            # Validate criterios
            allowed = {"distancia", "tiempo", "costo"}
            if not isinstance(criterios, list) or any(c not in allowed for c in criterios):
                raise ValidationError("Field 'criterios' must be a list with any of: distancia, tiempo, costo")
            # Ensure airports and routes provided
            _validate_request(origen, destino, presupuesto, airports, routes, modo, tiempo, skip_mode_check=True)

            results = {}
            for criterio in criterios:
                try:
                    if criterio == "costo":
                        call_modo = "budget"
                        limite = presupuesto
                    elif criterio == "tiempo":
                        call_modo = "time"
                        limite = tiempo
                    else:  # distancia
                        # Map distancia to budget-mode where costoKm == 1, so cost == distance
                        call_modo = "budget"
                        limite = data.get("distancia-max") or presupuesto

                    # Merge configuracion overrides for this run
                    run_config = dict(configuracion or {})
                    # If transportes filter is provided, include it in configuracion for downstream use
                    if transportes is not None:
                        run_config.setdefault("transportes_preferidos", transportes)
                    # Include flag for secundary airports filtering
                    run_config.setdefault("incluir_secundarios", incluir_secundarios)

                    # For distancia, coerce aeronave cost to 1 so peso == distanciaKm
                    if criterio == "distancia":
                        # Build a shallow aeronaves override mapping where costoKm = 1 for known types
                        aeronaves_override = {}
                        base_aeronaves = (run_config.get("aeronaves") or {
                            "Avión Comercial": {"costoKm": 0.18, "tiempoKm": 0.7},
                            "Avión Regional": {"costoKm": 0.25, "tiempoKm": 1.1},
                            "Hélice": {"costoKm": 0.12, "tiempoKm": 2.5},
                        })
                        for name in base_aeronaves:
                            aeronaves_override[name] = {"costoKm": 1.0, "tiempoKm": base_aeronaves[name].get("tiempoKm", 1.0)}
                        run_config = dict(run_config)
                        run_config["aeronaves"] = aeronaves_override

                    # Call algorithm — limit unit depends on mode (USD or hours)
                    limite_param = limite if call_modo == "budget" else limite
                    # DEBUG: log inputs to help trace mismatches when called via API
                    print(f"[DEBUG planificar] criterio={criterio} call_modo={call_modo} limite={limite_param}")
                    print(f"[DEBUG planificar] airports={len(airports)} routes={len(routes)} transportes_preferidos={transportes}")
                    res = find_max_destinations_by_budget(
                        airports=airports,
                        routes=routes,
                        origen=origen,
                        destino=destino,
                        presupuesto=limite_param,
                        modo=call_modo,
                        configuracion=run_config,
                    )
                    results[criterio] = res
                except SkyRouteError as e:
                    results[criterio] = {"success": False, "error": e.to_dict()}
                except Exception as e:
                    err = InternalError("Error interno en el cálculo de ruta.", original_error=e)
                    results[criterio] = {"success": False, "error": err.to_dict()}

            return jsonify({"success": True, "results": results}), 200

        # Legacy single-criterion path (compatibilidad)
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
    skip_mode_check: bool = False,
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

    if not skip_mode_check:
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
