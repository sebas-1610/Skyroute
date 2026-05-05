# SPEC: Refactorización de index.html en Módulos

**Fecha:** 2026-05-04
**Proyecto:** SkyRoute Planner — UI Web
**Estado:** Pendiente de aprobación

---

## Objective

Separar el archivo `ui/web/index.html` (~47KB, 1190 líneas) en múltiples archivos modulares para mejorar mantenibilidad, sin modificar el comportamiento visual ni funcional de la página.

---

##约束

1. **Ningún cambio visual** — La página debe verse idéntica después de la refactorización
2. **Ningún cambio funcional** — Todo comportamiento debe preservarse
3. **Rutas relativas** — Los archivos deben funcionar con rutas relativas desde `ui/web/`
4. **Compatibilidad** — Mantener soporte para navegadores modernos (no IE11)

---

## Arquitectura Propuesta

```
ui/web/
├── index.html          # Main HTML (estructura + includes)
├── css/
│   └── styles.css     # Todos los estilos
├── js/
│   ├── app.js        # Inicialización + canvas
│   ├── features.js   # Funcionalidad de-features
│   ├── pricing.js   # Lógica de pricing
│   └── utils.js      # Utilidades (strings, efectos)
└── assets/
    └── (imágenes si las hay)
```

---

## Plan de Migración

###Paso 1: Extraer CSS
- Copiar todo `<style>` a `css/styles.css`
-Mantener tokens CSS intactos
-Eliminar duplicados si existen

### Paso 2: Extraer JavaScript
-Identificar módulos lógicos por secciones:
  - `app.js`: Canvas network, inicialización
  - `features.js`: Lógica de features (scroll reveal, contadores)
  - `pricing.js`: Toggle pricing mensual/anual, cálculos
  - `utils.js`: Strings, efectos reutilizables

### Paso 3: Reconstruir index.html
-Crear estructura HTML limpia
-Agregar enlaces a archivos externos
-Usar `defer` para scripts

---

## Criterios de Éxito

- [ ] Página carga y se ve igual
- [ ] Animaciones funcionan
- [ ] Canvas network funciona
- [ ] Pricing toggle funciona
- [ ] Features scroll reveal funciona
- [ ] Responsive funciona
- [ ] No errores en consola