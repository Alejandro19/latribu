# Descanso — Herramientas para Dormir (Rest Tools) Bank (Design Spec)

## Contexto

Investigación de esta sesión reveló que "rest tools", originalmente anotado en memoria como el sub-proyecto #5 de Entrenamiento, en realidad pertenece a un módulo legacy completamente separado: **Descanso** (autoservicio, abierto a los 3 tipos de cliente, con su propio ítem de navegación — no forma parte de Entrenamiento). Descanso se descompuso en 3 piezas independientes:

1. **Herramientas para dormir (Rest Tools)** — este spec.
2. Registro rápido de sueño (sleep-log + hero widget) — deferred.
3. Protocolo de sueño (personalizado por mentor + genérico de 4 pilares) — deferred.

Este spec cubre únicamente la #1: un banco **global** (no por cliente) de herramientas para dormir, con CRUD admin (incluyendo subida de audio) y una experiencia de cliente con temporizador, reproductor de audio o diario efímero, según el tipo de herramienta.

Sin corte de producción — `server.js`/`index.html` siguen corriendo en paralelo.

## Objetivo

Portar al nuevo stack:
- Tabla `rest_tools` (banco global) + auto-siembra de 3 herramientas por defecto la primera vez que se consulta vacía.
- CRUD admin completo, incluyendo subida/reemplazo/eliminación de audio propio por herramienta (Supabase Storage).
- Vista de cliente: lista de herramientas activas, cada una con su interacción según `action`:
  - `'write'` → diario de descarga mental efímero (nunca se guarda).
  - `'play'` sin audio → temporizador de cuenta regresiva (o "Reproduciendo…" si duración es 0).
  - `'play'` con audio → reproductor de audio inline con toggle.

## Decisiones de alcance (aprobadas)

| Punto | Decisión |
|---|---|
| Auto-siembra de 3 defaults | **Incluir** — mismo comportamiento que el legacy: `GET /rest-tools` en tabla vacía inserta "Sonidos para dormir", "NSDR · Descanso profundo sin dormir", "Diario de descarga mental" y los retorna. |
| Ubicación de páginas | **Dos páginas nuevas independientes**: `/admin/rest-tools` (CRUD admin, banco global — no hay selector de cliente porque no es un recurso por cliente) y `/rest` (vista de cliente). Mismo patrón de alcanzar por URL directa que `/admin/phrases` y `/training`. |
| Sleep-log y protocolo de sueño | **Fuera de alcance** — sub-proyectos futuros e independientes de Descanso. `/rest` en este spec solo muestra la tarjeta de herramientas, sin hero de sueño ni protocolo. |

## Arquitectura

### Backend (`apps/api`)

**Nueva tabla** (`apps/api/src/models/schema.ts`):
```ts
export const restTools = pgTable('rest_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  meta: text('meta'),
  action: text('action').notNull(),
  minutes: integer('minutes'),
  seconds: integer('seconds'),
  audioUrl: text('audio_url'),
  audioName: text('audio_name'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
export type RestTool = typeof restTools.$inferSelect;
```

**`apps/api/src/storage/index.ts` — extensión**:
- `deleteFile(publicUrl: string): Promise<void>` — puerto de `deleteOldStorageFile` del legacy (`server.js:36-42`): extrae el path desde el marcador `/storage/v1/object/public/${BUCKET}/` en la URL pública, `decodeURIComponent`, `.remove([path])`; no lanza si `publicUrl` es null/vacío, no matchea el bucket, o falla la eliminación (catch silencioso, igual que el legacy).

**`rest-tools.service.ts` (nuevo)**:
- `DEFAULT_REST_TOOLS` — array constante con las 3 herramientas por defecto (mismo texto/valores que el legacy: `server.js:1091-1095`).
- `listActiveForClient(): Promise<RestTool[]>` — si la tabla está vacía, inserta `DEFAULT_REST_TOOLS` (con `sortOrder` 0/1/2); luego retorna solo `active`, ordenadas por `sortOrder`.
- `listAllForAdmin(): Promise<RestTool[]>` — todas, ordenadas por `sortOrder`.
- `createTool(input: { name, meta, action, minutes, seconds }): Promise<RestTool>`.
- `updateTool(id: string, patch: Partial<{...}>): Promise<RestTool | null>` — si `patch.audioUrl === null`, llama `deleteFile` sobre el `audioUrl` existente antes de actualizar.
- `deleteTool(id: string): Promise<void>` — borra la fila; si tenía `audioUrl`, llama `deleteFile`.
- `uploadAudio(id: string, file: { buffer, mimetype, originalname }): Promise<RestTool>` — sube con `uploadFile(`rest-tools/${id}`, ...)`, actualiza `audioUrl`/`audioName`; si ya había un audio previo, lo borra con `deleteFile` después de actualizar.

**Rutas** (`apps/api/src/routes/rest-tools.routes.ts`, montadas en `/api`):
```
GET    /rest-tools                          authMiddleware
GET    /admin/rest-tools                    authMiddleware, adminOnly
POST   /admin/rest-tools                    authMiddleware, adminOnly
PUT    /admin/rest-tools/:id                authMiddleware, adminOnly
DELETE /admin/rest-tools/:id                authMiddleware, adminOnly
POST   /admin/rest-tools/:id/upload-audio   authMiddleware, adminOnly, multer(memoryStorage)
```
`GET /rest-tools` no lleva `ownerOrAdmin` ni `requirePermission` — el módulo es autoservicio, abierto a los 3 tipos de cliente, solo requiere sesión válida (a diferencia de Entrenamiento).

### Frontend (`apps/web`)

- `lib/rest-tools-client.ts` (nuevo): `type RestTool = { id, name, meta, action, minutes, seconds, audioUrl, audioName, active, sortOrder }`; `listRestTools(): Promise<RestTool[]>`; `listAllRestTools(): Promise<RestTool[]>`; `createRestTool(input)`, `updateRestTool(id, patch)`, `deleteRestTool(id)`, `uploadRestToolAudio(id: string, file: File): Promise<RestTool>` (usa `FormData`), `removeRestToolAudio(id: string): Promise<RestTool>` (envoltorio de `updateRestTool(id, { audioUrl: null, audioName: null })`).
- `components/rest/RestToolsAdminPanel.tsx` (nuevo): formulario de creación (nombre, tipo `<select>`, duración min:seg condicional al tipo, descripción, audio opcional), lista con editar/eliminar, formulario de edición inline con reproductor de audio existente + "Subir audio"/"Reemplazar audio"/"Quitar audio" independientes del guardado de texto.
- `components/rest/RestToolsClientPanel.tsx` (nuevo): lista de herramientas activas; por cada una, botón según `action`/`audioUrl`:
  - `'write'` → "Escribir" abre/cierra un textarea efímero (estado local únicamente, nunca se envía).
  - `'play'` con `audioUrl` → toggle "Reproducir"/"Ocultar" mostrando/ocultando un `<audio controls autoPlay>`.
  - `'play'` sin `audioUrl` → "Reproducir" inicia cuenta regresiva `minutes:seconds` (o "Reproduciendo…" si ambos son 0/null) con botón "Detener"; solo una herramienta puede tener temporizador activo a la vez.
- `app/admin/rest-tools/page.tsx` (nuevo): monta `RestToolsAdminPanel`.
- `app/rest/page.tsx` (nuevo): monta `RestToolsClientPanel`.

## Manejo de errores

- CRUD admin: errores de red/validación se muestran inline (mensaje corto, no `alert()`); nombre vacío bloqueado en cliente antes de enviar, además del 400 del backend.
- Subida de audio es una llamada independiente del guardado de texto — si falla, el resto de los campos ya guardados no se pierde, y puede reintentarse sola.
- `deleteFile` nunca lanza (catch silencioso), igual que el legacy — limpieza de storage es best-effort.
- Vista de cliente: si `GET /rest-tools` falla, se muestra un mensaje de error simple; una vez cargada la lista, el temporizador/reproductor son puramente cliente-side, sin llamadas de red que puedan fallar a mitad de uso.
- El diario efímero nunca llama a ningún endpoint — no hay error de red posible en ese flujo.

## Testing

- `apps/api`: Vitest contra DB real.
  - Auto-siembra: `GET /rest-tools` en tabla vacía crea los 3 defaults y los retorna; una segunda llamada no duplica.
  - Filtrado/orden: `GET /rest-tools` retorna solo `active`, ordenadas por `sortOrder`; `GET /admin/rest-tools` retorna todas (incluidas inactivas).
  - CRUD admin: crear (rechaza nombre vacío)/editar/eliminar; `PUT` con `audioUrl: null` dispara `deleteFile` (mockeado) sobre la URL anterior; `DELETE` de una herramienta con audio también limpia el storage.
  - `POST /upload-audio`: sube y actualiza `audioUrl`/`audioName`; reemplazar un audio existente borra el anterior.
  - Gating: `GET /rest-tools` acepta cualquier cliente autenticado (sin requerir `ownerOrAdmin`); las 5 rutas `/admin/rest-tools*` rechazan un token de cliente (403).
- `apps/web`: tests mockeados.
  - `RestToolsAdminPanel`: crear/editar/eliminar disparan las llamadas correctas; subir/reemplazar/quitar audio.
  - `RestToolsClientPanel`: botón correcto según `action`/`audioUrl` (write → Escribir, play sin audio → Reproducir con timer, play con audio → Reproducir/Ocultar con `<audio>`); el diario abre/cierra sin llamar ningún wrapper de red; el timer cuenta regresivamente hasta 0 y se detiene; solo un temporizador activo a la vez.

## Fuera de alcance

- Sleep-log (registro rápido de horas/calidad + hero widget) — sub-proyecto futuro de Descanso.
- Protocolo de sueño (personalizado por mentor + genérico de 4 pilares) — sub-proyecto futuro de Descanso.
- Navegación/menú compartido — `/rest` y `/admin/rest-tools` se alcanzan por URL directa, igual que `/training` y `/admin/phrases`.
- Corte de producción / apagado del stack legacy.

## Riesgos

- Ninguno significativo — CRUD estándar + interacciones cliente-side simples (timer, audio toggle, textarea efímero) sobre patrones ya establecidos (endpoints admin-only, subida de archivos vía `uploadFile`, paneles de formulario + lista).
- Sin corte de producción — riesgo nulo para el stack legacy.

## Tiempo estimado

Comparable a "Compartir Tarjeta a Instagram" en alcance: una tabla nueva + CRUD admin con subida de archivos + una interacción de cliente con 3 modos distintos (write/play-sin-audio/play-con-audio). Estimo 7-8 tareas TDD.
