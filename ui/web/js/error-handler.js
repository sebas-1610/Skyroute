/**
 * Error Handler - Manejo centralizado de errores para SkyRoute Frontend
 * 
 * Tipos de Error:
 * - VALIDATION_ERROR: Validación de campos (origen, destino, presupuesto)
 * - PARSING_ERROR: Error al parsear JSON
 * - NETWORK_ERROR: Error de conexión con el servidor
 * - ROUTE_NOT_FOUND: No existe ruta entre los aeropuertos
 * - BUDGET_INSUFFICIENT: Presupuesto insuficiente
 * - TIME_INSUFFICIENT: Tiempo insuficiente
 * - SERVER_ERROR: Error interno del servidor
 * - FILE_LOAD_ERROR: Error al cargar archivo
 * 
 * @example
 * ErrorHandler.handle('VALIDATION_ERROR', 'Selecciona un origen válido', 'planificador.js');
 * 
 * @example
 * ErrorHandler.handleBackendError(data, 'planificador.js:100');
 */

class ErrorHandler {
    static ERROR_TYPES = {
        VALIDATION_ERROR: { code: 'VAL001', severity: 'warning' },
        PARSING_ERROR: { code: 'PARSE001', severity: 'error' },
        NETWORK_ERROR: { code: 'NET001', severity: 'error' },
        ROUTE_NOT_FOUND: { code: 'ROUTE001', severity: 'info' },
        BUDGET_INSUFFICIENT: { code: 'BUDGET001', severity: 'warning' },
        TIME_INSUFFICIENT: { code: 'TIME001', severity: 'warning' },
        SERVER_ERROR: { code: 'SRV001', severity: 'error' },
        FILE_LOAD_ERROR: { code: 'FILE001', severity: 'error' }
    };

    /**
     * Maneja un error: lo registra en consola y lo muestra al usuario.
     * 
     * @param {string} type - Tipo de error (debe estar en ERROR_TYPES)
     * @param {string} message - Mensaje técnico del error
     * @param {string} source - Ubicación del error (archivo:línea)
     * @param {object} metadata - Datos adicionales para el log
     */
    static handle(type, message, source = 'unknown', metadata = {}) {
        const config = this.ERROR_TYPES[type] || this.ERROR_TYPES.SERVER_ERROR;
        const error = {
            type, 
            code: config.code, 
            severity: config.severity,
            message, 
            source, 
            timestamp: new Date().toISOString(), 
            ...metadata
        };

        this.log(error);
        this.display(error);
    }

    /**
     * Loguea el error en la consola del navegador con color según severidad.
     * 
     * @private
     * @param {object} error - Objeto de error estructurado
     */
    static log(error) {
        const style = error.severity === 'error' ? 'color: #ff6b6b; font-weight: bold;' : 
                        error.severity === 'warning' ? 'color: #ffa500; font-weight: bold;' :
                        'color: #4ecdc4; font-weight: bold;';
        console.group(`%c[${error.code}] ${error.type}`, style);
        console.error(`Source: ${error.source}`);
        console.error(`Message: ${error.message}`);
        console.error(`Time: ${error.timestamp}`);
        console.table(error);
        console.groupEnd();
    }

    /**
     * Muestra el error al usuario en la UI con banner coloreado.
     * 
     * @private
     * @param {object} error - Objeto de error estructurado
     */
    static display(error) {
        if (error.type === 'BUDGET_INSUFFICIENT') {
            const audio = new Audio('/sounds/odio-ser-pobre-lo-odio.mp3');
            audio.volume = 0.3; // 0.0 (mudo) → 1.0 (máximo)
            audio.play().catch(() => { /* autoplay bloqueado por el navegador, ignorar */ });
        }

        const area = document.getElementById('results-area');
        if (!area) return;

        const colors = { 
            error: '#ff6b6b', 
            warning: '#ffa500', 
            info: '#4ecdc4' 
        };
        const color = colors[error.severity] || colors.info;
        const titles = {
            VALIDATION_ERROR: 'Error de validación',
            PARSING_ERROR: 'Error al parsear JSON',
            NETWORK_ERROR: 'Error de red',
            ROUTE_NOT_FOUND: 'Ruta no disponible',
            BUDGET_INSUFFICIENT: 'Presupuesto insuficiente',
            TIME_INSUFFICIENT: 'Tiempo insuficiente',
            SERVER_ERROR: 'Error del servidor',
            FILE_LOAD_ERROR: 'Error al cargar archivo'
        };

        area.innerHTML = `
            <div class="error-banner" style="border-left: 4px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">✗ ${titles[error.type] || 'Error desconocido'}</div>
                        <div style="font-size: 14px; line-height: 1.5;">${error.message}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
                            Código: ${error.code} · ${new Date(error.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                    <button onclick="ErrorHandler.clearError()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; padding: 4px; hover: color: var(--text);">×</button>
                </div>
            </div>
        `;
    }

    /**
     * Limpia el mensaje de error y restaura el estado inicial.
     */
    static clearError() {
        const area = document.getElementById('results-area');
        if (area) {
            area.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✈</div><p>Carga un JSON, elige origen, destino<br>y presupuesto para ver los resultados.</p></div>';
        }
    }

    /**
     * Valida que un campo no esté vacío.
     * 
     * @param {*} value - Valor a validar
     * @param {string} fieldLabel - Etiqueta del campo para mostrar
     * @returns {boolean} true si es válido, false si dispara error
     */
    static validateRequired(value, fieldLabel) {
        if (!value) {
            this.handle('VALIDATION_ERROR', `El campo "${fieldLabel}" es requerido.`, 'planificador.js');
            return false;
        }
        return true;
    }

    /**
     * Valida que un número sea positivo.
     * 
     * @param {*} value - Valor a validar
     * @param {string} fieldLabel - Etiqueta del campo para mostrar
     * @param {number} min - Valor mínimo permitido
     * @returns {boolean} true si es válido, false si dispara error
     */
    static validateNumber(value, fieldLabel, min = 0) {
        if (isNaN(value) || value <= min) {
            this.handle('VALIDATION_ERROR', `${fieldLabel} debe ser mayor a ${min}.`, 'planificador.js');
            return false;
        }
        return true;
    }

    /**
     * Maneja errores de red y respuestas HTTP inválidas.
     * 
     * @param {Response|Error} response - Respuesta HTTP o error de fetch
     * @param {string} source - Ubicación del error (archivo:línea)
     */
    static handleApiError(response, source) {
        if (response instanceof Error) {
            this.handle('NETWORK_ERROR', response.message, source);
            return;
        }

        if (!response.ok) {
            if (response.status === 500) {
                this.handle('SERVER_ERROR', 'El servidor experimentó un error.', source);
            } else if (response.status === 400) {
                this.handle('VALIDATION_ERROR', 'Datos inválidos enviados.', source);
            } else {
                this.handle('NETWORK_ERROR', `Error HTTP ${response.status}`, source);
            }
        }
    }

    /**
     * Maneja errores específicos del backend (desde respuesta JSON).
     * Usa el campo `type` del backend cuando está disponible (más fiable
     * que parsear el mensaje). Para BudgetExceededError usa `code` para
     * distinguir presupuesto de tiempo. Cae a detección por mensaje como
     * último recurso.
     * 
     * @param {object} data - Respuesta JSON del servidor
     * @param {string} source - Ubicación del error (archivo:línea)
     */
    static handleBackendError(data, source) {
        if (!data.success && data.message) {

            // ── Detección primaria: campo `type` enviado por el backend ──
            if (data.type) {
                if (data.type === 'BudgetExceededError') {
                    const errorType = data.code === 'TIME001'
                        ? 'TIME_INSUFFICIENT'
                        : 'BUDGET_INSUFFICIENT';
                    this.handle(errorType, data.message, source);
                    return;
                }
                const typeMap = {
                    RouteNotFoundError: 'ROUTE_NOT_FOUND',
                    ValidationError:    'VALIDATION_ERROR',
                    InternalError:      'SERVER_ERROR',
                };
                if (typeMap[data.type]) {
                    this.handle(typeMap[data.type], data.message, source);
                    return;
                }
            }

            // ── Fallback: detección por contenido del mensaje ────────────
            const msg = data.message.toLowerCase();
            if (msg.includes('presupuesto')) {
                this.handle('BUDGET_INSUFFICIENT', data.message, source);
            } else if (msg.includes('tiempo')) {
                this.handle('TIME_INSUFFICIENT', data.message, source);
            } else if (msg.includes('no existe ruta') || msg.includes('no se encontró ruta')) {
                this.handle('ROUTE_NOT_FOUND', data.message, source);
            } else {
                this.handle('SERVER_ERROR', data.message, source);
            }
        }
    }
}

window.ErrorHandler = ErrorHandler;