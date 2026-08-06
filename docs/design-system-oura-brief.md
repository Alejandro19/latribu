# Sistema de diseño del proyecto — referencia Oura

> **Alcance: todo el proyecto, de forma permanente — no un brief puntual para una fase.**
> A partir de acá, cada componente, página o formulario nuevo que se construya en cualquier
> fase/bloque de la migración (las que quedan y las que ya se hicieron, si se retocan) debe
> seguir estas reglas por defecto, sin que haga falta pedirlo de nuevo cada vez.
> Objetivo: que los componentes de UI (formularios, botones, cards, nav) dejen de verse
> "genéricos hechos con IA" y adopten el lenguaje visual de marcas premium tipo Oura —
> **sin copiar la paleta de color de Oura**, sino su estructura, espaciado e interacción.
>
> Este documento es autocontenido: describe en texto, sin depender de imágenes, tres pantallas
> reales del sitio de Oura (oura.com) que sirvieron de referencia. No hace falta ver ninguna
> imagen para aplicar las reglas — todo lo relevante de cada pantalla está descrito abajo.

---

## Disciplina de alcance — SOLO la fase pedida, nada más

Regla operativa, independiente del diseño visual, pero igual de importante:

- Cuando se pida migrar una fase/bloque específico, **tocar únicamente los archivos que
  pertenecen a ese bloque** según `tasks/plan.md`. No adelantar trabajo de otro bloque "ya que
  se está ahí", no refactorizar código que funciona, no "aprovechar para arreglar" algo que no
  se pidió.
- No modificar, renombrar ni borrar archivos fuera del alcance del bloque actual — ni siquiera
  si parecen relacionados o mejorables. Si algo fuera de alcance se ve roto o desactualizado,
  anotarlo (por ejemplo en `docs/errors-resueltos.md` o como comentario en el plan) en vez de
  tocarlo sin que se haya pedido.
- No dejar código puente/mock temporal reemplazando lógica real como atajo para no bloquearse
  con una dependencia externa incompleta (ej. una integración que aún no tiene credenciales).
  Si algo no se puede completar de verdad, se dice explícitamente qué falta y por qué, en vez
  de simular una respuesta falsa que parezca funcionar.
- No tocar páginas/componentes ya migrados en fases anteriores salvo que el bloque actual lo
  requiera explícitamente (ejemplo puntual: no tocar el login, ya migrado en Fase 0).
- Si migrar el bloque pedido requiere sí o sí tocar un archivo compartido (por ejemplo agregar
  un import, registrar una ruta nueva), el cambio debe ser mínimo y aditivo — no una reescritura
  del archivo compartido completo.
- Al terminar, listar exactamente qué archivos se crearon/modificaron, para poder verificar que
  coincide con el alcance del bloque pedido y nada más.

---

## Descripción textual de las 3 pantallas de referencia (Oura.com)

**Pantalla A — formulario de dirección de envío (checkout):**
Fondo gris muy claro. Una columna vertical de campos de texto, cada uno una píldora blanca de
esquinas totalmente redondeadas (altura ~56px), con un borde gris casi invisible. El primer
campo dice "Dirección*" con el label como placeholder normal centrado verticalmente dentro del
campo (campo vacío, sin foco). El segundo campo, "Portal, piso, puerta", está actualmente
enfocado por el usuario: tiene borde azul y, a diferencia del campo anterior, el texto "Portal,
piso, puerta" aparece como una etiqueta pequeña y gris **por encima** del borde superior del
campo (no centrada dentro), dejando el interior del campo vacío con el cursor de texto parpadeando
— es decir, el label "sube y se encoge" en cuanto el campo recibe foco, y se queda visible aun
sin haber escrito nada. Debajo siguen "Municipio*", "Código postal*" y "Número de teléfono*", los
tres en su estado vacío/sin foco (label centrado dentro, como el primero). Al final, alineado a
la derecha, hay un botón píldora azul: el texto es "**Siguiente:** Dirección de facturación" —
la palabra "Siguiente:" en negrita seguida del resto en peso normal, todo en una sola línea
dentro del botón.

**Pantalla B — revisión de carrito / checkout:**
Layout de dos columnas sobre fondo gris muy claro. Columna izquierda, encabezada "Revisar el
carrito": una fila superior tipo pastilla blanca con ícono de caja + "Entrega en 5-7 día."; debajo
una card blanca de esquinas redondeadas con el producto: miniatura cuadrada del producto a la
izquierda (esquinas redondeadas), a su derecha el nombre del producto y variante, y a la derecha
del todo el precio; dentro de la misma card, separado por una línea divisoria fina, un ítem de
suscripción con su propio ícono circular pequeño, nombre, texto secundario en gris ("Primer mes
gratis...") y precio, con un link "Editar" debajo. Más abajo, sección "Extras": otra card blanca
con una imagen a la izquierda, título y descripción al centro, y un botón píldora con borde (sin
relleno) que dice "Añadir" a la derecha. Columna derecha, encabezada "Resumen del pedido": una
card blanca con un checkbox cuadrado simple + "Es un regalo"; debajo otra card con "Subtotal" a
la izquierda y el monto a la derecha, más una línea de texto pequeño gris aclarando impuestos;
debajo un botón píldora azul de ancho completo que dice "Finalizar la compra"; y debajo de ese
botón, una fila horizontal con los logos de Visa, Mastercard, Amex y PayPal, cada uno dentro de
su propia píldora blanca pequeña con borde.

**Pantalla C — barra de navegación superior con menú desplegable:**
Barra superior fina y fija, fondo del mismo tono crema/gris claro que el resto del sitio, con
un borde inferior apenas visible. A la izquierda el logo/wordmark "ŌURA" en mayúsculas. Al
centro, cuatro links de texto simple en negro: "Comprar", "Funciones de salud", "Experiencia"
(este último subrayado porque está activo/hover) y "Para organizaciones". A la derecha, un
ícono de carrito de compras con un punto azul pequeño superpuesto (badge de "hay algo en el
carrito"), sin número. Al pasar sobre "Experiencia" se despliega un panel flotante blanco de
esquinas muy redondeadas, con sombra suave, que combina: a la izquierda una tarjeta grande con
una foto (alguien mirando su teléfono) y, superpuesto en la esquina inferior, un texto "Cómo
funciona" con una flechita en un círculo blanco; a la derecha, una lista vertical de 4 opciones
de texto, cada una con un ícono lineal simple (una persona, un círculo, un clip, una mano con
corazón) a la izquierda del texto: "Suscripción a Oura", "Guía de tallaje", "Integraciones",
"Atención a los miembros de Oura".

---

## 0. Regla de color — no copiar el azul de Oura

Oura usa azul como único acento. **La Tribu ya tiene su propio sistema de color** (ver
`apps/web/app/globals.css`): `--cream #FBF7F1`, `--ink #2B2420`, `--ink-soft #6B6058`,
`--gold #D9A441`, `--terracota #C1662F`, `--sage #6B8F71`, `--line #E9E1D6`.

**Regla**: usar `--gold` (o `--terracota` si se prefiere más cálido) como el ÚNICO color de
acento en botones primarios, foco de campos y estados activos — exactamente con la misma
disciplina de "un solo acento, usado con moderación" que tiene Oura con su azul. No introducir
azul ni ningún color nuevo salvo que se decida rediseñar la paleta completa.

Todo lo demás de este brief (formas, espaciado, interacción) sí debe copiarse fiel al ejemplo.

---

## 1. Qué evitar (el look "genérico de IA")

- Sombras duras / `box-shadow` pesado en cards y botones.
- Gradientes decorativos por todos lados.
- Radios de esquina inconsistentes entre componentes (mezcla de `rounded-md`, `rounded-lg`,
  `rounded-full` sin criterio).
- Demasiados colores saturados compitiendo por atención.
- Placeholders que desaparecen al escribir sin dejar rastro de qué campo es (usuario pierde
  contexto al revisar el formulario ya lleno).
- Botones con texto plano sin jerarquía interna.

## 2. Qué adoptar (patrones de las 3 pantallas descritas arriba)

### 2.1 Fondo y superficie
- Fondo de página: neutro cálido, nunca blanco puro ni gris frío → usar `--cream`.
- Cards/inputs: blanco sólido (`--paper` / `#FFFFFF`), sin gradiente.
- Bordes: `1px solid var(--line)`, casi invisibles — el borde separa, no decora.
- Sombra: ninguna o casi nula (`shadow-none` / `shadow-sm` como máximo). La separación entre
  bloques se logra con espacio en blanco, no con sombra.
- Radio de esquina: generoso y **consistente** en todo el sistema — `16px`–`24px` en cards e
  inputs, `rounded-full` (pill) en botones y badges. Ya existe `--radius: 16px` en el proyecto;
  usarlo como base y `rounded-full` explícito para botones/pills.

### 2.2 Inputs con floating label (Pantalla A)

El label empieza **dentro** del campo como placeholder. Al hacer foco (o si ya tiene contenido),
sube y queda flotando arriba del campo, en tamaño reducido — el usuario nunca pierde de vista
qué campo es, incluso ya lleno. El campo enfocado muestra borde de acento (`--gold`), sin glow
exagerado.

Implementación (Tailwind, técnica `peer` — ya funciona con la config actual del proyecto):

```tsx
<div className="relative">
  <input
    id="direccion"
    type="text"
    placeholder=" "
    className="peer h-14 w-full rounded-2xl border border-[var(--line)] bg-white px-4 pt-4 text-sm text-[var(--ink)] placeholder-transparent outline-none transition-colors focus:border-[var(--gold)] focus:ring-4 focus:ring-[var(--gold)]/10"
  />
  <label
    htmlFor="direccion"
    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--ink-soft)] transition-all duration-150 peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-[var(--gold)] peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs"
  >
    Dirección*
  </label>
</div>
```

Puntos no negociables de esta técnica:
- El `input` necesita `placeholder=" "` (un espacio, no vacío) para que `:placeholder-shown`
  funcione como gatillo de "campo con contenido".
- El label debe tener `pointer-events-none` (si no, bloquea el click al campo).
- Reutilizar este patrón como el único tipo de input de texto del sistema — no mezclar con el
  estilo de label-arriba-fijo que tiene el login actual.

### 2.3 Botones (pill)

- Forma: `rounded-full`, padding generoso (`px-6 py-3`).
- Color primario: fondo `--gold` (o `--ink` para variante oscura tipo "Finalizar la compra"),
  texto blanco o `--ink` según contraste.
- Jerarquía interna del texto: la palabra clave en negrita, el resto en peso normal — patrón
  visto en "**Siguiente:** Dirección de facturación".
- Variante secundaria/outline: borde `1px solid var(--line)`, fondo blanco, mismo radio pill —
  usada para acciones no-primarias (ej. el botón "Añadir" de la Pantalla B).

```tsx
<button className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-6 py-3 text-sm text-white transition hover:brightness-95">
  <span className="font-semibold">Siguiente:</span> Dirección de facturación
</button>

<button className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-sm text-[var(--ink)] transition hover:bg-[var(--cream)]">
  Añadir
</button>
```

### 2.4 Cards de resumen / checkout (Pantalla B)

Patrón de dos columnas: contenido principal a la izquierda, resumen/CTA en card aparte a la
derecha (o abajo en mobile) — útil para cualquier flujo de La Tribu con "revisar antes de
confirmar" (ej. onboarding, wizard de plan, checkout futuro):

- Card blanca, borde sutil, radio `16-20px`, sin sombra.
- Imagen/thumbnail con su propio radio interno (`rounded-xl`), nunca a sangre completa.
- Fila de precio: label a la izquierda, monto alineado a la derecha, mismo tamaño de fuente.
- Checkbox simple cuadrado (no custom-styled de más) para opciones tipo "Es un regalo".
- Card de resumen con el CTA primario full-width al final, y una fila secundaria de iconos
  (métodos de pago en el ejemplo — en La Tribu podría ser badges de confianza/seguridad).

### 2.5 Nav superior + mega-menú (Pantalla C)

Este patrón aplica sobre todo a páginas públicas/marketing (landing, no al dashboard interno
que ya usa Sidebar — ver Bloque 2 del plan de migración). Si se construye alguna página pública:

- Barra superior fina, fondo `--cream` o blanco, borde inferior sutil (`1px solid var(--line)`).
- Logo/wordmark a la izquierda, links de texto simple (sin botones) centrados/izquierda, ícono
  de acción (carrito/notificaciones) a la derecha con badge de punto (`--gold`) para estado
  "hay algo nuevo".
- Link activo: `underline underline-offset-4`, sin cambiar de color drásticamente.
- Mega-menú: panel blanco flotante debajo del nav, `rounded-2xl`, sin sombra dura — combina una
  imagen destacada (con su propio link) a un lado y una lista vertical de links con **icono
  lineal monocromo + texto** al otro. Nada de iconos a color ni ilustraciones.

## 3. Alcance y vigencia

- Esto es una **convención permanente del proyecto**, no una tarea de un bloque específico.
  Se aplica automáticamente a todo lo que se construya de aquí en adelante — Fase 1, Fase 2,
  Fase 3... sin excepción y sin que haga falta repetirlo al pedir cada bloque.
- Cuando se registre el `ThemeProvider`/variables CSS (Bloque 3), estos patrones (floating
  label, botón pill, card sin sombra) deben quedar ahí como la base del sistema, no como
  excepción puntual de un componente.
- Los 21 componentes reutilizables (Bloque 13: `SegmentedControl`, `KpiTile`, etc.) y cualquier
  formulario (onboarding, altas de cliente, wizards) deben seguir este mismo lenguaje desde que
  se creen — no como un pase de refactor posterior.
- **Única excepción**: el login (`apps/web/app/(auth)/login/page.tsx`, Fase 0, ya migrado) tiene
  su propio sistema de tema día/noche recién implementado — no tocarlo al aplicar este
  documento. Todo lo demás, sin excepción.
