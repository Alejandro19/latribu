# Información Personal — Migración Arquitectónica de LATRIBU — Design

## Contexto

Segundo sub-proyecto de la migración mayor de LATRIBU: **Fundación** (Auth +
Clientes/Admin, ya fusionado en `main`) → **Información Personal** (este
spec) → Entrenamiento → Pagos → Wearables → Agentes de IA — cada uno con su
propio ciclo spec → plan → implementación.

Fundación dejó construido el patrón: monorepo con `apps/api` (Express+TS en
capas Routes→Controllers→Services→Models), `apps/web` (Next.js App Router),
`packages/shared-types` (Zod), Drizzle sobre Postgres directo, Vitest contra
una base de datos de pruebas dedicada. Este spec repite ese patrón para el
módulo "Información Personal" tal como existe hoy en `server.js`/`index.html`
bajo el comentario `// Información Personal (módulos 1-9, sin módulo 10)`.

Todo el código nuevo vive en el mismo repo, junto al legacy — no hay corte de
producción todavía. Cuando todos los módulos estén migrados, se decide el
corte: `server.js`/`index.html` se **eliminan** y `apps/api`/`apps/web` pasan
a ser la app real. No hay fusión de código viejo y nuevo — es reemplazo
completo en un solo momento, no una convivencia indefinida.

## Objetivo

Migrar completamente el backend de "Información Personal": datos
estructurados del perfil (módulos 1 y 3, ya con columnas propias en
`personal_info`), historial antropométrico, fotos de progreso, registros
InBody, las 3 subidas de archivo asociadas (chequeo médico, fotos, InBody), y
el proxy de OCR (Google Cloud Vision + fallback `pdf-parse`) que alimenta el
registro de InBody. Construir una página de referencia en `apps/web` —
detalle de cliente para el admin, de solo lectura — que consuma este backend
de punta a punta, igual que Fundación hizo con `admin/clients`.

**Explícitamente fuera de alcance de este spec:** el wizard de onboarding de
7 sub-módulos (Vida Profesional, Historial de Salud, Alimentación, Sueño,
Energía/Cognición, Estrés/Emociones, Entrenamiento Físico — ~70 campos con
lógica condicional y widgets personalizados) que el cliente llena y que hoy
se guarda como JSON libre en `personal_info.onboarding_report`. Es
sustancialmente más grande que el resto de este spec junto y merece su
propio ciclo de diseño de UI. Este spec valida y persiste ese JSON como un
blob opaco (`z.record(z.string(), z.unknown())`), sin tipar campo por campo
— eso es trabajo del spec del wizard.

También fuera de alcance: edición desde la vista de admin (es de solo
lectura), cualquier cambio a `server.js`/`index.html`, y el corte de
producción.

## Arquitectura

```
apps/
  api/
    src/
      storage/
        index.ts                    ← NUEVO: wrapper sobre supabase-js Storage
      middleware/
        block-for-lead-wellness.ts  ← NUEVO: puerto de blockForLeadWellness
      services/
        personal-info.service.ts    ← get/upsert por cliente + orquesta subida de chequeo
        anthropometrics.service.ts  ← list/create-o-actualiza-por-mes/delete
        photos.service.ts           ← list/create + sube a Storage
        inbody.service.ts           ← list/create (con recálculo de cadencia) + sube a Storage
        ocr.service.ts              ← proxy a Vision API (fetch nativo) + fallback pdf-parse
      controllers/
        personal-info.controller.ts
        anthropometrics.controller.ts
        photos.controller.ts
        inbody.controller.ts
        ocr.controller.ts
      routes/
        personal-info.routes.ts     ← monta las 4 áreas bajo /api/clients/:id/...
  web/
    app/
      admin/clients/
        page.tsx                    ← MODIFICAR: agregar enlace "Ver detalle"
        [id]/page.tsx               ← NUEVO: detalle de cliente, solo lectura
    lib/
      personal-info-client.ts       ← NUEVO: fetch de las 4 áreas
packages/
  shared-types/
    src/
      personal-info.ts              ← NUEVO: esquemas Zod de las 4 áreas
```

**Modelo de datos:** las 4 tablas (`personal_info`, `anthropometric_records`,
`progress_photos`, `bio_inbody_records`) ya existen en la base de datos real
— este spec añade su espejo en `models/schema.ts` de Drizzle, sin migración
(mismo patrón que Fundación con `admins`/`clients`).

**Storage:** LATRIBU mantiene Supabase Storage sin cambios (decisión ya
tomada en Fundación). `apps/api/src/storage/index.ts` es un wrapper delgado
sobre un cliente `supabase-js` configurado solo para Storage (nunca para la
base de datos — la conexión a Postgres sigue siendo 100% vía Drizzle),
exportando `uploadFile(path, buffer, contentType): Promise<string>` que
sube el archivo y devuelve la URL pública. Las 3 rutas de subida
(`personal-info-file`, `photos`, `inbody-upload`) la reutilizan.

**Middleware:** se reutilizan `authMiddleware`/`ownerOrAdmin` de Fundación.
Se agrega `blockForLeadWellness` (existe en `server.js` pero Fundación no lo
necesitó) — bloquea el acceso a estos endpoints para clientes tipo
`lead_wellness`, igual que el original.

**OCR:** el original hace la llamada a Google Vision con el módulo `https`
de Node a mano; este spec la reimplementa con `fetch` nativo (Node 20+) —
mismo comportamiento exacto (mismo endpoint, mismo payload, mismo manejo de
errores 401/403), sin dependencia nueva, código más simple. Para pruebas,
`ocr.service.ts` expone una costura de inyección de dependencia (mismo
patrón que `setGoogleVerifierForTests` de Fundación) para que los tests
nunca llamen a la API real de Google. El fallback `pdf-parse` sí se prueba
de verdad, con un PDF de prueba fijo en el repo de tests, porque es cómputo
local sin red ni costo.

**Efectos secundarios de completar el onboarding:** cuando `PUT
personal-info` recibe `complete: true`, el original envía un correo de
notificación (`nodemailer`, condicionado a que `EMAIL_HOST`/`EMAIL_PORT`/
`EMAIL_USER`/`EMAIL_PASS`/destino estén configurados — si no, es un no-op
silencioso) y, solo la primera vez que se completa, inserta una fila en
`admin_notifications` (tabla ya modelada en `models/schema.ts` desde
Fundación). Este spec porta ambos efectos tal cual — el envío de correo vive
en `personal-info.service.ts` junto al resto de la lógica de esa tabla, sin
introducir una capa de "notificaciones" nueva.

**Validación:** esquemas Zod nuevos en `packages/shared-types/src/personal-info.ts`
para cada input de escritura (PUT personal-info, POST anthropometrics, POST
inbody-records). El campo `onboarding_report` se valida como
`z.record(z.string(), z.unknown())` — opaco, sin tipar cada uno de los ~70
campos del wizard (fuera de alcance).

**Endpoints** (mismas rutas que `server.js`, para no romper nada del lado
del cliente legacy):

| Método | Ruta | Middleware |
|---|---|---|
| GET | `/api/clients/:id/personal-info` | auth, ownerOrAdmin, blockForLeadWellness |
| PUT | `/api/clients/:id/personal-info` | auth, ownerOrAdmin, blockForLeadWellness |
| POST | `/api/clients/:id/personal-info-file` | auth, ownerOrAdmin, blockForLeadWellness |
| GET | `/api/clients/:id/anthropometrics` | auth, ownerOrAdmin, blockForLeadWellness |
| POST | `/api/clients/:id/anthropometrics` | auth, ownerOrAdmin, blockForLeadWellness |
| DELETE | `/api/clients/:id/anthropometrics/:recordId` | auth, ownerOrAdmin, blockForLeadWellness |
| GET | `/api/clients/:id/photos` | auth, ownerOrAdmin, blockForLeadWellness |
| POST | `/api/clients/:id/photos` | auth, ownerOrAdmin, blockForLeadWellness |
| GET | `/api/clients/:id/inbody-records` | auth, ownerOrAdmin, blockForLeadWellness |
| POST | `/api/clients/:id/inbody-records` | auth, ownerOrAdmin, blockForLeadWellness |
| POST | `/api/clients/:id/inbody-upload` | auth, ownerOrAdmin, blockForLeadWellness |
| POST | `/api/clients/:id/ocr-vision` | auth, ownerOrAdmin, blockForLeadWellness |

**Frontend:** `app/admin/clients/[id]/page.tsx` — ruta dinámica de solo
lectura: perfil estructurado (módulos 1 y 3), historial antropométrico en
tabla, galería de fotos de progreso, registros InBody en tabla. Se agrega un
enlace "Ver detalle" en cada fila de `app/admin/clients/page.tsx` (única
modificación a un archivo existente de Fundación).

## Testing

Mismo principio que Fundación: Vitest contra la base de datos de pruebas
real, nunca mocks para lo que sí se puede probar de verdad.

- Datos estructurados, antropometría e InBody: tests de integración reales
  contra la BD de pruebas.
- Subida de archivos: sube de verdad al bucket de Supabase Storage del
  proyecto de pruebas (mismo `SUPABASE_BUCKET` que usa el stack legacy). El
  plan de implementación verifica primero que el bucket existe en el
  proyecto de pruebas (mismo patrón que Fundación verificó la conexión a
  Postgres antes de construir sobre ella) — si no existe, se crea como parte
  de esa tarea inicial.
- OCR: `pdf-parse` se prueba con un PDF real de prueba; la llamada a Vision
  API se aísla con inyección de dependencia, nunca se llama a Google de
  verdad en los tests.
- Frontend: Vitest + Testing Library, mockeando `lib/personal-info-client.ts`.

## Fuera de alcance (explícito)

- El wizard de onboarding de 70 campos (los 7 sub-módulos de texto libre)
  — spec de UI dedicado, posterior a este.
- Edición desde la vista de admin — es de solo lectura por ahora.
- Cualquier cambio a `server.js`/`index.html`.
- Corte de producción / eliminación del stack legacy.
- Los demás módulos pendientes (Entrenamiento, Nutrición, Cortisol,
  Descanso, Mi Evolución, Comunidad/NFC/tarjeta Instagram) y los
  sub-proyectos mayores (Pagos, Wearables, Agentes de IA).

## Riesgos

- El bucket de Supabase Storage del proyecto de pruebas puede no existir
  todavía — se verifica y, si hace falta, se crea al inicio del plan de
  implementación, igual que se verificó la conexión a Postgres en Fundación.
- El recálculo de `inbody_next_expected_date`/`inbody_reminder_sent_this_cycle`
  al insertar un registro InBody toca la tabla `clients` (ya migrada en
  Fundación) — no es un riesgo de diseño, solo una dependencia cruzada a
  tener presente en el plan (el servicio de InBody necesita `clients.service.ts`
  de Fundación, no solo sus propias tablas).
- Mantener las mismas rutas HTTP que `server.js` es intencional (para que el
  nuevo backend sea un reemplazo directo cuando llegue el corte), pero
  significa que este backend nuevo no tiene todavía ningún consumidor real
  — el mismo patrón de "construido en paralelo, sin tráfico real" que
  Fundación, con el mismo riesgo ya aceptado de que quede como código sin
  usar si el impulso de la migración se pierde.

## Tiempo estimado

1-2 semanas para un desarrollador solo, más corto que Fundación porque el
patrón de capas/Drizzle/Zod/Vitest ya está probado — el trabajo nuevo es
principalmente el módulo de Storage, el puerto de OCR, y la página de
detalle de cliente.
