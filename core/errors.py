"""
Error Handler - Manejo centralizado de errores para SkyRoute Backend

Este módulo proporciona una jerarquía de excepciones personalizadas para
manejar errores específicos del dominio de SkyRoute de manera consistente.

Tipos de Error:
- ValidationError: Validación de datos de entrada
- RouteNotFoundError: No existe ruta entre aeropuertos
- BudgetExceededError: Presupuesto o tiempo insuficiente
- InternalError: Error interno del servidor

SOLID Principles:
- SRP: Cada clase maneja un tipo de error específico
- OCP: Fácil extender con nuevos tipos de errores
- LSP: Todas heredan de SkyRouteError y responden igual

@example
    try:
        raise ValidationError("Campo requerido: origen")
    except SkyRouteError as e:
        return jsonify(e.to_dict()), e.status_code

@example
    if not existe_ruta(origen, destino):
        raise RouteNotFoundError(origen, destino)
"""


class SkyRouteError(Exception):
    """
    Excepción base para todos los errores de SkyRoute.

    Proporciona una estructura estándar con:
    - message: Mensaje descriptivo del error
    - code: Código único para identificar el error
    - status_code: Código HTTP apropiado
    """

    def __init__(self, message: str, code: str = None, status_code: int = 500):
        """
        Inicializa una excepción de SkyRoute.

        Args:
            message (str): Mensaje descriptivo del error
            code (str): Código único del error (ej: VAL001)
            status_code (int): Código HTTP de la respuesta
        """
        self.message = message
        self.code = code or self.__class__.__name__
        self.status_code = status_code
        super().__init__(self.message)

    def to_dict(self) -> dict:
        """
        Convierte el error a diccionario para respuesta JSON.

        Returns:
            dict: Diccionario con success=False y detalles del error
        """
        return {
            "success": False,
            "message": self.message,
            "code": self.code,
            "type": self.__class__.__name__,
        }

    def __str__(self) -> str:
        """Representación en string del error."""
        return f"[{self.code}] {self.message}"

    def __repr__(self) -> str:
        """Representación técnica del error."""
        return (
            f"{self.__class__.__name__}(message='{self.message}', code='{self.code}')"
        )


class ValidationError(SkyRouteError):
    """
    Error en validación de datos de entrada.

    Usado cuando:
    - Falta un campo requerido
    - Un campo tiene tipo inválido
    - Un valor está fuera de rango

    @example
        if not origen:
            raise ValidationError("Campo requerido: origen")
    """

    def __init__(self, message: str):
        """
        Inicializa un error de validación.

        Args:
            message (str): Descripción del campo o validación que falló
        """
        super().__init__(message, code="VAL001", status_code=400)


class RouteNotFoundError(SkyRouteError):
    """
    No existe ruta entre los aeropuertos especificados.

    Usado cuando:
    - Los aeropuertos no están conectados en la red
    - No hay camino válido entre origen y destino

    @example
        if not graph[origen]:
            raise RouteNotFoundError("BOG", "LIM")
    """

    def __init__(self, origen: str, destino: str):
        """
        Inicializa un error de ruta no encontrada.

        Args:
            origen (str): Código IATA del aeropuerto de origen
            destino (str): Código IATA del aeropuerto de destino
        """
        message = f"No existe ruta entre {origen} y {destino}."
        super().__init__(message, code="ROUTE001", status_code=404)


class BudgetExceededError(SkyRouteError):
    """
    Presupuesto o tiempo insuficiente para alcanzar el destino.

    Usado cuando:
    - El presupuesto no alcanza para ninguna ruta válida
    - El tiempo disponible es insuficiente

    @example
        if not encontro_ruta_en_presupuesto:
            raise BudgetExceededError(modo="budget")
    """

    def __init__(self, modo: str = "budget"):
        """
        Inicializa un error de presupuesto/tiempo excedido.

        Args:
            modo (str): "budget" para presupuesto, "time" para tiempo
        """
        if modo == "budget":
            message = "Tranquilo, yo tambien soy latinoamericano."
            code = "BUDGET001"
        else:
            message = "El tiempo no es suficiente para esta ruta."
            code = "TIME001"

        super().__init__(message, code=code, status_code=400)


class InternalError(SkyRouteError):
    """
    Error interno inesperado del servidor.

    Usado para:
    - Excepciones no capturadas
    - Errores de lógica interna
    - Fallos en algoritmos

    @example
        try:
            resultado = algoritmo_dfs(graph)
        except Exception as e:
            raise InternalError("Error en cálculo de ruta", original_error=e)
    """

    def __init__(self, message: str, original_error: Exception = None):
        """
        Inicializa un error interno.

        Args:
            message (str): Descripción del error
            original_error (Exception): Excepción original que lo causó
        """
        if original_error:
            details = f"{message} | Original: {str(original_error)}"
        else:
            details = message

        super().__init__(details, code="SRV001", status_code=500)
