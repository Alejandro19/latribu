# EPHIROX — Especificación técnica de temas visuales
**Handoff para desarrollo · migración pixel-perfect · v1.0 · 31.08.2026**

Fuente de verdad visual: `Ephirox - Producto.dc.html` (prototipo con los 3 temas aplicados).
Ningún componente debe contener un color literal: todo consume tokens.

---

## 1. Arquitectura de temas

### 1.1 Reglas de asignación (obligatorias)

| Pantalla / módulo | Tema | Toggle dark/light |
|---|---|---|
| Login | `dark-brand` | **No.** Bloqueado, sin excepción |
| Splash | `dark-brand` | **No.** Bloqueado, sin excepción |
| Dashboard principal | `dark-brand` | **No.** Bloqueado, sin excepción |
| Baseline | `dark-carbon` / `light-premium` | Sí |
| Workout (+ Día, Ejercicio) | `dark-carbon` / `light-premium` | Sí |
| Nutrition | `dark-carbon` / `light-premium` | Sí |
| Stress | `dark-carbon` / `light-premium` | Sí |
| Sleep | `dark-carbon` / `light-premium` | Sí |
| Breakthrough Sessions | `dark-carbon` / `light-premium` | Sí |
| The Circle | `dark-carbon` / `light-premium` | Sí |
| Evolution / Ephi-Metrics | `dark-carbon` / `light-premium` | Sí |

- Modo **dark** de un módulo con toggle = `dark-carbon`. Modo **light** = `light-premium`.
- Las 3 pantallas de marca ignoran la preferencia del usuario: siempre `dark-brand`. El control de toggle **no se renderiza** en ellas.
- Documentos imprimibles, informes y emails: siempre `light-premium`.

### 1.2 Resolución del tema (una sola función, una sola fuente de verdad)

```ts
const BRAND_LOCKED = new Set(['login', 'splash', 'dashboard']);
type Mode = 'dark' | 'light';

function resolveTheme(screen: string, mode: Mode) {
  if (BRAND_LOCKED.has(screen)) return 'dark-brand';
  return mode === 'light' ? 'light-premium' : 'dark-carbon';
}
```

- El tema resuelto se escribe como `data-theme="<tema>"` en el **contenedor raíz de la app** (no en `<body>`), de modo que cualquier subárbol —incluida la barra de navegación— herede los tokens por cascada.
- Reasignar el tema de un módulo debe ser editar `BRAND_LOCKED` / el mapa de resolución. Nunca tocar componentes.
- Cambio de tema: `transition: background 240ms ease` en el contenedor raíz. Sin transición en texto ni bordes (evita flicker en tablas de datos).

### 1.3 Estado, default y persistencia

- Clave: `localStorage['ephirox.theme-mode']`, valores `'dark' | 'light'`.
- **Default en sesión nueva o valor inválido: `'dark'`.** No se usa `prefers-color-scheme`: la app arranca en carbón por decisión de marca.
- Lectura en el primer render del cliente; escritura inmediata en cada toggle.
- Si existe configuración de cuenta, el valor del servidor tiene prioridad sobre localStorage al iniciar sesión, y cada toggle hace `PATCH /me { themeMode }` con escritura optimista local.
- SSR: renderizar con `data-theme` de modo dark e hidratar; o inyectar un script bloqueante en `<head>` que fije el atributo antes de pintar para evitar flash de tema.
- El toggle vive en la barra superior, a la izquierda del contador de notificaciones. Etiqueta mono uppercase: `CARBÓN` / `CLARO`. `aria-pressed` refleja el modo; área táctil mínima 44×44.

---

## 2. Tokens exactos por tema

Nombres canónicos (prefijo sugerido `--eph-`). Los tres temas definen **el set completo**: ningún token puede faltar en un tema.

### 2.1 Tabla comparada

| Token | Rol | `dark-brand` | `dark-carbon` | `light-premium` |
|---|---|---|---|---|
| `--bg` | Fondo de página | `#0b0a08` | `#1c1a17` | `#faf9f6` |
| `--card` | Fondo de tarjeta/panel | `#121110` | `#252220` | `#ffffff` |
| `--card2` | Hover / celda seleccionada | `#171513` | `#2b2825` | `#f4f2ec` |
| `--tx` | Texto primario (titulares, cifras) | `#F5F1E8` | `#F5F1E8` | `#1a1710` |
| `--tx2` | Texto secundario (cuerpo, labels) | `rgba(245,241,232,0.58)` | `rgba(245,241,232,0.50)` | `rgba(26,23,16,0.50)` |
| `--tx3` | Texto terciario (metadatos, deshabilitado) | `rgba(245,241,232,0.40)` | `rgba(245,241,232,0.38)` | `rgba(26,23,16,0.40)` |
| `--tx4` | Cuarto nivel (anillo interior, meta inactiva) | `rgba(245,241,232,0.28)` | `rgba(245,241,232,0.26)` | `rgba(26,23,16,0.30)` |
| `--ac` | Acento de marca (dorado) | `#C9A66B` | `#C9A66B` | `#9a7b3f` |
| `--ac-h` | Acento hover / active | `#E3C795` | `#E3C795` | `#7d6231` |
| `--on-ac` | Texto/ícono sobre acento sólido | `#0b0a08` | `#1c1a17` | `#ffffff` |
| `--ac-soft` | Relleno de estado seleccionado | `rgba(201,166,107,0.14)` | `rgba(201,166,107,0.14)` | `rgba(154,123,63,0.10)` |
| `--ac-line` | Borde dorado (botón secundario, chip on) | `rgba(201,166,107,0.50)` | `rgba(201,166,107,0.50)` | `rgba(154,123,63,0.45)` |
| `--ac-edge` | Borde de panel destacado | `rgba(201,166,107,0.28)` | `rgba(201,166,107,0.30)` | `rgba(154,123,63,0.28)` |
| `--bd` | Hairline por defecto | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.065)` | `rgba(0,0,0,0.07)` |
| `--bd2` | Borde estructural (inputs, separadores 1px de rejilla) | `rgba(255,255,255,0.15)` | `rgba(255,255,255,0.13)` | `rgba(0,0,0,0.12)` |
| `--shadow` | Sombra de tarjeta | `none` | `none` | `0 1px 3px rgba(0,0,0,0.04)` |
| `--steel` | Etiqueta de dato clínico | `#7E8A93` | `#8A959C` | `#5D6A72` |
| `--alert` | Valor fuera de umbral | `#B4614F` | `#C06B56` | `#A24B36` |

### 2.2 Gradientes

Dos únicos gradientes en el sistema, ambos tokenizados. Prohibido escribir gradientes ad-hoc.

**`--panel`** — superficie de "momento destacado". Usada en: panel izquierdo del Login (marca), tarjeta "Comenzar sesión" de Workout, tarjeta de Carga cognitiva en Stress, tarjeta de Próxima sesión en Breakthrough. Siempre combinada con `border: 1px solid var(--ac-edge)`.

| Tema | Valor |
|---|---|
| `dark-brand` | `radial-gradient(circle at 50% 45%, #1A1512 0%, #0b0a08 72%)` |
| `dark-carbon` | `radial-gradient(circle at 82% 18%, #372c20 0%, #221f1c 64%)` |
| `light-premium` | `linear-gradient(135deg, #ffffff 0%, #f5f1e6 100%)` |

**`--hatch`** — placeholder de medio (vídeo, hipnograma, series de datos) y bloque de textura. Trama diagonal a 135°, franjas de 8px.

| Tema | Valor |
|---|---|
| `dark-brand` | `repeating-linear-gradient(135deg, #121110 0 8px, #181614 8px 16px)` |
| `dark-carbon` | `repeating-linear-gradient(135deg, #221f1d 0 8px, #292522 8px 16px)` |
| `light-premium` | `repeating-linear-gradient(135deg, #f4f2ec 0 8px, #ebe7dc 8px 16px)` |

Nota sobre el CTA dorado: **el botón primario no lleva gradiente ni glow.** El halo alrededor de "Comenzar sesión" en Workout es el gradiente `--panel` de la tarjeta contenedora, no del botón. El botón es color plano `var(--ac)`.

### 2.3 Sombras

- Temas oscuros: `--shadow: none`. La jerarquía se construye con hairline de 1px + salto de superficie (`--bg` → `--card` → `--card2`). Prohibida cualquier `box-shadow` decorativa.
- `light-premium`: `--shadow: 0 1px 3px rgba(0,0,0,0.04)` — offset-y 1px, blur 3px, spread 0, negro al 4%. Se aplica **solo** a tarjetas/paneles (`background: var(--card)`), nunca a botones, inputs, chips ni al header.
- Focus visible (los 3 temas): `outline: 1px solid var(--ac); outline-offset: 2px`. No es sombra.

---

## 3. Tipografía exacta

### 3.1 Familias

| Rol | Familia exacta | Fallback | Pesos usados |
|---|---|---|---|
| Wordmark `EPHIROX`, títulos de módulo, cifras grandes, citas | **Cormorant Garamond** | `serif` | 300 (normal e italic). Nunca 600+ |
| Cuerpo, labels de formulario, navegación, botones de texto | **Jost** | `sans-serif` | 300 (base), 400 (excepcional) |
| Datos, métricas, labels uppercase, timestamps, badges | **JetBrains Mono** | `monospace` | 300, 400 |

Carga única, `display=swap`:
`https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&family=JetBrains+Mono:wght@300;400&display=swap`

`-webkit-font-smoothing: antialiased` en el contenedor raíz.

### 3.2 Escala exacta

| Elemento | Familia | Peso | Tamaño | Letter-spacing | Line-height | Notas |
|---|---|---|---|---|---|---|
| Wordmark — Login/Splash | Cormorant Garamond | 300 | `clamp(34px, 4vw, 46px)` | `0.2em` | `1` | + `text-indent: 0.2em` para compensar el tracking final |
| Wordmark — header de app | Cormorant Garamond | 300 | `23px` | `0.18em` | `1` | + `text-indent: 0.18em` |
| Tagline "Redefining limits." | Cormorant Garamond *italic* | 300 | `19px` | normal | `1.2` | color `var(--ac)` |
| H1 de módulo (Workout, Baseline…) | Cormorant Garamond | 300 | `clamp(40px, 5vw, 58px)` | normal | `1` | color `var(--tx)` |
| H1 de subpantalla (Día 1, Jalón al pecho) | Cormorant Garamond | 300 | `clamp(34px, 4.6vw, 54px)` | normal | `1.05` | |
| Título de tarjeta destacada | Cormorant Garamond | 300 | `clamp(28px, 3.6vw, 42px)` | normal | `1.1` | |
| Cifra hero (Carga cognitiva) | Cormorant Garamond | 300 | `clamp(56px, 7vw, 88px)` | normal | `0.9` | |
| Cifra de índice (Evolution) | Cormorant Garamond | 300 | `clamp(44px, 5vw, 64px)` | normal | `0.95` | |
| Cifra de métrica (KPI de rejilla) | Cormorant Garamond | 300 | `40–42px` | normal | `1` | unidad en `20px`, `var(--tx2)` |
| Título de fila de lista | Cormorant Garamond | 300 | `25–26px` | normal | `1.2` | |
| Cita / párrafo de marca | Cormorant Garamond | 300 | `clamp(26px, 3vw, 34px)` | normal | `1.4` | + `text-wrap: pretty` |
| Subtítulo de módulo (kicker bajo el H1) | JetBrains Mono | 300 | `10px` | `0.2em` | `1.6` | UPPERCASE, `var(--tx2)` |
| Label de sección en tarjeta | JetBrains Mono | 300 | `10px` | `0.22em` | `1.6` | UPPERCASE, `var(--ac)` o `var(--tx2)` |
| Label de dato clínico | JetBrains Mono | 300 | `9px` | `0.2em` | `1.6` | UPPERCASE, `var(--steel)` |
| Texto de botón (todos) | JetBrains Mono | 400 | `10px` (`11px` en el CTA de Login) | `0.22em` (`0.26em` en Login) | `1` | UPPERCASE |
| Ítem de navegación superior | Jost | 300 | `15px` | normal | `1` | Sentence case, **no** uppercase |
| Body / párrafo | Jost | 300 | `17–18px` | normal | `1.6` | `var(--tx2)`, `max-width: 640–720px` |
| Label de campo de formulario | Jost | 300 | `16px` | normal | `1.4` | `var(--tx2)` |
| Valor de input | Jost 300 / JetBrains Mono 300 para numérico y hora | 300 | `18–20px` | `0.2em` solo en password | `1.4` | |
| Microcopy / metadato | JetBrains Mono | 300 | `9–10px` | `0.18em` | `1.6–2.1` | UPPERCASE, `var(--tx3)` |
| Badge / píldora | JetBrains Mono | 300 | `10px` | `0.18em` | `1` | UPPERCASE |

### 3.3 Sistema de cifras (crítico para la migración)

Cormorant Garamond entrega **figuras de estilo antiguo** por defecto — alturas y anchos desiguales (el 4, el 7 y el 9 bajan; el 1 y el 2 son cortos). En una fila de métricas eso se lee como un error de maquetación. Regla: toda cifra de dato en Cormorant lleva figuras de caja alta y tabulares.

| Propiedad | Valor |
|---|---|
| `font-variant-numeric` | `lining-nums tabular-nums` |
| `font-feature-settings` | `'lnum' 1, 'tnum' 1` |
| `letter-spacing` | `0.01em` |
| Cifras en JetBrains Mono (tablas, inputs, horas, progreso) | `font-variant-numeric: tabular-nums` |
| Números dentro de prosa | Sin utilidad: se conservan las figuras de estilo antiguo |

Escala unificada de cifra y unidad:

| Uso | Tamaño de cifra | Unidad | Gap cifra↔unidad |
|---|---|---|---|
| KPI de rejilla (Nutrition, Sleep, Ejercicio) | `44px` | mono 400 `11px` / `0.14em` / uppercase / `--tx3` | `8px` |
| Cifra hero (Carga cognitiva) | `clamp(56px,7vw,88px)` | — | — |
| Índice (Evolution) | `clamp(44px,5vw,64px)` | — | — |
| Métrica secundaria (HRV, cortisol, recuperación) | `32px` | mono 400 `11px` | `6px` |
| Valor de slider (Baseline) | `34px`, color `var(--ac)` | — | — |
| Celda de tabla de biomarcadores | mono `15px` tabular | — | — |

- Contenedor de cifra + unidad: `display:inline-flex; align-items:baseline; gap:8px` (`6px` en métricas de 32px). La unidad se alinea a la línea de base, nunca centrada ni en superíndice.
- Unidades explícitas en lugar de símbolos tipográficos: `22 MIN` (no `22'`), `58 MIN`, `60 S` (no `60"`), `54 %`, `6:12 H`, `64 MS`.
- Las cifras de **selección** (nº de comidas, pasos de Baseline 1–10, días 1–4, contadores del header) permanecen en JetBrains Mono: son controles, no datos.
- Prohibido corregir el desnivel con sans/mono, más peso o escalado manual de glifos.

Mínimos: ningún texto por debajo de `9px`, y solo para mono uppercase con tracking ≥ `0.18em`. El cuerpo nunca baja de `15px`.

---

## 4. Iconografía y elementos gráficos

### 4.1 Isotipo — anillo abierto

ViewBox canónico `0 0 132 132`, `fill="none"`. El color se aplica por CSS (`style="stroke: var(--ac)"`), **no** por atributo de presentación, para que herede el tema.

**Versión completa (Login, Splash, marca — 104×104 renderizado):**

```html
<svg width="104" height="104" viewBox="0 0 132 132" fill="none">
  <circle cx="66" cy="66" r="62" style="stroke:var(--ac)"  stroke-width="1.4" stroke-dasharray="330 60" transform="rotate(-58 66 66)"/>
  <circle cx="66" cy="66" r="47" style="stroke:var(--tx4)" stroke-width="1.4" stroke-dasharray="250 45" transform="rotate(122 66 66)"/>
  <circle cx="66" cy="66" r="4"  style="fill:var(--ac)"/>
</svg>
```

**Versión compacta (header, favicon, avatar — 26×26 renderizado):** solo el anillo exterior y el punto, con trazo engrosado para que sobreviva a la reducción.

```html
<svg width="26" height="26" viewBox="0 0 132 132" fill="none">
  <circle cx="66" cy="66" r="62" style="stroke:var(--ac)" stroke-width="4" stroke-dasharray="330 60" transform="rotate(-58 66 66)"/>
  <circle cx="66" cy="66" r="8" style="fill:var(--ac)"/>
</svg>
```

Reglas: sin animación en estado normal (el anillo no gira ni pulsa). La única animación permitida es en el splash: rotación única de `-58deg → 302deg`, `1200ms`, `cubic-bezier(0.22,1,0.36,1)`, una sola vez, sin loop. Nunca rellenar el anillo (queda abierto: el límite se redefine, no se cierra). Nunca cambiar radios, dash-array ni rotaciones entre temas.

### 4.2 Anillo de progreso (Baseline)

- SVG `0 0 76 76`, renderizado 76×76. Pista: `r=33`, `stroke-width: 1.5`, `stroke: var(--bd2)`.
- Progreso: mismo `r`, `stroke: var(--ac)`, `stroke-width: 1.5`, `transform: rotate(-90 38 38)`.
- `stroke-dasharray = (2π·33·p) + ' ' + (2π·33)`; circunferencia = `207.3`. Sin `linecap` redondeado.
- Cifra centrada: JetBrains Mono `14px`, `fill: var(--tx)`, `x=38 y=43 text-anchor="middle"`.

### 4.3 Barra de progreso lineal (sesión)

Pista `height: 2px; background: var(--bd2)`; relleno `height: 2px; background: var(--ac); width: <pct>`. Sin border-radius. Transición `width 240ms ease`.

### 4.4 Indicadores de paso

- **Paso de formulario (Baseline, 10 pasos):** círculo `40×40`, `border-radius: 50%`, mono `12px`. Actual: `background: var(--ac)`, `border: 1px solid var(--ac)`, texto `var(--on-ac)`. Completado: fondo transparente, `border: 1px solid var(--ac-line)`, texto `var(--ac)`. Pendiente: `border: 1px solid var(--bd2)`, texto `var(--tx3)`.
- **Sesión de la semana (Workout):** círculo `44×44`, mono `13px`, mismos tres estados.
- **Punto de bloque (Día):** `10×10`, `border-radius: 50%`, `var(--ac)` activo / `var(--bd2)` inactivo.

### 4.5 Placeholder de medio

Contenedor con `background: var(--hatch)`, `border: 1px solid var(--bd)`, `aspect-ratio` según uso (`16/9` vídeo, `16/7` serie de datos, `16/5` hipnograma). Triángulo de play construido con bordes, sin icono: `width:0; height:0; border-left: 20px solid var(--ac); border-top: 12px solid transparent; border-bottom: 12px solid transparent`. Caption mono `10px` / `0.2em` / `var(--tx3)`.

### 4.6 Separador de rejilla

Rejillas de métricas y celdas: `display: grid; gap: 1px; background: var(--bd2)`, celdas con `background: var(--card)`. El gap ES la línea — no usar `border` en las celdas.

---

## 5. Componentes reutilizables

Regla transversal: `border-radius: 0` en todo, excepto `999px` en píldoras/chips/avatares/indicadores circulares. Prohibidos los radios de 8–24px.

### 5.1 Botón primario (CTA)

| Propiedad | Valor |
|---|---|
| Padding | `19px` full-width (Login) · `17px 38px` (CTA de tarjeta) · `16px 44px` (avance de formulario) |
| Radius | `0` |
| Tipografía | JetBrains Mono 400, `10–11px`, `letter-spacing: 0.22–0.26em`, UPPERCASE |
| Fondo / texto | `var(--ac)` / `var(--on-ac)` |
| Hover | `background: var(--ac-h)` |
| Borde | ninguno |
| Sombra | ninguna en los 3 temas |

Comportamiento por tema: idéntico en forma; solo cambian los tokens. En los oscuros el dorado `#C9A66B` lleva texto `#0b0a08`/`#1c1a17`; en claro el dorado baja a `#9a7b3f` con texto `#ffffff` (contraste ≥ 4.5:1). **Máximo un botón primario sólido por pantalla.**

### 5.2 Botón secundario (contorno neutro)

Padding `15px 30px` (o `16px 34px` en formularios) · radius `0` · mono 400 `10px` / `0.22em` UPPERCASE · `background: transparent` · `border: 1px solid var(--bd2)` · texto `var(--tx2)` · hover `border-color: var(--ac-line); color: var(--tx)`. Igual en los 3 temas vía tokens (en claro el borde pasa a negro 12%).

### 5.3 Botón terciario (contorno dorado)

Padding `12px 24px` … `15px 32px` · radius `0` · `background: transparent` · `border: 1px solid var(--ac-line)` · texto `var(--ac)` · hover `background: var(--ac-soft)`. En `light-premium` el relleno hover baja a 10% de opacidad para no ensuciar el blanco.

### 5.4 Input / select / textarea

Solo línea inferior: `background: transparent; border: 0; border-bottom: 1px solid var(--bd2); padding: 6px 0 10px; outline: none`. Radius `0`. Valor `18–20px` (`Jost 300`; `JetBrains Mono 300` para numérico, hora y contraseña), color `var(--tx)`. Label encima, `16px` `var(--tx2)`, `gap: 10px`. Focus: `border-bottom-color: var(--ac)`. Placeholder: `var(--tx3)`. En `light-premium` no se añade fondo ni caja: el campo sigue siendo una línea sobre `var(--card)`.

**Range (slider):** track `1px` `var(--bd2)`; thumb `14×14`, `border-radius: 50%`, `background: var(--ac)`, `margin-top: -7px`; `accent-color: var(--ac)`.

**Checkbox custom:** cuadrado `15×15`, `border: 1px solid var(--ac)` y `background: var(--ac)` cuando está activo; `border: 1px solid var(--bd2)` y fondo transparente cuando no. Radius `0`.

### 5.5 Tarjeta / panel

`background: var(--card)`, `border: 1px solid var(--bd)`, `box-shadow: var(--shadow)`, radius `0`, padding `clamp(26px, 3vw, 38px)` (tarjetas compactas: `32px`). Cabecera interna: label mono `10px` / `0.22em` UPPERCASE con `padding-bottom: 24–26px` y `border-bottom: 1px solid var(--bd)`; el contenido arranca a `28px`.

Por tema: en `dark-brand` la tarjeta `#121110` se separa apenas del fondo `#0b0a08` (jerarquía por hairline). En `dark-carbon` el salto `#1c1a17 → #252220` es deliberadamente más visible. En `light-premium` la tarjeta es `#ffffff` sobre `#faf9f6` **más** la sombra de 1px — es el único tema con sombra.

**Panel destacado:** `background: var(--panel)`, `border: 1px solid var(--ac-edge)`, padding `clamp(28px, 3.4vw, 44px)`. Máximo uno por pantalla.

### 5.6 Badge / píldora de estado

Padding `7px 14px` (badge) · `9px 18px` (asiento/credencial) · `11px 22px` (filtro de panel) · radius `999px` · mono `10px` / `0.18–0.2em` UPPERCASE. Neutro: `border: 1px solid var(--bd2)`, texto `var(--tx2)`. Marca: `border: 1px solid var(--ac-line)`, texto `var(--ac)`. Seleccionado: `background: var(--ac-soft)`, `border-color: var(--ac-line)`, texto `var(--ac)`. Estados semánticos en texto, no en fondo: confirmado `var(--ac)`, en lista `var(--tx2)`, pendiente `var(--tx3)`, fuera de umbral `var(--alert)`.

**Chip de selección (Nutrition):** padding `10px 20px`, radius `999px`, Jost 300 `15px`; off = `border: 1px solid var(--bd2)`, `var(--tx2)`, transparente; on = `border: 1px solid var(--ac)`, texto `var(--ac)`, `background: var(--ac-soft)`.

### 5.7 Navegación superior

- `height: 74px`, `padding: 0 clamp(20px, 4vw, 52px)`, `background: var(--bg)`, `border-bottom: 1px solid var(--bd2)`, sin sombra en ningún tema.
- Layout: `display: flex; align-items: center; gap: clamp(20px, 4vw, 52px); flex-wrap: nowrap`. Bloque de logo y bloque de utilidades con `flex-shrink: 0`; `<nav>` con `flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none`. **Nunca envolver a dos líneas.**
- Ítem: Jost 300 `15px`, `padding: 24px 0 22px`, `white-space: nowrap`, `background: transparent`, `border: 0`. Inactivo `var(--tx2)`; hover `var(--tx)`; activo `var(--tx)` + `border-bottom: 1px solid var(--ac)`.
- Utilidades: notificaciones `34×34`, `border-radius: 50%`, `border: 1px solid var(--bd2)`, mono `10px`, `var(--tx2)`. Avatar `34×34`, `border: 1px solid var(--ac)`, Cormorant `16px`, `var(--ac)`.
- Toggle de tema: a la izquierda de notificaciones, altura `34px`, padding `0 14px`, radius `999px`, `border: 1px solid var(--bd2)`, mono `10px` / `0.18em` UPPERCASE, texto `var(--tx2)`, hover `border-color: var(--ac-line); color: var(--tx)`. No se renderiza en las pantallas `dark-brand`.
- La barra **hereda** el tema del módulo activo por estar dentro del contenedor con `data-theme`. Prohibido darle colores propios o fijarla a oscuro.

### 5.8 Layout de página

`max-width: 1320px` (pantallas de lectura larga: `1100px`), `margin: 0 auto`, `padding: clamp(34px, 4.5vw, 60px) clamp(20px, 4vw, 52px) 90px`, `display: grid; gap: 26px` (formularios: `40px`). Cabecera de módulo: H1 + kicker mono, `padding-bottom: 32px`, `border-bottom: 1px solid var(--bd2)`.

Rejillas responsivas: `repeat(auto-fit, minmax(min(100%, 280–340px), 1fr))`. Verificar `document.documentElement.scrollWidth === window.innerWidth` a 1024 / 1280 / 1440px en cada pantalla.

---

## 6. Reglas de excepción (confirmadas)

1. **El logo no se rediseña por tema.** El isotipo del anillo abierto conserva exactamente los mismos radios (`62`, `47`, `4` / `62`, `8`), grosores (`1.4` / `4`), `stroke-dasharray` (`330 60`, `250 45`) y rotaciones (`-58deg`, `122deg`) en `dark-brand`, `dark-carbon` y `light-premium`. Lo único que cambia es el color del trazo: `#C9A66B` en los dos temas oscuros, `#9a7b3f` en claro (vía `var(--ac)`).
2. **El wordmark no cambia de tipografía.** Siempre Cormorant Garamond 300 con su tracking y `text-indent` propios; solo cambia el color del texto (`var(--tx)`). Nunca se sustituye por sans, nunca se pone en bold, nunca se altera el tracking.
3. **Proporción y área de respeto intactas** en los 3 temas: el margen libre alrededor del lockup equivale al radio del punto central (`r=4` sobre 132, es decir 3% del ancho del isotipo) multiplicado por 4.
4. **El dorado conserva su rol** en los 3 temas: acento único, un solo elemento sólido por pantalla (el CTA), y en todo lo demás solo borde, texto de label o línea de progreso. Nunca es fondo de página ni de tarjeta grande.
5. **Prohibido cualquier color fuera de los tokens.** Un valor hex literal en un componente es un bug de migración, no una decisión de diseño.

---

## 7. Criterios de aceptación de la migración

- [ ] Cero colores literales en componentes; búsqueda de `#` en CSS/JSX de UI devuelve solo el archivo de tema.
- [ ] Login, Splash y Dashboard renderizan `data-theme="dark-brand"` con el toggle ausente del DOM.
- [ ] Los 8 módulos restantes cambian de `dark-carbon` a `light-premium` con un solo clic y sin recarga; la barra superior cambia con ellos.
- [ ] Sesión nueva (localStorage vacío) arranca en dark. Toggle a claro, recarga → sigue en claro.
- [ ] Ningún tema oscuro emite `box-shadow`; `light-premium` la emite solo en tarjetas.
- [ ] Contraste ≥ 4.5:1 en cuerpo (`--tx2` sobre `--card`) y en el CTA (`--on-ac` sobre `--ac`) en los 3 temas.
- [ ] El isotipo es idéntico píxel a píxel entre temas salvo el color del trazo (comparar capturas superpuestas).
- [ ] Toda cifra de dato en Cormorant renderiza con `lnum`+`tnum` (el `4`, el `7` y el `1` a la misma altura en una fila de KPIs) y las columnas numéricas quedan alineadas.
- [ ] Sin scroll horizontal a 1024 / 1280 / 1440px en las 11 pantallas.
