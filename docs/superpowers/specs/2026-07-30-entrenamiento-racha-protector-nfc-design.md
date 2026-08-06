# Entrenamiento — Racha, Protector y Confirmación NFC (Design Spec)

## Contexto

Segundo sub-proyecto del módulo Entrenamiento, tras "Admin & Ejecución" (mergeado 2026-07-29). El módulo Entrenamiento se dividió en 5 sub-proyectos independientes:

1. Admin & Ejecución (mergeado) — CRUD de ejercicios, home/día/reproductor del cliente, `confirm-session` **mínimo** (solo inserta `training_completions`, sin racha/protector/frase/achievements).
2. **Racha, protector y confirmación NFC** (este spec) — extiende `confirm-session` con streak/protector/frase/achievements, agrega el flujo de escaneo NFC.
3. Compartir tarjeta a Instagram (deferred).
4. Quotes/Phrases (deferred — el CRUD admin de frases queda fuera; este spec solo *lee* frases existentes).
5. Rest tools (deferred).

Sin corte de producción — `server.js`/`index.html` siguen corriendo en paralelo.

## Objetivo

Portar al nuevo stack:
- El cálculo de racha semanal (`computeTrainingStreakState`), badge de racha 🔥 y tarjeta de progreso semanal en `TrainingHome`.
- El protector de racha (1 uso por semana calendario, no acumulable).
- La extensión de `confirm-session` con frase motivacional y registro de logros (medallas/copas), manteniendo el contrato ya consumido por `TrainingShell` (extiende, no reemplaza).
- La pantalla "¡Sesión confirmada!" (dark-only, anillo de progreso, puntos de semana, racha, frase).
- El flujo de confirmación vía NFC: deep-link `/training?m=entrenamiento&a=confirmar`, con persistencia de la acción pendiente si el cliente no tiene sesión activa.
- El historial de logros (medallas/copas) en la vista admin.

## Decisiones de alcance (aprobadas)

| Punto | Decisión |
|---|---|
| Frase motivacional en la pantalla de confirmación (tabla `phrases`, pertenece al sub-proyecto #4 Quotes/Phrases) | **Incluir ahora**: agregar el mapeo Drizzle de `phrases` + un `pickRandomPhrase` mínimo, solo para alimentar esta pantalla. No se construye el CRUD admin de frases (eso es #4). |
| Botón "Compartir" (tarjeta Instagram, sub-proyecto #3) | **Deshabilitado/placeholder** — se muestra en el layout pero no funcional, con indicación visual de "Próximamente". |
| Flujo de deep-link NFC (sticker físico → URL → consumo tras login) | **Incluir** — es el núcleo de "confirmación NFC"; sin esto, escanear el sticker no hace nada en el nuevo stack. |
| Vista admin de historial de logros (medallas/copas) | **Incluir** — los inserts de `achievement_logs` ya ocurren dentro de `confirm-session`; portar también el GET admin evita datos huérfanos sin forma de verlos. |

## Arquitectura

### Backend (`apps/api`)

**Drizzle — nuevas tablas** (ya existen en la DB compartida, `schema.sql` líneas 35-42, 205-224; solo falta el mapeo):
```ts
export const phrases = pgTable('phrases', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  context: text('context').notNull(), // 'confirmacion' | 'instagram' | 'ambas'
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const trainingProtectorUses = pgTable('training_protector_uses', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const achievementLogs = pgTable('achievement_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'medalla' | 'copa'
  weekNumber: integer('week_number').notNull(),
  earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow(),
});
```

**`training.service.ts` — extensión:**
- `dowInTz(tz)`, `addDaysISO(iso, days)` — nuevos helpers de fecha, junto a los ya existentes `todayInTz`/`weekStartInTz` del sub-proyecto anterior (mismo archivo).
- `computeTrainingStreakState(clientId, trainingDays, tz)` — puerto directo de server.js:1254-1287: cuenta semanas consecutivas completadas (por sesiones o protector), detecta "en riesgo" (≤2 días restantes de semana sin completar y sin protector usado).
- `getStreak(clientId, tz)`, `useProtector(clientId, tz)` — nuevas funciones de servicio.
- `pickRandomPhrase(pool, context)` — puerto directo de server.js:1004-1008 (filtra por `active` y `context === context || context === 'ambas'`, elige al azar).
- `confirmSession` se **extiende**: tras insertar `training_completions` (lógica ya existente, sin cambios), ahora también dibuja una frase (non-fatal: si falla o no hay frases, `phrase: null`) y calcula `computeTrainingStreakState`. Inserta `achievement_logs` (medalla, y copa cada 4 medallas) **solo** en la transición exacta de "semana incompleta → completa" causada por esta llamada (`justInsertedNewSession && !wasCompletedBeforeThisCall && streak.sessionsDoneThisWeek >= trainingDays`) — nunca disparado por el protector. Respuesta final: `{ alreadyConfirmedToday, dayNumber, streak, phrase }` — el `dayNumber` que ya consume `TrainingShell` se mantiene sin cambios.

**Endpoints nuevos:**
```
GET  /api/clients/:id/training/streak           ownerOrAdmin, requirePermission('training')   query: ?tz=
POST /api/clients/:id/training/use-protector    ownerOrAdmin, requirePermission('training')   body: { tz }
GET  /api/clients/:id/training/achievements     adminOnly
```

### Frontend (`apps/web`)

- `training-client.ts` — nuevas funciones `getStreak(clientId, tz)`, `useProtector(clientId, tz)`, `getAchievements(clientId)`; el tipo de retorno de `confirmSession` gana `streak: TrainingStreak` y `phrase: string | null`.
- `TrainingHome` — gana el streak badge 🔥 y la tarjeta "Tu semana" (puntos por sesión, nota de riesgo, botón de protector), alimentados por `getStreak` al cargar. Reemplaza el hueco vacío que dejó el sub-proyecto anterior.
- `SessionConfirmedScreen.tsx` (NUEVO) — pantalla dark-only con anillo de progreso SVG, puntos de semana, número de racha, frase (si existe), botón "Cerrar" y botón "Compartir" deshabilitado con texto "Próximamente".
- `TrainingShell` — gana una vista `'confirmed'`: `handleCompleteDay` ya no solo hace `confirmSession→load→backToHome`, sino que guarda la respuesta completa y muestra `SessionConfirmedScreen`; "Cerrar" en esa pantalla dispara el `load()` + vuelta a home que antes pasaba automático.
- Deep-link NFC:
  - `apps/web/app/training/page.tsx` — al montar, lee `searchParams` (`m`, `a`). Si coinciden con `entrenamiento:confirmar`: sin sesión → guarda `{m,a}` en `localStorage` (`lt_pending_action`) y redirige a `/login`; con sesión → ejecuta `confirmSession(clientId, tz, source:'nfc')` de inmediato, limpia la URL (`router.replace('/training')`) y muestra `SessionConfirmedScreen` directamente (sin pasar por home). Sin query params pero con una acción pendiente en `localStorage` y sesión activa → la consume igual (ejecuta + limpia).
  - `apps/web/app/(auth)/login/page.tsx` — antes de aplicar su lógica de redirect normal (onboarding/admin), revisa `localStorage` por una acción pendiente; si existe, redirige a `/training` en su lugar (que la consumirá en su propio `useEffect`).

## Manejo de errores

- Todos los endpoints nuevos siguen el mismo gating (`ownerOrAdmin`/`adminOnly` + `requirePermission('training')`) que el resto del módulo.
- `use-protector` es idempotente por semana vía `UNIQUE(client_id, week_start)` (ya existe en el schema) — una segunda llamada la misma semana no inserta duplicado.
- El dibujo de frase es non-fatal: cualquier error o tabla vacía resulta en `phrase: null`, nunca rompe la confirmación.
- El deep-link nunca bloquea el login normal: si falla al consumirse (red, permisos, cliente sin `training_days`), se descarta silenciosamente y el cliente cae al flujo normal — igual que el legacy, que solo hace `alert` y continúa.

## Testing

- `apps/api`: Vitest contra DB real. `computeTrainingStreakState` (racha ascendente, racha rota, protector cubriendo una semana, "en riesgo"), `use-protector` (no duplica en la misma semana), `confirm-session` extendido (frase `null` cuando no hay frases activas, `achievement_logs` solo en la transición exacta y nunca disparado por protector, respuesta mantiene `dayNumber`), `achievements` (`adminOnly`, orden por `earned_at`).
- `apps/web`: tests mockeados. Streak badge + tarjeta semanal en `TrainingHome` (estados: normal, en riesgo, protector usado), `SessionConfirmedScreen` (con y sin frase, botón compartir siempre deshabilitado), `TrainingShell` hacia la vista `'confirmed'` end-to-end, mecanismo de deep-link (captura sin sesión → redirect a login; consumo con sesión y query params → ejecuta y limpia URL; consumo de acción pendiente tras login sin query params).

## Fuera de alcance

- CRUD admin de frases (sub-proyecto #4) — este spec solo lee `phrases` existentes.
- Tarjeta compartible a Instagram / botón Compartir funcional (sub-proyecto #3).
- Rest tools (sub-proyecto #5).
- Corte de producción / apagado del stack legacy.

## Riesgos

- El deep-link NFC depende de que el sticker físico ya apunte (o se reconfigure para apuntar) a la URL del nuevo stack — coordinación externa, no técnica, fuera del código.
- La extensión de `confirm-session` debe mantenerse estrictamente aditiva sobre el contrato ya consumido por `TrainingShell` (sub-proyecto anterior) — cualquier cambio de nombre/tipo en `dayNumber`/`alreadyConfirmedToday` rompería esa integración ya mergeada.
- Sin corte de producción — riesgo nulo para el stack legacy.

## Tiempo estimado

Comparable al sub-proyecto anterior en número de piezas backend (2 tablas + streak/protector/achievements + extensión de confirm-session), con una pieza de frontend nueva y algo más delicada (el mecanismo de deep-link cruza dos páginas). Estimo 8-9 tareas TDD.
