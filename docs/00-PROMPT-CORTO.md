# Prompt corto para Claude Code — Ephirox (temas + cifras)

> **No adjuntes `Ephirox - Producto.dc.html` ni la spec completa al chat.** Eso es lo que revienta el límite de longitud.
> Copia `tema.css` y `EPHIROX-spec-temas.md` DENTRO del repo (p. ej. `docs`), haz commit, y pega SOLO el texto de abajo.
> Claude Code leerá la spec desde el disco, por secciones, cuando la necesite.

---

Actúa como ingeniero frontend senior. Vas a implementar el sistema de temas y el sistema de cifras de Ephirox en esta app. No cambies rutas, endpoints, esquemas de datos, validaciones ni flujos.

**Lee primero, en este orden:**
1. `docs/tema.css` — los 3 temas completos en variables CSS. Única fuente de verdad de color.
2. `docs//EPHIROX-spec-temas.md` — tokens, tipografía, iconografía, componentes y criterios de aceptación. Consúltalo **por sección** al implementar cada parte; no lo cargues entero.

**Trabajo a realizar:**

1. **Tema.** Copia `tema.css` al proyecto e impórtalo una sola vez. Sustituye todo hex literal de la UI por `var(--eph-*)`. Escribe `data-theme` en el contenedor raíz de la app, no en `<body>`.
2. **Resolución de tema.** Una sola función:
   ```ts
   const BRAND_LOCKED = new Set(['login','splash','dashboard']);
   const resolveTheme = (screen: string, mode: 'dark'|'light') =>
     BRAND_LOCKED.has(screen) ? 'dark-brand' : (mode === 'light' ? 'light-premium' : 'dark-carbon');
   ```
   Login, Splash y Dashboard son `dark-brand` siempre y **no renderizan el toggle**. Los 8 módulos (Baseline, Workout, Nutrition, Stress, Sleep, Breakthrough Sessions, The Circle, Evolution) alternan dark-carbon / light-premium.
3. **Toggle + persistencia.** Botón en la barra superior, a la izquierda del contador de notificaciones: píldora `999px`, alto 34px, mono 10px uppercase `letter-spacing:0.18em`, etiqueta `CARBÓN` / `CLARO`, `aria-pressed`. Persiste en `localStorage['ephirox.theme-mode']`; default `'dark'` en sesión nueva; no uses `prefers-color-scheme`. Fija el atributo antes del primer pintado para evitar flash de tema.
4. **Barra de navegación.** Vive dentro del contenedor con `data-theme` y hereda el tema del módulo activo. Prohibido darle colores propios o fijarla a oscuro.
5. **Cifras.** Aplica `.eph-num` a toda cifra de dato en Cormorant y `.eph-num-mono` a las de JetBrains Mono. Crea la primitiva `MetricValue` (cifra 44px + unidad mono 400 11px `letter-spacing:0.14em` uppercase en `--eph-muted`, con `display:inline-flex; align-items:baseline; gap:8px`) y úsala en TODA fila de KPIs, índice o métrica. Cambia los símbolos por unidades: `22'`→`22 MIN`, `58'`→`58 MIN`, `60"`→`60 S`, `54%`→`54 %`, `6:12`→`6:12 H`, `64`→`64 MS`. Las cifras de selección (comidas, pasos, días) siguen en mono, sin tocar.
6. **Logo.** El anillo abierto y el wordmark no cambian de forma, proporción ni tipografía entre temas: solo el color del trazo (`var(--eph-accent)`) y del texto (`var(--eph-text)`). SVG exacto en la §4.1 de la spec.

**Orden de ejecución** (un commit por paso, mensaje `theme(<paso>): sistema de temas Ephirox`):
tokens → resolución + toggle + persistencia → header → primitivas (Card, Button, Input, Badge, MetricValue, ProgressRing) → los 8 módulos, uno por commit.

**Criterios de aceptación (verifícalos y repórtalos):**
- Buscar `#` en el CSS/JSX de UI devuelve solo `tema.css`.
- Login/Splash/Dashboard en `dark-brand` y sin toggle en el DOM.
- Los 8 módulos cambian de tema con un clic, sin recarga, y la barra superior cambia con ellos.
- localStorage vacío → arranca en dark; toggle a claro + recarga → sigue en claro.
- Ningún tema oscuro emite `box-shadow`; light-premium solo en tarjetas.
- Contraste ≥ 4.5:1 en cuerpo y en el CTA en los 3 temas.
- Cifras: el `4`, el `7` y el `1` a la misma altura en una fila de KPIs; columnas numéricas alineadas.
- Sin scroll horizontal a 1024 / 1280 / 1440 px.

Si algo de la spec choca con el código existente, dime la contradicción antes de improvisar.
