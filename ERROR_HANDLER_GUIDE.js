/**
 * Documentación: Error Handler System
 * 
 * Este documento describe cómo usar el sistema centralizado de manejo de errores
 * en SkyRoute Frontend y Backend.
 * 
 * ============================================================================
 * FRONTEND - JavaScript (error-handler.js)
 * ============================================================================
 * 
 * El ErrorHandler proporciona una clase con métodos estáticos para manejar
 * errores de forma consistente en la interfaz.
 * 
 * TIPOS DE ERROR DISPONIBLES:
 * - VALIDATION_ERROR     (VAL001): Validación de entrada
 * - PARSING_ERROR        (PARSE001): Error al parsear JSON
 * - NETWORK_ERROR        (NET001): Error de red
 * - ROUTE_NOT_FOUND      (ROUTE001): Ruta no disponible
 * - BUDGET_INSUFFICIENT  (BUDGET001): Presupuesto insuficiente
 * - TIME_INSUFFICIENT    (TIME001): Tiempo insuficiente
 * - SERVER_ERROR         (SRV001): Error del servidor
 * - FILE_LOAD_ERROR      (FILE001): Error al cargar archivo
 * 
 * 
 * EJEMPLOS DE USO:
 * 
 * 1. Validación simple
 * ──────────────────────────────────────────────────────────────────────────
 * if (!origen) {
 *     ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona un origen válido.', 'planificador.js:60');
 *     return;
 * }
 * 
 * 2. Validación con helpers
 * ──────────────────────────────────────────────────────────────────────────
 * if (!ErrorHandler.validateRequired(origen, 'Aeropuerto de origen')) {
 *     return;
 * }
 * 
 * 3. Validación de números
 * ──────────────────────────────────────────────────────────────────────────
 * if (!ErrorHandler.validateNumber(presupuesto, 'Presupuesto', 0)) {
 *     return;
 * }
 * 
 * 4. Error de parseo JSON
 * ──────────────────────────────────────────────────────────────────────────
 * try {
 *     const json = JSON.parse(text);
 * } catch (err) {
 *     ErrorHandler.handle('PARSING_ERROR', err.message, 'planificador.js:25');
 *     return;
 * }
 * 
 * 5. Error de API (respuesta HTTP)
 * ──────────────────────────────────────────────────────────────────────────
 * const res = await fetch('/api/planificar', { ... });
 * if (!res.ok) {
 *     ErrorHandler.handleApiError(res, 'planificador.js:90');
 *     return;
 * }
 * 
 * 6. Error del backend (mensaje de API)
 * ──────────────────────────────────────────────────────────────────────────
 * const data = await res.json();
 * if (!data.success) {
 *     ErrorHandler.handleBackendError(data, 'planificador.js:95');
 *     return;
 * }
 * 
 * 7. Limpiar error y restaurar estado
 * ──────────────────────────────────────────────────────────────────────────
 * ErrorHandler.clearError();
 * 
 * 
 * SEVERIDAD DE ERRORES:
 * 
 * - error (Rojo #ff6b6b): Problemas graves que impiden continuar
 *   → PARSING_ERROR, NETWORK_ERROR, SERVER_ERROR, FILE_LOAD_ERROR
 * 
 * - warning (Naranja #ffa500): Validación o presupuesto insuficiente
 *   → VALIDATION_ERROR, BUDGET_INSUFFICIENT, TIME_INSUFFICIENT
 * 
 * - info (Cyan #4ecdc4): Información sobre disponibilidad
 *   → ROUTE_NOT_FOUND
 * 
 * 
 * SALIDA EN CONSOLA:
 * 
 * ErrorHandler genera logs formateados en la consola del navegador:
 * 
 *   [VAL001] VALIDATION_ERROR
 *   Source: planificador.js:60
 *   Message: Selecciona un origen válido.
 *   Time: 2026-05-17T14:32:45.123Z
 *   {type: 'VALIDATION_ERROR', code: 'VAL001', severity: 'warning', ...}
 * 
 * 
 * ============================================================================
 * BACKEND - Python (core/errors.py)
 * ============================================================================
 * 
 * El módulo core.errors proporciona excepciones personalizadas que heredan
 * de SkyRouteError y se pueden convertir a respuestas JSON.
 * 
 * EXCEPCIONES DISPONIBLES:
 * 
 * - ValidationError: Errores de validación
 * - RouteNotFoundError: Ruta no disponible
 * - BudgetExceededError: Presupuesto/tiempo insuficiente
 * - InternalError: Error interno no esperado
 * 
 * 
 * EJEMPLOS DE USO:
 * 
 * 1. Validación en endpoint
 * ──────────────────────────────────────────────────────────────────────────
 * from core.errors import ValidationError
 * 
 * if not origen:
 *     raise ValidationError("Missing required field: origen")
 * 
 * 2. Ruta no encontrada en algoritmo
 * ──────────────────────────────────────────────────────────────────────────
 * from core.errors import RouteNotFoundError
 * 
 * if not graph[origen]:
 *     raise RouteNotFoundError("BOG", "LIM")
 * 
 * 3. Presupuesto insuficiente
 * ──────────────────────────────────────────────────────────────────────────
 * from core.errors import BudgetExceededError
 * 
 * if not encontro_ruta:
 *     raise BudgetExceededError(modo="budget")
 * 
 * 4. Error interno inesperado
 * ──────────────────────────────────────────────────────────────────────────
 * from core.errors import InternalError
 * 
 * try:
 *     resultado = algoritmo_dfs(graph)
 * except Exception as e:
 *     raise InternalError("Error en cálculo de ruta", original_error=e)
 * 
 * 5. Capturar en endpoint Flask
 * ──────────────────────────────────────────────────────────────────────────
 * from flask import jsonify
 * from core.errors import SkyRouteError
 * 
 * try:
 *     _validate_request(...)
 *     result = find_max_destinations_by_budget(...)
 *     return jsonify(result), 200
 * except SkyRouteError as e:
 *     return jsonify(e.to_dict()), e.status_code
 * 
 * 
 * ESTRUCTURA DE RESPUESTA:
 * 
 * Cada excepción se convierte a JSON con:
 * {
 *     "success": false,
 *     "message": "Descripción del error",
 *     "code": "VAL001",
 *     "type": "ValidationError"
 * }
 * 
 * 
 * ============================================================================
 * FLUJO DE ERROR COMPLETO
 * ============================================================================
 * 
 * 1. Usuario intenta buscar ruta sin presupuesto
 *    ↓
 * 2. Frontend valida: ErrorHandler.validateNumber(presupuesto, ...)
 *    ↓
 * 3. ErrorHandler muestra banner rojo con "Presupuesto inválido"
 * 4. Consola muestra log detallado con código VAL001
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * 1. Usuario envía request con origen y destino sin conexión
 *    ↓
 * 2. Backend: raise RouteNotFoundError("BOG", "LIM")
 *    ↓
 * 3. Endpoint captura excepción y retorna:
 *    {"success": false, "message": "No existe ruta entre BOG y LIM.", "code": "ROUTE001"}
 *    ↓
 * 4. Frontend: ErrorHandler.handleBackendError(data, ...)
 *    ↓
 * 5. Frontend muestra banner cyan: "Ruta no disponible"
 * 6. Consola muestra log con código ROUTE001
 * 
 * 
 * ============================================================================
 * DEBUGGING
 * ============================================================================
 * 
 * Para ver todos los errores registrados:
 * - Abre la consola del navegador (F12)
 * - Busca logs con [VAL], [NET], [ROUTE], etc.
 * - Expande los grupos para ver detalles completos
 * 
 * Para rastrear errores específicos:
 * console.log(ErrorHandler.ERROR_TYPES);  // Ver todos los tipos
 * 
 * 
 * ============================================================================
 * MEJORAS FUTURAS
 * ============================================================================
 * 
 * - Endpoint /api/logs para recolectar errores en servidor
 * - Analytics: Monitorear errores más comunes
 * - Telemetría: Rastrear sesiones con muchos errores
 * - Notificaciones por email en errores críticos
 * 
 */
