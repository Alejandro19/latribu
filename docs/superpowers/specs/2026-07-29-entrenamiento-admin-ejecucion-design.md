# Entrenamiento — Admin & Ejecución (Design Spec)

## Contexto

LATRIBU está migrando de un monolito (`server.js` + `index.html`) a un stack en capas (`apps/api` Express+TS, `apps/web` Next.js App Router, `packages/shared-types` Zod). Fundación, Información Personal y el Wizard de Onboarding ya están migrados y en `main`. Este es el primer sub-proyecto del módulo Entrenamiento — el mayor módulo legacy restante, dividido en 5 sub-proyectos independientes:

1. **Admin & Ejecución** (este spec) — núcleo del módulo: configuración admin de días/ejercicios, y el flujo completo del cliente para ejecutar su plan.
2. Racha, protector y confirmación NFC (deferred — depende de este spec para su UI de streak/protector, pero este spec ya incluye una versión mínima de `confirm-session` para no bloquear el flujo de "completar día").
3. Compartir tarjeta a Instagram (deferred).
4. Quotes/Phrases (deferred).
5. Rest tools (deferred).

Sin corte de producción todavía — `server.js`/`index.html` siguen corriendo en paralelo, cero tráfico real en el nuevo stack.

## Objetivo

Portar al nuevo stack:
- El CRUD de ejercicios por cliente (admin), agrupado por día (1-7) y categoría (`warmup`/`strength`/`cardio`).
- La configuración de días de entrenamiento del cliente (`training_days`).
- El flujo de ejecución del cliente: home (tiles de día + calendario de disciplina), vista de día (tiles de categoría con lock-order), reproductor de ejercicio (video, KPIs, temporizador de descanso, navegación).
- Una versión mínima de `POST /training/confirm-session` (solo inserta `training_completions`, sin racha/protector/frase/logros) para que el botón "Completar Entrenamiento Día N" funcione end-to-end.

## Decisiones de alcance (aprobadas)

| Punto | Decisión |
|---|---|
| Botón "Completar día" vs. dependencia de racha/protector (sub-proyecto #2) | Incluir un `confirm-session` **mínimo** ahora: inserta `training_completions` calculando el día automáticamente (siguiente no completado de la semana), sin streak/protector/phrase/achievements. El sub-proyecto #2 extenderá la respuesta de este mismo endpoint. |
| `ClientUpdateInputSchema` (código ya fusionado, fuera del alcance original de este spec) acepta `trainingDays`/`assignedQuoteId` vía `PUT /api/clients/:id`, que es `ownerOrAdmin` — un cliente podría auto-asignarse sus propios días de entrenamiento, saltándose el endpoint admin-only dedicado. Hallazgo surgido al planear este sub-proyecto, sin UI que lo explote hoy. | **Corregir ahora**: quitar ambos campos de `ClientUpdateInputSchema` como parte de este plan. |
| Subida de video propio (`upload-video`, sin UI legacy conectada) | **No portar.** Solo `youtubeUrl` en el formulario de ejercicio. |
| Reorder de ejercicios (legacy no tiene ninguno; `sort_order` nunca se setea) | **Agregar reorder simple**: botones subir/bajar en el panel admin que hacen swap de `sort_order` entre el ejercicio y su vecino. |
| Persistencia de "ejercicio completado" (legacy es memory-only, se pierde al recargar) | **Mantener session-only** — estado en memoria del componente cliente, no se persiste en backend. |
| Inconsistencia edit-form vs create-form (edit no oculta series/reps/duration por categoría) | **Unificar**: ambos formularios usan el mismo toggle condicional por categoría. |
| Columna `video_visible` (nunca leída/escrita en el cliente legacy) | **No portar** — no se agrega al nuevo schema/tipo. |

## Arquitectura

### Backend (`apps/api`)

**Middleware nuevo, genérico y reutilizable por futuros módulos:**
- `middleware/require-permission.middleware.ts` — puerto de `requirePermission(moduleKey)` del legacy (server.js:311-323). Admin siempre pasa. Para `client_type === 'lead_wellness'`, bloquea módulos en `LEAD_BLOCKED_MODULES = ['training', 'nutrition', 'supplementation']`. Si `req.client.permissions[moduleKey] === false`, bloquea con 403. `req.client` ya trae `permissions`/`clientType` vía `ClientAuthRow` (`apps/api/src/services/clients.service.ts:17-23`) — no requiere cambios en `authMiddleware`.

**Nuevo módulo `training`:**
- `services/exercises.service.ts` — `listExercisesByClient(clientId)`, `createExercise(clientId, input)`, `updateExercise(exerciseId, input)`, `deleteExercise(exerciseId)`, `swapExerciseOrder(exerciseId, direction: 'up'|'down')` (lee el ejercicio y su vecino inmediato en el mismo día+categoría por `sortOrder`, intercambia valores).
- `services/training.service.ts` — `updateTrainingDays(clientId, days)`, `listTrainingCompletions(clientId)`, `confirmSession(clientId, { tz })` (versión mínima: calcula `today`/`weekStart` en la tz dada, cuenta completions de la semana, inserta el siguiente `dayNumber` no completado si no hay uno ya para hoy — puerto directo de server.js:1305-1334 sin el bloque de `streak`/`phrase`).
- `controllers/exercises.controller.ts`, `controllers/training.controller.ts`
- `routes/exercises.routes.ts`, `routes/training.routes.ts` — montados en `app.ts` bajo `/api`.

**Endpoints:**
```
GET    /api/clients/:id/exercises                      ownerOrAdmin, requirePermission('training')
POST   /api/clients/:id/exercises                      adminOnly
PUT    /api/clients/:id/exercises/:exerciseId          adminOnly
DELETE /api/clients/:id/exercises/:exerciseId          adminOnly
PATCH  /api/clients/:id/exercises/:exerciseId/order    adminOnly   body: { direction: 'up' | 'down' }
PATCH  /api/clients/:id/training-days                  adminOnly   body: { trainingDays: 1-7 }
GET    /api/clients/:id/training-completions           ownerOrAdmin, requirePermission('training')
POST   /api/clients/:id/training/confirm-session       ownerOrAdmin, requirePermission('training')   body: { tz }
```

**Zod schemas (`packages/shared-types`):**
```ts
export const ExerciseCategorySchema = z.enum(['warmup', 'strength', 'cardio']);

export const ExerciseInputSchema = z.object({
  title: z.string().min(1),
  day_number: z.coerce.number().int().min(1).max(7),
  category: ExerciseCategorySchema,
  series: z.coerce.number().int().min(1).nullable().optional(),
  reps: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  rest_time: z.string().nullable().optional(),
  youtube_url: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  recommendations: z.string().nullable().optional(),
});

export const ExerciseOrderPatchSchema = z.object({
  direction: z.enum(['up', 'down']),
});

export const TrainingDaysPatchSchema = z.object({
  training_days: z.coerce.number().int().min(1).max(7),
});

export const ConfirmSessionInputSchema = z.object({
  tz: z.string().min(1),
});
```
Nota: request bodies siguen la convención snake_case ya establecida por `personal-info.ts` (coincide con los JSON bodies del legacy); las respuestas GET son filas crudas de Drizzle y por lo tanto camelCase (`dayNumber`, `youtubeUrl`, etc.) — ambas convenciones conviven en el codebase y no se normalizan entre sí. `series`/`reps` obligatorios solo cuando `category !== 'cardio'`; `duration` obligatorio solo cuando `category === 'cardio'` — esta validación condicional se hace en el frontend (mismo patrón `toggleExerciseCategoryFields` unificado) y no se codifica como refinement de Zod, ya que el legacy tampoco lo valida server-side (los campos llegan como texto libre opcional en ambos casos).

### Frontend (`apps/web`)

**Nueva sección `/admin/clients/[id]` (panel admin) y ruta cliente `/training`:**
- `components/training/AdminExercisePanel.tsx` — config de `trainingDays` + formulario crear ejercicio (con toggle condicional) + acordeón de ejercicios por día (editar inline con el mismo toggle, eliminar, subir/bajar orden).
- `components/training/TrainingHome.tsx` — tiles de día (bloqueado/desbloqueado/completado-esta-semana), calendario de disciplina mensual, hero con CTA "Comenzar sesión".
- `components/training/TrainingDayView.tsx` — tiles de categoría con lock-order fijo (warmup→strength→cardio, categorías sin ejercicios asignados se omiten de la secuencia), botón "Completar Entrenamiento Día N".
- `components/training/TrainingPlayer.tsx` — video YouTube-embed-only, KPIs condicionales por categoría, temporizador de descanso (parseo `mm:ss` o número suelto, fallback silencioso a 30s), avance automático, navegación anterior/siguiente, countdown de duración para cardio encadenado al descanso post-ejercicio.
- `lib/training-client.ts` — wrappers `listExercises`, `createExercise`, `updateExercise`, `deleteExercise`, `reorderExercise`, `updateTrainingDays`, `listTrainingCompletions`, `confirmSession`.
- Estado de sesión (`day`, `category`, `index`, `completed: Record<string, boolean>`) vive en un `useState` dentro de un componente orquestador `TrainingShell.tsx` (equivalente a `WizardShell`), pasado por props — no en `window` como el legacy.

## Testing

- `apps/api`: Vitest contra DB de test real. Cobertura: CRUD de ejercicios (incluye reorder — swap correcto entre vecinos, sin afectar otros días/categorías), `training-days` patch (rechaza fuera de 1-7), `confirm-session` (calcula el día correcto, no duplica si ya hay confirmación hoy, respeta `tz`), `requirePermission` (bloquea lead_wellness en `training`, respeta `permissions.training === false`, admin siempre pasa).
- `apps/web`: tests mockeados de componentes (patrón WizardShell). Cobertura: toggle de campos por categoría (create y edit, ahora unificado), lock-order de categorías (`getCategoryLockState` portado), gating del botón "completar día" (solo habilitado cuando todas las categorías asignadas están completas), temporizador de descanso (avance automático al llegar a 0, "saltar descanso" manual), reorder (botones deshabilitados en los extremos de cada grupo día+categoría).

## Fuera de alcance

- Quotes/Phrases (sub-proyecto #4).
- Rest tools (sub-proyecto #5).
- Racha, protector, logros (achievements), frase post-sesión, tarjeta compartible a Instagram (sub-proyecto #2 y #3) — `confirm-session` en este spec es deliberadamente mínimo.
- Subida de video propio (`upload-video`) y columna `video_visible`.
- Corte de producción / apagado del stack legacy.

## Riesgos

- El contrato mínimo de `confirm-session` deberá extenderse (no reemplazarse) cuando se construya el sub-proyecto #2 — se documenta explícitamente para que ese spec futuro lo tenga en cuenta.
- El reorder por swap es una mejora nueva sin equivalente probado en legacy; riesgo bajo pero real de ajuste menor post-implementación si el modelo de `sortOrder` con huecos causa comportamiento inesperado.
- Sin corte de producción — riesgo nulo para el stack legacy.

## Tiempo estimado

Comparable en tamaño al plan del Wizard de Onboarding (10 tareas): 8-10 tareas TDD, cubriendo middleware nuevo, 2 módulos de backend, y 4 componentes de frontend más el shell orquestador.
