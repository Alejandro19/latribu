# Entrenamiento — Frases (Card RR.SS) y Frases de Mentalidad: Admin CRUD (Design Spec)

## Contexto

Cuarto sub-proyecto del módulo Entrenamiento, tras "Admin & Ejecución", "Racha, Protector y Confirmación NFC" y "Compartir tarjeta a Instagram" (los tres mergeados). El legacy bundlea dos bancos de frases distintos en una sola página admin ("Frases"):

- **`phrases`** ("Frases Card RR.SS") — ya existe en el stack nuevo como tabla y como lectura (`pickRandomPhrase`, usado por `confirm-session` y la tarjeta de Instagram). Hoy no tiene CRUD admin en el stack nuevo.
- **`mindset_quotes`** ("Biblioteca de frases de mentalidad") — no portado aún en absoluto. Afirmaciones en primera persona, asignables por cliente (`assignedQuoteId`, ya existe como columna en `clients` pero sin uso) o aleatorias de un pool activo, mostradas como banner arriba de `TrainingHome`: "Hola [nombre], repite después de mí: [frase]".

El módulo Entrenamiento sigue dividido en 5 sub-proyectos:

1. Admin & Ejecución (mergeado).
2. Racha, Protector y Confirmación NFC (mergeado).
3. Compartir tarjeta a Instagram (mergeado).
4. **Frases (Card RR.SS) y Frases de mentalidad — Admin CRUD** (este spec).
5. Rest tools (deferred).

Sin corte de producción — `server.js`/`index.html` siguen corriendo en paralelo.

## Objetivo

Portar al nuevo stack:
- CRUD admin completo para `phrases` (crear, editar, activar/desactivar, eliminar, filtrar por contexto, preview con "Probar otra").
- Una tabla nueva `mindset_quotes` + CRUD admin (crear, editar, eliminar — sin toggle activo/inactivo en la UI, igual que el legacy).
- Asignación de una frase de mentalidad específica por cliente (o "aleatoria del pool general"), en `admin/clients/[id]`.
- El banner de afirmación en `TrainingHome`, mostrando la frase asignada o una aleatoria del pool activo.
- Una página admin combinada nueva (`/admin/phrases`) con ambos paneles, espejo de la página legacy.

## Decisiones de alcance (aprobadas)

| Punto | Decisión |
|---|---|
| Mostrar el banner de afirmación al cliente | **Incluir** en este sub-proyecto — de lo contrario el CRUD admin no tiene efecto visible hasta un sub-proyecto futuro. |
| Layout de la página admin | **Una sola página combinada** (`/admin/phrases`), con dos paneles (Frases Card RR.SS / Biblioteca de frases de mentalidad), espejo del legacy. |
| Toggle activo/inactivo en `QuotesPanel` | **No incluir** — el legacy expone este campo en el PATCH pero nunca lo controla desde la UI de quotes (solo desde edición de texto/autor). Se mantiene la misma paridad, sin inventar UI que el legacy no tiene. |

## Arquitectura

### Backend (`apps/api`)

**Nueva tabla** (`apps/api/src/models/schema.ts`):
```ts
export const mindsetQuotes = pgTable('mindset_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  quote: text('quote').notNull(),
  author: text('author'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
export type MindsetQuote = typeof mindsetQuotes.$inferSelect;
```

**`training.service.ts` — extensión** (las `phrases` ya viven aquí):
- `listAllPhrases(): Promise<Phrase[]>` — todas, sin filtrar por `active` (a diferencia de `getPhraseByContext`).
- `createPhrase(text: string, context: string): Promise<Phrase>`.
- `updatePhrase(id: string, patch: { text?: string; context?: string; active?: boolean }): Promise<Phrase | null>`.
- `deletePhrase(id: string): Promise<void>`.
- `drawPreviewPhrase(context: string, excludeId?: string): Promise<Phrase | null>` — como `pickRandomPhrase`, pero excluye `excludeId` del pool elegible cuando hay más de una candidata (igual que el legacy: `candidates = (excludeId && eligible.length > 1) ? eligible.filter(p => p.id !== excludeId) : eligible`).

**`quotes.service.ts` (nuevo)**:
- `listQuotes(): Promise<MindsetQuote[]>`.
- `createQuote(quote: string, author: string | null): Promise<MindsetQuote>`.
- `updateQuote(id: string, patch: { quote?: string; author?: string | null; active?: boolean }): Promise<MindsetQuote | null>`.
- `deleteQuote(id: string): Promise<void>`.
- `getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null>` — si `client.assignedQuoteId` existe y resuelve a una quote, la retorna (sin filtrar por `active` — igual que el legacy: una frase asignada explícitamente se muestra aunque esté desactivada); si no, una aleatoria del pool `active`; `null` si no hay ninguna.
- `assignQuote(clientId: string, quoteId: string | null): Promise<Client | null>` — actualiza `clients.assignedQuoteId`.

**Rutas nuevas**:
```
GET    /api/admin/phrases              adminOnly
POST   /api/admin/phrases              adminOnly   { text, context }
PATCH  /api/admin/phrases/:id          adminOnly   { text?, context?, active? }
DELETE /api/admin/phrases/:id          adminOnly
GET    /api/admin/phrases/random       adminOnly   ?context=&exclude=

GET    /api/admin/quotes               adminOnly
POST   /api/admin/quotes               adminOnly   { quote, author? }
PATCH  /api/admin/quotes/:id           adminOnly   { quote?, author?, active? }
DELETE /api/admin/quotes/:id           adminOnly

GET    /api/clients/:id/quote-of-the-day    ownerOrAdmin, requirePermission('training')
PATCH  /api/clients/:id/assigned-quote      adminOnly   { quote_id: string | null }
```
Las dos primeras familias viven en routers nuevos montados en la raíz `/api` (`admin-phrases.routes.ts`, `admin-quotes.routes.ts`), igual que `geoRouter`. Las dos últimas se agregan a `training.routes.ts` (ya montado en `/api/clients`).

`context` inválido en create/update de phrases → 400 (validación manual, mismo patrón que el endpoint de lectura ya existente). `text`/`quote` vacío → 400 ("La frase no puede estar vacía"). `PATCH /assigned-quote` es un endpoint **dedicado y admin-only** — nunca se expone `assignedQuoteId` a través del `PUT` genérico de cliente, por la misma razón de seguridad que ya sacó `trainingDays`/`assignedQuoteId` de `ClientUpdateInputSchema` en el sub-proyecto #1 (Admin & Ejecución).

### Frontend (`apps/web`)

- `lib/phrases-client.ts` (nuevo): `listPhrases()`, `createPhrase({text, context})`, `updatePhrase(id, patch)`, `deletePhrase(id)`, `drawPreviewPhrase(context, excludeId?)`.
- `lib/quotes-client.ts` (nuevo): `listQuotes()`, `createQuote({quote, author?})`, `updateQuote(id, patch)`, `deleteQuote(id)`, `getQuoteOfTheDay(clientId)`, `assignQuote(clientId, quoteId | null)`.
- `components/admin/PhrasesPanel.tsx` (nuevo): formulario de nueva frase (texto + contexto), filtro por pills (Todas/Confirmación/Instagram/Ambas), lista con toggle activa/inactiva + editar + eliminar, bloque de preview con "Probar otra" por contexto (confirmación / instagram) usando `drawPreviewPhrase`.
- `components/admin/QuotesPanel.tsx` (nuevo): formulario de nueva quote (texto + autor opcional), lista con editar + eliminar (sin toggle activo/inactivo).
- `app/admin/phrases/page.tsx` (nuevo): monta ambos paneles, carga ambas listas en paralelo (`Promise.all`).
- `components/training/TrainingHome.tsx` (modificado): nuevo prop `quote: { quote: string; author: string | null } | null`; si no es `null`, renderiza un banner arriba ("Hola {nombre}, repite después de mí:" + el texto de la quote + el autor si existe).
- `components/training/TrainingShell.tsx` (modificado): `load()` también llama `getQuoteOfTheDay(clientId)` (non-fatal: si falla, `quote` queda `null`); pasa el resultado a `TrainingHome` junto al resto de props ya existentes.
- `app/admin/clients/[id]/page.tsx` (modificado): nuevo campo "Frase asignada a este cliente" — `<select>` con las quotes (texto truncado a 60 caracteres si es más largo, igual que el legacy) + opción "Aleatoria del pool general" (`value=""`), llamando `assignQuote(clientId, quoteId || null)` al guardar, junto al flujo de guardado ya existente para días de entrenamiento.

## Manejo de errores

- CRUD admin (ambos paneles): errores de red/validación se muestran inline en el panel correspondiente (mensaje corto, no `alert()`), sin bloquear el resto de la página.
- Validación de texto vacío en frase/quote ocurre también en el cliente antes de enviar, además del 400 del backend.
- Preview draw ("Probar otra"): si no hay frases activas para el contexto, muestra "No hay frases activas para este contexto" (ya es el comportamiento del endpoint — retorna `null`).
- `getQuoteOfTheDay` en `TrainingShell`: non-fatal — si falla, `quote` queda `null` y el banner simplemente no se muestra; no bloquea el resto de `TrainingHome` ni lanza error visible.
- `assignQuote`: error de red se muestra con el mismo patrón ya usado en `admin/clients/[id]` para guardar la configuración de entrenamiento.
- `assigned-quote` es `adminOnly` exclusivamente — nunca a través del `PUT` genérico de cliente.

## Testing

- `apps/api`: Vitest contra DB real.
  - Phrases admin: crear (rechaza texto vacío, rechaza contexto inválido)/editar/activar-desactivar/eliminar; `GET /admin/phrases` lista todas (incluidas inactivas); `GET /admin/phrases/random` excluye el id dado cuando hay más de una candidata elegible, retorna `null` sin elegibles; gating `adminOnly` en las cinco rutas (rechaza token de cliente).
  - Quotes admin: crear (rechaza texto vacío)/editar (`quote`, `author`, `active`)/eliminar; gating `adminOnly` en las cuatro rutas.
  - `GET /quote-of-the-day`: retorna la quote asignada (incluso si `active=false`) cuando `assignedQuoteId` resuelve; retorna aleatoria del pool `active` cuando no hay asignación o la asignada no existe; retorna `null` sin pool; gating `ownerOrAdmin` + `requirePermission('training')`.
  - `PATCH /assigned-quote`: setea `assignedQuoteId`; limpia con `quote_id: null`; gating `adminOnly` (rechaza intento de cliente propio o ajeno).
- `apps/web`: tests mockeados.
  - `PhrasesPanel`: crear/editar/toggle-activa/eliminar disparan las llamadas correctas con los argumentos correctos; filtro por contexto oculta las frases de otros contextos; validación de texto vacío bloquea el envío.
  - `QuotesPanel`: crear/editar/eliminar disparan las llamadas correctas; validación de texto vacío bloquea el envío; no hay botón de toggle activo/inactivo.
  - `TrainingHome`: renderiza el banner solo cuando `quote` no es `null`, con y sin autor; no renderiza nada cuando `quote` es `null`.
  - `TrainingShell`: `getQuoteOfTheDay` fallando no rompe el resto de la carga ni bloquea el render de `TrainingHome`.
  - `admin/clients/[id]`: el select de frase asignada llama `assignQuote` con el id de la quote elegida, o `null` cuando se elige "Aleatoria del pool general".

## Fuera de alcance

- Rest tools (sub-proyecto #5).
- Toggle activo/inactivo para `mindset_quotes` en la UI (el legacy tampoco lo tiene).
- Navegación/menú admin compartido — esta página se alcanza por URL directa, igual que `/training` y `/admin/clients`.
- Corte de producción / apagado del stack legacy.

## Riesgos

- Ninguno significativo — es CRUD estándar sobre patrones ya establecidos (endpoints dedicados admin-only, paneles de formulario + lista, non-fatal fetch para datos secundarios).
- Sin corte de producción — riesgo nulo para el stack legacy.

## Tiempo estimado

Comparable a "Racha, Protector y Confirmación NFC" en alcance (dos tablas/CRUDs + una UI combinada + una integración en `TrainingHome` + una integración en `admin/clients/[id]`). Estimo 8-9 tareas TDD.
