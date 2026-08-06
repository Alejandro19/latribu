# Spec de Migración: Comunidad y Mi Evolución

> **Fecha:** 2026-03-08  
> **Estado:** Diagnóstico completado. Ambos módulos requieren acción.  
> **Arquitectura destino:** TypeScript, Express 4, Drizzle ORM + postgres driver, Zod, Next.js App Router, Vitest + Testing Library.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Diagnóstico Detallado](#diagnóstico-detallado)
   - [Módulo Comunidad](#módulo-comunidad)
   - [Módulo Mi Evolución](#módulo-mi-evolución)
3. [Plan de Trabajo: Comunidad](#plan-de-trabajo-comunidad)
4. [Plan de Trabajo: Mi Evolución](#plan-de-trabajo-mi-evolución)
5. [Referencia: Lógica Legacy](#referencia-lógica-legacy)

---

## Resumen Ejecutivo

| Módulo | Estado | % Migrado | Acción requerida |
|--------|--------|-----------|-----------------|
| **Comunidad** | INCOMPLETO | ~95% | Wiring final: montar routers en `app.ts` |
| **Mi Evolución** | NO MIGRADO | 0% | Migración completa desde cero |

---

## Diagnóstico Detallado

### Módulo Comunidad

#### Arquitectura Legacy (server.js + schema.sql)

El módulo Comunidad en el monolito legacy expone 4 tablas y 15 endpoints.

**Tablas (schema.sql:372-417):**
- `community_events` — eventos comunitarios (title, description, event_date, location, capacity, image_url, active, sort_order)
- `event_reservations` — reservas de eventos (event_id, client_id, status, UNIQUE)
- `community_therapies` — terapias/aliados (title, description, discount_pct, provider, image_url, active, sort_order)
- `therapy_reservations` — reservas de terapias (therapy_id, client_id, status, UNIQUE)

**Middleware de acceso (server.js:335-374):**
- `requireOnboardingComplete` — bloquea si no completó info personal (excepto admins y lead_wellness)
- `requireEventsAccess` — funnel abierto, solo requiere ser cliente autenticado
- `requireCommunityAccess` — bloquea lead_wellness, plan vencido, y requiere onboarding

#### Estado en la Nueva Arquitectura (apps/api/src/)

**✅ IMPLEMENTADO (código existente):**

| Archivo | Estado |
|---------|--------|
| `packages/shared-types/src/community.ts` | ✅ Zod schemas |
| `packages/shared-types/src/index.ts` | ✅ Re-export |
| `models/schema.ts` (líneas 341-387) | ✅ 4 tablas Drizzle + tipos |
| `middleware/community-access.middleware.ts` | ✅ 3 middlewares |
| `controllers/events.controller.ts` | ✅ 7 funciones |
| `controllers/therapies.controller.ts` | ✅ 7 funciones |
| `controllers/community-reservations.controller.ts` | ✅ 1 función |
| `services/events.service.ts` | ✅ 6 funciones |
| `services/therapies.service.ts` | ✅ 6 funciones |
| `services/community-reservations.service.ts` | ✅ 1 función |
| `routes/events.routes.ts` | ✅ 8 rutas (incluye `/community/reservations`) |
| `routes/therapies.routes.ts` | ✅ 7 rutas |
| `test/events.routes.test.ts` | ✅ Tests |
| `test/therapies.routes.test.ts` | ✅ Tests |
| `test/community-reservations.routes.test.ts` | ✅ Tests |
| `test/community-access.middleware.test.ts` | ✅ Tests |
| `tasks/migration-2026-08-02-comunidad.sql` | ✅ SQL prod |

**❌ FALTANTE (bug crítico):**

| Issue | Severidad |
|-------|-----------|
| `eventsRouter` y `therapiesRouter` existen pero **NO se importan ni montan** en `apps/api/src/app.ts`. Ninguna ruta de comunidad funciona — todas devuelven 404. | 🔴 CRÍTICO |

---

### Módulo Mi Evolución

#### Arquitectura Legacy (server.js + schema.sql)

**Tablas:**
- `evolution_checkins` (schema.sql:426-442) — 14 columnas: id, client_id, fecha, strength_score(1-10), mood_score(1-10), confidence_score(1-10), security_score(1-10), energy_score(1-10), notes, sleep_hours, adherence_pct, pain_flag, pain_notes, stress_score, created_at
- `personal_records` (schema.sql:486-494) — 6 columnas: id, client_id, exercise_name, initial_value, current_value, sort_order, created_at
- `clients.next_checkin_date` — columna adicional en clients

**Endpoints:**
- `GET /api/clients/:id/evolution` — dashboard: checkins + anthropometrics + inbody + trigger InBody
- `POST /api/clients/:id/evolution` — crear check-in
- `GET /api/clients/:id/personal-records` — listar récords
- `POST /api/clients/:id/personal-records` — crear récord (admin)
- `PUT /api/clients/:id/personal-records/:recordId` — editar (admin)
- `DELETE /api/clients/:id/personal-records/:recordId` — eliminar (admin)
- `PATCH /api/clients/:id/next-checkin-date` — fecha próxima medición (admin)

**Función auxiliar:** `checkInbodyReminder(client)` — reactiva, sin cron. Dispara notificaciones cuando faltan 7 días para InBody.

#### Estado en la Nueva Arquitectura (apps/api/src/)

**❌ NADA IMPLEMENTADO.** No existe ningún archivo de evolución en la nueva API. La única referencia es un comentario en `community-access.middleware.ts:18-21` sobre Mi Evolución.
---

## Plan de Trabajo: Comunidad

### Task C1: Montar routers en `app.ts`

**Archivo:** `apps/api/src/app.ts`

Agregar dos imports después de línea 21:
```typescript
import { eventsRouter } from './routes/events.routes.js';
import { therapiesRouter } from './routes/therapies.routes.js';
```

Agregar dos mounts después de línea 46:
```typescript
app.use('/api', eventsRouter);
app.use('/api', therapiesRouter);
```

**Rutas que quedarán activas:**

| Método | Ruta | Middleware |
|--------|------|-----------|
| GET | `/api/community/events` | auth, requireEventsAccess |
| POST | `/api/community/events` | auth, adminOnly, validateBody |
| PUT | `/api/community/events/:eventId` | auth, adminOnly |
| DELETE | `/api/community/events/:eventId` | auth, adminOnly |
| POST | `/api/community/events/:eventId/reserve` | auth, requireEventsAccess |
| DELETE | `/api/community/events/:eventId/reserve` | auth, requireEventsAccess |
| GET | `/api/clients/:id/event-reservations` | auth, ownerOrAdmin, requireEventsAccess |
| GET | `/api/community/reservations` | auth, adminOnly |
| GET | `/api/community/therapies` | auth, requireEventsAccess |
| POST | `/api/community/therapies` | auth, adminOnly, validateBody |
| PUT | `/api/community/therapies/:therapyId` | auth, adminOnly |
| DELETE | `/api/community/therapies/:therapyId` | auth, adminOnly |
| POST | `/api/community/therapies/:therapyId/reserve` | auth, requireCommunityAccess |
| DELETE | `/api/community/therapies/:therapyId/reserve` | auth, requireCommunityAccess |
| GET | `/api/clients/:id/therapy-reservations` | auth, ownerOrAdmin, requireCommunityAccess |

### Task C2: Verificar compilación y tests

```bash
cd apps/api && npx tsc --noEmit
cd apps/api && npx vitest run test/events.routes.test.ts test/therapies.routes.test.ts test/community-reservations.routes.test.ts test/community-access.middleware.test.ts
```

### Task C3: Commit

```bash
git add apps/api/src/app.ts
git commit -m "fix(comunidad): mount eventsRouter and therapiesRouter in app.ts"
---

## Plan de Trabajo: Mi Evolución

### Objetivo
Migrar completamente el módulo Mi Evolución desde el legacy `server.js`/`schema.sql` a la nueva arquitectura, siguiendo el patrón TDD usado en los demás módulos.

### Estructura de Archivos Final

```
packages/shared-types/src/
  evolution.ts                                  ← NEW
  index.ts                                       ← MODIFY: re-export

apps/api/
  src/models/schema.ts                           ← MODIFY: evolutionCheckins, personalRecords + nextCheckinDate
  src/services/evolution.service.ts              ← NEW
  src/services/personal-records.service.ts       ← NEW
  src/controllers/evolution.controller.ts        ← NEW
  src/controllers/personal-records.controller.ts ← NEW
  src/routes/evolution.routes.ts                 ← NEW
  src/app.ts                                     ← MODIFY: mount evolutionRouter
  test/evolution.routes.test.ts                  ← NEW
  test/personal-records.routes.test.ts           ← NEW

tasks/migration-2026-03-08-evolucion.sql         ← NEW
```

---

### Task E1: Shared Zod schemas

**Archivos:**
- Crear: `packages/shared-types/src/evolution.ts`
- Modificar: `packages/shared-types/src/index.ts`
- Crear test: `packages/shared-types/test/evolution.test.ts`

#### Step 1.1: Escribir tests

`packages/shared-types/test/evolution.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EvolutionCheckinInputSchema, PersonalRecordInputSchema } from '../src/evolution.js';

describe('evolution checkin schema', () => {
  it('accepts a complete checkin', () => {
    const result = EvolutionCheckinInputSchema.safeParse({
      fecha: '2026-03-01',
      strength_score: 7, mood_score: 8, confidence_score: 6,
      security_score: 7, energy_score: 5, sleep_hours: 7.5,
      adherence_pct: 80, pain_flag: false, stress_score: 4, notes: 'Buena semana',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal checkin with only fecha', () => {
    expect(EvolutionCheckinInputSchema.safeParse({ fecha: '2026-03-01' }).success).toBe(true);
  });

  it('rejects checkin without fecha', () => {
    expect(EvolutionCheckinInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects scores out of range', () => {
    expect(EvolutionCheckinInputSchema.safeParse({ fecha: '2026-03-01', strength_score: 11 }).success).toBe(false);
    expect(EvolutionCheckinInputSchema.safeParse({ fecha: '2026-03-01', strength_score: 0 }).success).toBe(false);
  });

  it('rejects adherence_pct out of range', () => {
    expect(EvolutionCheckinInputSchema.safeParse({ fecha: '2026-03-01', adherence_pct: 101 }).success).toBe(false);
  });
});

describe('personal record schema', () => {
  it('accepts a valid record', () => {
    const result = PersonalRecordInputSchema.safeParse({
      exercise_name: 'Press banca', initial_value: '60kg', current_value: '75kg', sort_order: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects without exercise_name', () => {
    expect(PersonalRecordInputSchema.safeParse({ initial_value: '60kg' }).success).toBe(false);
  });
});
```

#### Step 1.2: Implementar `packages/shared-types/src/evolution.ts`

```ts
import { z } from 'zod';

export const EvolutionCheckinInputSchema = z.object({
  fecha: z.string().min(1),
  strength_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  mood_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  confidence_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  security_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  energy_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  sleep_hours: z.coerce.number().min(0).max(24).nullable().optional(),
  adherence_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  pain_flag: z.boolean().nullable().optional(),
  pain_notes: z.string().nullable().optional(),
  stress_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type EvolutionCheckinInput = z.infer<typeof EvolutionCheckinInputSchema>;

export const PersonalRecordInputSchema = z.object({
  exercise_name: z.string().min(1),
  initial_value: z.string().nullable().optional(),
  current_value: z.string().nullable().optional(),
  sort_order: z.coerce.number().int().default(0),
});
export type PersonalRecordInput = z.infer<typeof PersonalRecordInputSchema>;
```

#### Step 1.3: Re-exportar

Modificar `packages/shared-types/src/index.ts` — agregar:
```ts
---

### Task E2: Drizzle schema

**Archivo:** `apps/api/src/models/schema.ts`

#### Step 2.1: Agregar `next_checkin_date` a clients

En la tabla `clients` (línea ~40, antes de `createdAt`), agregar:

```ts
nextCheckinDate: date('next_checkin_date'),
```

#### Step 2.2: Agregar tablas al final del archivo

```ts
// ==== EVOLUTION MODULE TABLES ====

export const evolutionCheckins = pgTable('evolution_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull().defaultNow(),
  strengthScore: integer('strength_score'),
  moodScore: integer('mood_score'),
  confidenceScore: integer('confidence_score'),
  securityScore: integer('security_score'),
  energyScore: integer('energy_score'),
  notes: text('notes'),
  sleepHours: numeric('sleep_hours', { precision: 3, scale: 1 }).$type<number>(),
  adherencePct: integer('adherence_pct'),
  painFlag: boolean('pain_flag'),
  painNotes: text('pain_notes'),
  stressScore: integer('stress_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const personalRecords = pgTable('personal_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  exerciseName: text('exercise_name').notNull(),
  initialValue: text('initial_value'),
  currentValue: text('current_value'),
---

### Task E3: Servicio de evolución

**Archivo:** `apps/api/src/services/evolution.service.ts`

```ts
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { evolutionCheckins, anthropometricRecords, bioInbodyRecords, clients, adminNotifications } from '../models/schema.js';
import type { EvolutionCheckin } from '../models/schema.js';
import type { EvolutionCheckinInput } from '@latribu/shared-types';

// checkInbodyReminder — lógica reactiva sin cron (port de server.js:2085-2101)
async function checkInbodyReminder(client: typeof clients.$inferSelect | undefined) {
  if (!client || !client.inbodyReminderEnabled || !client.inbodyNextExpectedDate || client.inbodyReminderSentThisCycle) return;
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  const target = new Date(client.inbodyNextExpectedDate + 'T00:00:00');
  const daysUntil = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (daysUntil !== 7) return;
  try {
    await db.insert(adminNotifications).values({
      clientId: client.id,
      type: 'inbody_reminder',
      message: `${client.name} — InBody en 7 días. Próxima medición esperada el ${client.inbodyNextExpectedDate} (cadencia: ${client.inbodyCadenceType}). Confirma que tenga su cita de valoración agendada.`,
    });
    await db.update(clients).set({ inbodyReminderSentThisCycle: true }).where(eq(clients.id, client.id));
  } catch (e) {
    console.error('checkInbodyReminder: no fatal', e);
  }
}

export async function getEvolutionData(clientId: string) {
  const [checkins, anthropometrics, inbody, clientRows] = await Promise.all([
    db.select().from(evolutionCheckins).where(eq(evolutionCheckins.clientId, clientId)).orderBy(asc(evolutionCheckins.fecha)),
    db.select().from(anthropometricRecords).where(eq(anthropometricRecords.clientId, clientId)).orderBy(asc(anthropometricRecords.fecha)),
    db.select().from(bioInbodyRecords).where(eq(bioInbodyRecords.clientId, clientId)).orderBy(asc(bioInbodyRecords.fecha)),
    db.select().from(clients).where(eq(clients.id, clientId)).limit(1),
  ]);
  checkInbodyReminder(clientRows[0]).catch(() => {});
  return { checkins, anthropometrics, inbody };
}

export async function createCheckin(clientId: string, input: EvolutionCheckinInput): Promise<EvolutionCheckin> {
  const [checkin] = await db.insert(evolutionCheckins).values({
    clientId,
    fecha: input.fecha,
    strengthScore: input.strength_score ?? null,
    moodScore: input.mood_score ?? null,
    confidenceScore: input.confidence_score ?? null,
    securityScore: input.security_score ?? null,
    energyScore: input.energy_score ?? null,
    sleepHours: input.sleep_hours ?? null,
    adherencePct: input.adherence_pct ?? null,
    painFlag: input.pain_flag ?? null,
    painNotes: input.pain_notes ?? null,
    stressScore: input.stress_score ?? null,
    notes: input.notes ?? null,
  }).returning();
  return checkin;
}
```
---

### Task E4: Servicio de récords personales

**Archivo:** `apps/api/src/services/personal-records.service.ts`

```ts
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { personalRecords, type PersonalRecord } from '../models/schema.js';
import type { PersonalRecordInput } from '@latribu/shared-types';

export async function listRecords(clientId: string): Promise<PersonalRecord[]> {
  return db.select().from(personalRecords)
    .where(eq(personalRecords.clientId, clientId))
    .orderBy(asc(personalRecords.sortOrder));
}

export async function createRecord(clientId: string, input: PersonalRecordInput): Promise<PersonalRecord> {
  const [record] = await db.insert(personalRecords).values({
    clientId,
    exerciseName: input.exercise_name,
    initialValue: input.initial_value ?? null,
    currentValue: input.current_value ?? null,
    sortOrder: input.sort_order ?? 0,
  }).returning();
  return record;
}

export async function updateRecord(recordId: string, input: Partial<PersonalRecordInput>): Promise<PersonalRecord | null> {
  const [record] = await db.update(personalRecords).set({
    exerciseName: input.exercise_name,
    initialValue: input.initial_value,
    currentValue: input.current_value,
    sortOrder: input.sort_order,
  }).where(eq(personalRecords.id, recordId)).returning();
  return record ?? null;
}

export async function deleteRecord(recordId: string): Promise<void> {
  await db.delete(personalRecords).where(eq(personalRecords.id, recordId));
}
```

---

### Task E5: Controladores

**Archivo:** `apps/api/src/controllers/evolution.controller.ts`

```ts
import type { Request, Response } from 'express';
import type { EvolutionCheckinInput } from '@latribu/shared-types';
import * as evolutionService from '../services/evolution.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function getEvolution(req: Request, res: Response) {
  const data = await evolutionService.getEvolutionData(req.params.id);
  return ok(res, data);
}

export async function createCheckin(req: Request, res: Response) {
  const checkin = await evolutionService.createCheckin(req.params.id, req.body as EvolutionCheckinInput);
  return ok(res, { checkin }, 201);
}
```

**Archivo:** `apps/api/src/controllers/personal-records.controller.ts`

```ts
import type { Request, Response } from 'express';
import type { PersonalRecordInput } from '@latribu/shared-types';
import * as recordsService from '../services/personal-records.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listRecords(req: Request, res: Response) {
  const records = await recordsService.listRecords(req.params.id);
  return ok(res, { records });
}

export async function createRecord(req: Request, res: Response) {
  const record = await recordsService.createRecord(req.params.id, req.body as PersonalRecordInput);
  return ok(res, { record }, 201);
}

export async function updateRecord(req: Request, res: Response) {
  const record = await recordsService.updateRecord(req.params.recordId, req.body as Partial<PersonalRecordInput>);
  if (!record) return err(res, 'Récord no encontrado.', 404);
  return ok(res, { record });
}

export async function deleteRecord(req: Request, res: Response) {
  await recordsService.deleteRecord(req.params.recordId);
  return ok(res, { message: 'Récord eliminado.' });
}
```
---

### Task E6: Rutas de evolución

**Archivo:** `apps/api/src/routes/evolution.routes.ts`

```ts
import { Router } from 'express';
import { EvolutionCheckinInputSchema, PersonalRecordInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireOnboardingComplete } from '../middleware/community-access.middleware.js';
import * as evolutionController from '../controllers/evolution.controller.js';
import * as personalRecordsController from '../controllers/personal-records.controller.js';
import * as clientsService from '../services/clients.service.js';

export const evolutionRouter = Router();

// GET /api/clients/:id/evolution — dashboard completo
evolutionRouter.get(
  '/clients/:id/evolution',
  authMiddleware, ownerOrAdmin, requireOnboardingComplete,
  asyncHandler(evolutionController.getEvolution)
);

// POST /api/clients/:id/evolution — crear check-in
evolutionRouter.post(
  '/clients/:id/evolution',
  authMiddleware, ownerOrAdmin, requireOnboardingComplete,
  validateBody(EvolutionCheckinInputSchema),
  asyncHandler(evolutionController.createCheckin)
);

// GET /api/clients/:id/personal-records
evolutionRouter.get(
  '/clients/:id/personal-records',
  authMiddleware, ownerOrAdmin, requireOnboardingComplete,
  asyncHandler(personalRecordsController.listRecords)
);

// POST /api/clients/:id/personal-records (admin only)
evolutionRouter.post(
  '/clients/:id/personal-records',
  authMiddleware, adminOnly,
  validateBody(PersonalRecordInputSchema),
  asyncHandler(personalRecordsController.createRecord)
);

// PUT /api/clients/:id/personal-records/:recordId (admin only)
evolutionRouter.put(
  '/clients/:id/personal-records/:recordId',
  authMiddleware, adminOnly,
  asyncHandler(personalRecordsController.updateRecord)
);

// DELETE /api/clients/:id/personal-records/:recordId (admin only)
evolutionRouter.delete(
  '/clients/:id/personal-records/:recordId',
  authMiddleware, adminOnly,
  asyncHandler(personalRecordsController.deleteRecord)
);

// PATCH /api/clients/:id/next-checkin-date (admin only)
evolutionRouter.patch(
  '/clients/:id/next-checkin-date',
  authMiddleware, adminOnly,
  asyncHandler(async (req, res) => {
    await clientsService.updateClient(req.params.id, { next_checkin_date: req.body.next_checkin_date || null });
    return res.status(200).json({ success: true, message: 'Fecha actualizada.' });
  })
);
```

---

### Task E7: Montar evolutionRouter en app.ts

**Archivo:** `apps/api/src/app.ts`

Agregar import:
```ts
import { evolutionRouter } from './routes/evolution.routes.js';
```

Agregar mount (antes del error handler, línea ~57):
```ts
app.use('/api', evolutionRouter);
```

---

### Task E8: Tests

**Archivos:**
- `apps/api/test/evolution.routes.test.ts`
- `apps/api/test/personal-records.routes.test.ts`

Los tests deben cubrir:
- `GET /api/clients/:id/evolution` — devuelve checkins + anthropometrics + inbody
- `POST /api/clients/:id/evolution` — crea check-in con datos válidos / rechaza sin fecha
- `GET /api/clients/:id/evolution` — bloquea acceso cruzado (ownerOrAdmin)
- `GET /api/clients/:id/evolution` — bloquea sin onboarding
- `GET /api/clients/:id/personal-records` — lista récords
- `POST /api/clients/:id/personal-records` — crea récord (admin) / rechaza no-admin
- `PUT /api/clients/:id/personal-records/:recordId` — actualiza récord
- `DELETE /api/clients/:id/personal-records/:recordId` — elimina récord
- `PATCH /api/clients/:id/next-checkin-date` — actualiza fecha

Seguir el patrón de tests existentes (ej. `sleep.routes.test.ts`).

---

### Task E9: Migración SQL de producción

**Archivo:** `tasks/migration-2026-03-08-evolucion.sql`

```sql
-- Migración para Mi Evolución. Idempotente (seguro re-correr).
-- Ejecutar en Supabase SQL Editor de producción.

CREATE TABLE IF NOT EXISTS evolution_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  strength_score INT CHECK (strength_score BETWEEN 1 AND 10),
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  confidence_score INT CHECK (confidence_score BETWEEN 1 AND 10),
  security_score INT CHECK (security_score BETWEEN 1 AND 10),
  energy_score INT CHECK (energy_score BETWEEN 1 AND 10),
  notes TEXT,
  sleep_hours NUMERIC(3,1),
  adherence_pct INT CHECK (adherence_pct BETWEEN 0 AND 100),
  pain_flag BOOLEAN,
  pain_notes TEXT,
  stress_score INT CHECK (stress_score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  initial_value TEXT,
  current_value TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
---

## Referencia: Lógica Legacy

### Comunidad — Endpoints completos (server.js)

| Línea | Método | Ruta | Middleware |
|-------|--------|------|-----------|
| 1778 | GET | `/api/community/events` | auth, requireEventsAccess |
| 1792 | POST | `/api/community/events` | auth, adminOnly |
| 1802 | PUT | `/api/community/events/:eventId` | auth, adminOnly |
| 1812 | DELETE | `/api/community/events/:eventId` | auth, adminOnly |
| 1822 | POST | `/api/community/events/:eventId/reserve` | auth, requireEventsAccess |
| 1837 | DELETE | `/api/community/events/:eventId/reserve` | auth, requireEventsAccess |
| 1849 | GET | `/api/clients/:id/event-reservations` | auth, ownerOrAdmin, requireEventsAccess |
| 1863 | GET | `/api/community/therapies` | auth, requireEventsAccess |
| 1877 | POST | `/api/community/therapies` | auth, adminOnly |
| 1887 | PUT | `/api/community/therapies/:therapyId` | auth, adminOnly |
| 1897 | DELETE | `/api/community/therapies/:therapyId` | auth, adminOnly |
| 1907 | POST | `/api/community/therapies/:therapyId/reserve` | auth, requireCommunityAccess |
| 1922 | DELETE | `/api/community/therapies/:therapyId/reserve` | auth, requireCommunityAccess |
| 1934 | GET | `/api/clients/:id/therapy-reservations` | auth, ownerOrAdmin, requireCommunityAccess |
| 1944 | GET | `/api/community/reservations` | auth, adminOnly |

### Mi Evolución — Endpoints completos (server.js)

| Línea | Método | Ruta | Middleware |
|-------|--------|------|-----------|
| 2103 | GET | `/api/clients/:id/evolution` | auth, ownerOrAdmin, requireOnboardingComplete |
| 2119 | POST | `/api/clients/:id/evolution` | auth, ownerOrAdmin, requireOnboardingComplete |
| 2132 | GET | `/api/clients/:id/personal-records` | auth, ownerOrAdmin, requireOnboardingComplete |
| 2142 | POST | `/api/clients/:id/personal-records` | auth, adminOnly |
| 2152 | PUT | `/api/clients/:id/personal-records/:recordId` | auth, adminOnly |
| 2162 | DELETE | `/api/clients/:id/personal-records/:recordId` | auth, adminOnly |
| 2172 | PATCH | `/api/clients/:id/next-checkin-date` | auth, adminOnly |

### Middleware de acceso (server.js:335-374)

```
requireOnboardingComplete  — admin ✓ | lead_wellness ✓ | resto: necesita personal_info.completed_at
requireEventsAccess        — admin ✓ | cliente autenticado ✓ | sin req.client → 403
requireCommunityAccess     — admin ✓ | lead_wellness → 403 | planExpired → 402 | resto: requireOnboardingComplete
```

### Tabla evolution_checkins (schema.sql:426-442)

```
Columnas: id UUID PK, client_id UUID FK, fecha DATE,
  strength_score INT (1-10), mood_score INT (1-10),
  confidence_score INT (1-10), security_score INT (1-10),
  energy_score INT (1-10), notes TEXT,
  sleep_hours NUMERIC(3,1), adherence_pct INT (0-100),
  pain_flag BOOLEAN, pain_notes TEXT,
  stress_score INT (1-10), created_at TIMESTAMPTZ
```

### Tabla personal_records (schema.sql:486-494)

```
Columnas: id UUID PK, client_id UUID FK,
  exercise_name TEXT NOT NULL,
  initial_value TEXT, current_value TEXT,
  sort_order INT DEFAULT 0, created_at TIMESTAMPTZ
```

### checkInbodyReminder (server.js:2085-2101)

Lógica reactiva sin cron: se ejecuta cada vez que se carga `GET /api/clients/:id/evolution`. Si faltan exactamente 7 días para `inbody_next_expected_date` y no se ha enviado recordatorio este ciclo, crea notificaciones `admin_notifications` y `client_notifications`, y marca `inbody_reminder_sent_this_cycle = true`.

---

## Orden de Ejecución Recomendado

1. **Task C1** — Montar routers de comunidad en `app.ts` (5 min, corrige el bug crítico)
2. **Task C2** — Verificar compilación y tests de comunidad
3. **Task C3** — Commit de comunidad
4. **Task E1** — Shared types para evolución (TDD)
5. **Task E2** — Drizzle schema: evolution_checkins + personal_records + next_checkin_date
6. **Task E3** — Servicio de evolución (incluye checkInbodyReminder)
7. **Task E4** — Servicio de récords personales
8. **Task E5** — Controladores de evolución y récords
9. **Task E6** — Rutas de evolución
10. **Task E7** — Montar evolutionRouter en app.ts
11. **Task E8** — Tests (evolution.routes.test.ts + personal-records.routes.test.ts)
12. **Task E9** — Migración SQL de producción
13. **Task E10** — Verificación final (tsc + vitest)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_checkin_date DATE;

-- RLS
ALTER TABLE evolution_checkins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON evolution_checkins USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY deny_all ON personal_records USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

---

### Task E10: Verificación final

```bash
# Compilación TypeScript
cd apps/api && npx tsc --noEmit

# Tests de evolución
cd apps/api && npx vitest run test/evolution.routes.test.ts test/personal-records.routes.test.ts

# Todos los tests (sin regresiones)
cd apps/api && npx vitest run
```

```bash
git add apps/api packages/shared-types tasks
git commit -m "feat(evolucion): migrate Mi Evolucion module to new architecture"
```
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type EvolutionCheckin = typeof evolutionCheckins.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
```
export * from './evolution.js';
```

#### Step 1.4: Verificar

```bash
cd packages/shared-types && npx vitest run test/evolution.test.ts
```
```