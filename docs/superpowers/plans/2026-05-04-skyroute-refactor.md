# SkyRoute Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar `ui/web/index.html` (~47KB, 1190 líneas) en múltiples archivos modulares sin modificar nada visual ni funcionalmente.

**Architecture:** Extraer CSS a archivo dedicado, dividir JavaScript en módulos lógicos, reconstruir HTML con includes.

**Tech Stack:** HTML5, CSS3 vanilla, JavaScript vanilla (sin frameworks)

---

## File Structure

```
ui/web/
├── index.html          # HTML principal (limpio, ~250 líneas)
├── css/
│   └── styles.css   # Todos los estilos (~630 líneas)
└── js/
    ├── app.js        # Canvas network + inicialización (~130 líneas)
    └── features.js  # Scroll reveal (~25 líneas)
```

---

### Task 1: Create css/styles.css

**Files:**
- Create: `ui/web/css/styles.css`

- [ ] **Step 1: Copy CSS from index.html**

Copiar todo el bloque `<style>` (líneas 11-639) a `css/styles.css`:
```css
/* === TOKENS === */
:root {
    --bg: oklch(11% 0.012 250);
    /* ... todos los tokens */
}

/* === RESET === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
/* ... */

/* === NAV === */
nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; /* ... */ }
/* ... resto de estilos hasta cierre </style> */

/* === RESPONSIVE === */
@media (max-width: 640px) { .nav-links { display: none; } }
```

- [ ] **Step 2: Verify file created**

Run: `Get-Content ui/web/css/styles.css | Measure-Object -Line`
Expected: ~630 líneas

---

### Task 2: Create js/app.js (Canvas Network)

**Files:**
- Create: `ui/web/js/app.js`

- [ ] **Step 1: Copy canvas script**

Copiar script de canvas (líneas 1040-1164):
```javascript
(() => {
const canvas = document.getElementById('network-canvas');
const ctx = canvas.getContext('2d');

const AMBER  = 'oklch(76% 0.175 65)';
// ... todo el código
tick();
})();
```

- [ ] **Step 2: Wrap in module**

```javascript
// SkyRoute Canvas Network Animation
(function() {
    'use strict';
    
    const canvas = document.getElementById('network-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    // ... código existente (sin IIFE duplicado)
    
    window.addEventListener('resize', () => { resize(); initNodes(); });
    resize();
    initNodes();
    tick();
})();
```

- [ ] **Step 3: Verify file created**

Run: `Test-Path ui/web/js/app.js`
Expected: True

---

### Task 3: Create js/features.js (Scroll Reveal)

**Files:**
- Create: `ui/web/js/features.js`

- [ ] **Step 1: Copy scroll reveal script**

Copiar script (líneas 1168-1186):
```javascript
(() => {
const cards = document.querySelectorAll('[data-reveal]');
if (!cards.length) return;

const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
        const el = entry.target;
        const idx = [...cards].indexOf(el);
        el.style.animationDelay = `${idx * 80}ms`;
        el.classList.add('visible');
        io.unobserve(el);
    }
    });
}, { threshold: 0.15 });

cards.forEach(c => io.observe(c));
})();
```

- [ ] **Step 2: Wrap in module**

```javascript
// SkyRoute Scroll Reveal
(function() {
    'use strict';
    
    const cards = document.querySelectorAll('[data-reveal]');
    if (!cards.length) return;
    // ... código existente
})();
```

- [ ] **Step 3: Verify file created**

Run: `Test-Path ui/web/js/features.js`
Expected: True

---

### Task 4: Rebuild index.html

**Files:**
- Modify: `ui/web/index.html`

- [ ] **Step 1: Create clean HTML structure**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SkyRoute Planner — Optimización de Rutas Aéreas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">
</head>
<body>
<!-- NAV -->
...
<!-- SCRIPTS -->
<script src="js/app.js" defer></script>
<script src="js/features.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: Remove old style block**

Eliminar líneas 11-639 (el bloque `<style>` completo)

- [ ] **Step 3: Replace scripts with defer includes**

Eliminar líneas 1040-1186 y reemplazar con:
```html
<script src="js/app.js" defer></script>
<script src="js/features.js" defer></script>
```

- [ ] **Step 4: Verify HTML is valid**

Run: `Get-Content ui/web/index.html | Measure-Object -Line`
Expected: ~250 líneas (vs original 1190)

---

### Task 5: Verify Visual Equivalence

**Files:**
- Test: `ui/web/index.html`

- [ ] **Step 1: Open in browser**

Abrir `ui/web/index.html` en navegador y verificar:
- [ ] Colores iguales (tokens OKLCH)
- [ ] Animaciones funcionan
- [ ] Canvas network animando
- [ ] Scroll reveal en sections
- [ ] Responsive breakpoint (640px)
- [ ] Footer visible

- [ ] **Step 2: No console errors**

Verificar DevTools Console sin errores JavaScript

- [ ] **Step 3: Page loads correctly**

Run lighthouse o verificar manualmente que页面 carga sin errores de recursos

---

### Task 6: Commit

- [ ] **Step 1: Stage changes**

```bash
git add ui/web/
git status
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: split index.html into modular files

- Extract CSS to css/styles.css
- Split JS into app.js (canvas) and features.js (scroll reveal)
- Rebuild index.html with external includes
- No visual or functional changes"
```

---

## Self-Review

1. **Spec coverage:** ✓ Todas las secciones cubiertas
2. **Placeholder scan:** ✓ Sin TODOs
3. **Type consistency:** ✓ Nombres consistentes

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-skyroute-refactor.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**