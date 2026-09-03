# Comunidad — Eventos y Terapias — Migración a la Arquitectura Nueva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the legacy Comunidad module (`community_events`, `event_reservations`, `community_therapies`, `therapy_reservations`) from `server.js`/`index.html` to the new stack (`apps/api` + `apps/web`), including three new access-control middleware functions this module needs that don't exist yet in `apps/api`, and fixing a known frontend gap: legacy never shipped a "Cancelar reserva" button even though the backend has always supported cancellation (documented in this repo's own backend-audit history, `tasks/todo.md` Task 7).

**Architecture:** Two new client-facing/admin routers (`eventsRouter`, `therapiesRouter`) plus one new middleware file (`community-access.middleware.ts`) in `apps/api`. Events and therapies are structurally identical (global admin-managed content + a reservation join table with `confirmada`/`cancelada` status, unique per `(content_id, client_id)`, toggled via upsert-status rather than insert/delete) — both follow the exact same pattern, mirrored across two parallel services. A third endpoint (`GET /api/community/reservations`, admin-only) aggregates both reservation types with joined client/event/therapy names for the admin's "who's coming" view. Frontend: two admin CRUD panels (events, therapies) plus a new admin reservations-list page, and two client-facing browse-and-reserve pages — each reservation card gets both a "Reservar" and (new) "Cancelar reserva" action.

**Tech Stack:** Same as the rest of the monorepo — TypeScript, Express 4, Drizzle ORM + `postgres` driver, Zod, Next.js App Router, Vitest + Testing Library.

## Global Constraints

- No design/styling work — plain functional HTML only, matching every other migrated module.
- **Three new middleware functions**, none of which exist in `apps/api` yet, must be added to a new file `apps/api/src/middleware/community-access.middleware.ts`, ported verbatim from `server.js:335-374`:
  - `requireOnboardingComplete`: admins pass; `lead_wellness` clients pass without an onboarding check (they can self-serve Mi Evolución check-ins per the legacy comment, out of scope here but the exemption must be preserved); everyone else must have a `personal_info` row with a non-null `completed_at`, else 403 `'Completa tu información personal para acceder a este módulo.'`.
  - `requireEventsAccess`: admins pass; any client with `req.client` set passes (i.e. any authenticated, active, non-inactive client — Eventos is an open conversion funnel, no plan/onboarding/permission gate at all). Missing `req.client` (shouldn't happen for a `cliente`-role token, but matches legacy's defensive check) → 403.
  - `requireCommunityAccess` (therapies reserve/cancel only, NOT the events routes): admins pass; `lead_wellness` clients blocked with 403 `'No tienes acceso a este módulo.'`; expired-plan clients blocked with 402 `'Tu plan ha vencido. Contacta a tu coach para renovarlo.'` (`req.planExpired`, already computed by the existing `authMiddleware`); otherwise delegates to `requireOnboardingComplete`.
  - `GET /community/events` and `GET /community/therapies` (browsing) use `requireEventsAccess` — deliberately more open than reserving, so a `lead_wellness` client can see a real (if plan-gated) preview of what's available, matching the legacy comment at `server.js:362-366`. Only the therapy reserve/cancel actions use `requireCommunityAccess`; event reserve/cancel actions ALSO use `requireEventsAccess` (not `requireCommunityAccess`) — this is legacy's actual behavior (`server.js:1822`, `1837`), not a mistake: events have no lead_wellness/plan/onboarding gate at any step, therapies do.
- `event_reservations`/`therapy_reservations` are **toggle-status, not insert/delete**: reserving upserts `status: 'confirmada'` (creating the row if none exists, or flipping an existing `cancelada` row back to `confirmada`); cancelling flips `status: 'cancelada'`. A `UNIQUE(event_id, client_id)` / `UNIQUE(therapy_id, client_id)` constraint means each client has at most ONE row per event/therapy, ever — its status is the only thing that changes. Reserving an already-`confirmada` reservation is a 409 conflict (`'Ya tienes una reserva para este evento/esta terapia.'`); cancelling when there's no `confirmada` row is a 404.
- The public list endpoints (`GET /community/events`, `GET /community/therapies`) return each item with a computed `confirmed_count` (how many `confirmada` reservations exist for it) — computed in the service layer by grouping `confirmada` reservations by content id, matching `server.js:1778-1790`/`1863-1875` exactly.
- `POST/PUT/DELETE /community/events` and `/community/therapies` (admin content CRUD) use `authMiddleware + adminOnly` only.
- `GET /api/community/reservations` (admin aggregate view) is `authMiddleware + adminOnly`, joins `event_reservations`→`clients`→`community_events` and `therapy_reservations`→`clients`→`community_therapies`, filters to `status = 'confirmada'` only, and enriches with each client's formatted phone number from `personal_info` (`phone_code` + `phone_number`, already-has-code detection) — port the exact phone-formatting logic from `server.js:1965-1979`.
- Tests run against the dedicated test Postgres database via `apps/api/test/helpers/setupTestEnv.ts` (already wired) — never mocks, never production.
- `schema.sql` already has all four tables (lines 376-417) — verify no drift against the Drizzle definitions added in Task 2.
- **Frontend fix included in this plan** (not a deviation, an explicit goal): both client-facing browse pages must render a "Cancelar reserva" button next to any item the client has an active (`confirmada`) reservation for — legacy never built this despite the backend supporting it since the module was audited (see `tasks/todo.md` Task 7's own note: "Pendiente para la pasada de frontend: no hay botón Cancelar reserva en la UI"). This plan's frontend tasks are that pending pass.

## File Structure

```
packages/shared-types/src/
  community.ts                                  ← NEW: CommunityEventInputSchema, CommunityTherapyInputSchema
  index.ts                                       ← MODIFY: re-export
apps/api/
  src/models/schema.ts                           ← MODIFY: add communityEvents, eventReservations, communityTherapies, therapyReservations tables + types
  src/middleware/community-access.middleware.ts  ← NEW: requireOnboardingComplete, requireEventsAccess, requireCommunityAccess
  src/services/events.service.ts                 ← NEW
  src/services/therapies.service.ts              ← NEW
  src/services/community-reservations.service.ts ← NEW (admin aggregate view)
  src/controllers/events.controller.ts           ← NEW
  src/controllers/therapies.controller.ts        ← NEW
  src/controllers/community-reservations.controller.ts ← NEW
  src/routes/events.routes.ts                    ← NEW
  src/routes/therapies.routes.ts                 ← NEW
  src/app.ts                                     ← MODIFY: mount eventsRouter, therapiesRouter
  test/events.routes.test.ts                     ← NEW
  test/therapies.routes.test.ts                  ← NEW
  test/community-reservations.routes.test.ts     ← NEW
apps/web/
  lib/events-client.ts                           ← NEW
  lib/therapies-client.ts                        ← NEW
  components/community/AdminEventsPanel.tsx      ← NEW
  components/community/AdminTherapiesPanel.tsx   ← NEW
  components/community/ClientEventsPanel.tsx     ← NEW
  components/community/ClientTherapiesPanel.tsx  ← NEW
  components/community/AdminReservationsPanel.tsx ← NEW
  app/admin/community-events/page.tsx            ← NEW
  app/admin/community-therapies/page.tsx         ← NEW
  app/admin/community-reservations/page.tsx      ← NEW
  app/community/events/page.tsx                  ← NEW
  app/community/therapies/page.tsx                ← NEW
  test/admin-events-panel.test.tsx               ← NEW
  test/admin-therapies-panel.test.tsx            ← NEW
  test/client-events-panel.test.tsx              ← NEW
  test/client-therapies-panel.test.tsx           ← NEW
  test/admin-reservations-panel.test.tsx         ← NEW
tasks/migration-2026-08-02-comunidad.sql         ← NEW: manual prod migration
```

---

### Task 1: Shared Zod schemas for events and therapies

**Files:**
- Create: `packages/shared-types/src/community.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/test/community.test.ts`

**Interfaces:**
- Produces: `CommunityEventInputSchema` (+ `CommunityEventInput`), `CommunityTherapyInputSchema` (+ `CommunityTherapyInput`). Consumed by Tasks 4-5 (`apps/api`).

- [ ] **Step 1: Write the failing tests**

`packages/shared-types/test/community.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CommunityEventInputSchema, CommunityTherapyInputSchema } from '../src/community.js';

describe('community event schema', () => {
  it('accepts a valid event', () => {
    const result = CommunityEventInputSchema.safeParse({
      title: 'Sesión grupal de respiración',
      description: 'Práctica guiada de 45 minutos',
      event_date: '2026-09-01T18:00:00.000Z',
      location: 'Estudio LA TRIBU',
      capacity: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an event missing the title', () => {
    expect(CommunityEventInputSchema.safeParse({ location: 'X' }).success).toBe(false);
  });

  it('accepts an event with only a title (everything else optional)', () => {
    expect(CommunityEventInputSchema.safeParse({ title: 'Solo título' }).success).toBe(true);
  });

  it('accepts a partial update patch', () => {
    expect(CommunityEventInputSchema.partial().safeParse({ capacity: 30 }).success).toBe(true);
  });
});

describe('community therapy schema', () => {
  it('accepts a valid therapy', () => {
    const result = CommunityTherapyInputSchema.safeParse({
      title: 'Masaje descontracturante',
      description: '30% de descuento con nuestro aliado',
      discount_pct: 30,
      provider: 'Clínica Aliada',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a therapy missing the title', () => {
    expect(CommunityTherapyInputSchema.safeParse({ provider: 'X' }).success).toBe(false);
  });

  it('accepts a therapy with only a title', () => {
    expect(CommunityTherapyInputSchema.safeParse({ title: 'Solo título' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/shared-types && npx vitest run test/community.test.ts`
Expected: FAIL — `Cannot find module '../src/community.js'`

- [ ] **Step 3: Implement `packages/shared-types/src/community.ts`**

```ts
import { z } from 'zod';

export const CommunityEventInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  event_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  capacity: z.coerce.number().int().min(0).nullable().optional(),
  image_url: z.string().nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});
export type CommunityEventInput = z.infer<typeof CommunityEventInputSchema>;

export const CommunityTherapyInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  discount_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  provider: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});
export type CommunityTherapyInput = z.infer<typeof CommunityTherapyInputSchema>;
```

- [ ] **Step 4: Re-export from the package index**

Modify `packages/shared-types/src/index.ts` — add `export * from './community.js';` alongside the existing export lines (don't remove or reorder existing ones).

- [ ] **Step 5: Run to verify they pass**

Run: `cd packages/shared-types && npx vitest run test/community.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types
git commit -m "feat(comunidad): add shared Zod schemas for events and therapies"
```

---

### Task 2: Drizzle schema — `communityEvents`, `eventReservations`, `communityTherapies`, `therapyReservations` tables

**Files:**
- Modify: `apps/api/src/models/schema.ts`

**Interfaces:**
- Produces: `communityEvents`, `eventReservations`, `communityTherapies`, `therapyReservations` Drizzle tables and `CommunityEvent`, `EventReservation`, `CommunityTherapy`, `TherapyReservation` types. Consumed by Tasks 4-6.

- [ ] **Step 1: Append the four tables and their inferred types**

Add at the end of `apps/api/src/models/schema.ts` (after the `sleepLogs` table and its type export from the prior, already-merged plan):

```ts
export const communityEvents = pgTable('community_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date', { withTimezone: true }),
  location: text('location'),
  capacity: integer('capacity'),
  imageUrl: text('image_url'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const eventReservations = pgTable('event_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => communityEvents.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('confirmada'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const communityTherapies = pgTable('community_therapies', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  discountPct: integer('discount_pct').default(0),
  provider: text('provider'),
  imageUrl: text('image_url'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const therapyReservations = pgTable('therapy_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  therapyId: uuid('therapy_id').notNull().references(() => communityTherapies.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('confirmada'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type CommunityEvent = typeof communityEvents.$inferSelect;
export type EventReservation = typeof eventReservations.$inferSelect;
export type CommunityTherapy = typeof communityTherapies.$inferSelect;
export type TherapyReservation = typeof therapyReservations.$inferSelect;
```

Note: the `UNIQUE(event_id, client_id)` / `UNIQUE(therapy_id, client_id)` composite constraints are enforced at the SQL migration level (Task 10) only, not expressible as a simple Drizzle column modifier — same convention already established for `nutritionPlans`/`cortisolCompletions`/`cortisolCheckins`/`sleepLogs` in this codebase.

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/models/schema.ts
git commit -m "feat(comunidad): add Drizzle tables for events, therapies, and their reservations"
```

---

### Task 3: Community access middleware

**Files:**
- Create: `apps/api/src/middleware/community-access.middleware.ts`
- Test: `apps/api/test/community-access.middleware.test.ts`

**Interfaces:**
- Consumes: `db`, `personalInfo` (`apps/api/src/models/schema.ts`, already exists); `Request`/`Response`/`NextFunction` from Express; the existing `req.client`/`req.planExpired`/`req.user` augmentations from `apps/api/src/middleware/auth.middleware.ts` (already declared globally — do not redeclare).
- Produces: `requireOnboardingComplete`, `requireEventsAccess`, `requireCommunityAccess` Express middleware. Consumed by Tasks 4-5.

- [ ] **Step 1: Write the failing middleware tests**

`apps/api/test/community-access.middleware.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients, personalInfo } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import { authMiddleware } from '../src/middleware/auth.middleware.js';
import { requireOnboardingComplete, requireEventsAccess, requireCommunityAccess } from '../src/middleware/community-access.middleware.js';

function buildTestApp() {
  const app = express();
  app.get('/onboarding-gated', authMiddleware, requireOnboardingComplete, (_req, res) => res.json({ success: true }));
  app.get('/events-gated', authMiddleware, requireEventsAccess, (_req, res) => res.json({ success: true }));
  app.get('/community-gated', authMiddleware, requireCommunityAccess, (_req, res) => res.json({ success: true }));
  return app;
}

describe('community-access middleware', () => {
  const app = buildTestApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let coachingClientId: string;
  let leadClientId: string;

  beforeAll(async () => {
    const [coaching] = await db
      .insert(clients)
      .values({ name: 'Coaching Client', email: `coaching-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    coachingClientId = coaching.id;

    const [lead] = await db
      .insert(clients)
      .values({ name: 'Lead Client', email: `lead-${Date.now()}@example.com`, status: 'active', clientType: 'lead_wellness' })
      .returning();
    leadClientId = lead.id;
  });

  afterAll(async () => {
    await db.delete(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    await db.delete(clients).where(eq(clients.id, coachingClientId));
    await db.delete(clients).where(eq(clients.id, leadClientId));
  });

  afterEach(async () => {
    await db.delete(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
  });

  it('requireOnboardingComplete: admin always passes', async () => {
    const res = await request(app).get('/onboarding-gated').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('requireOnboardingComplete: lead_wellness passes without needing personal_info', async () => {
    const token = signToken({ id: leadClientId, role: 'cliente', name: 'Lead', email: 'lead@a.com' });
    const res = await request(app).get('/onboarding-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('requireOnboardingComplete: coaching client without completed personal_info is blocked', async () => {
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/onboarding-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requireOnboardingComplete: coaching client with completed personal_info passes', async () => {
    await db.insert(personalInfo).values({ clientId: coachingClientId, completedAt: new Date() });
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/onboarding-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('requireEventsAccess: any active client passes, no onboarding/plan check', async () => {
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/events-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('requireCommunityAccess: lead_wellness is blocked', async () => {
    const token = signToken({ id: leadClientId, role: 'cliente', name: 'Lead', email: 'lead@a.com' });
    const res = await request(app).get('/community-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requireCommunityAccess: coaching client without completed onboarding is blocked', async () => {
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/community-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requireCommunityAccess: coaching client with completed onboarding passes', async () => {
    await db.insert(personalInfo).values({ clientId: coachingClientId, completedAt: new Date() });
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/community-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/community-access.middleware.test.ts`
Expected: FAIL — `Cannot find module '../src/middleware/community-access.middleware.js'`

- [ ] **Step 3: Implement the middleware**

`apps/api/src/middleware/community-access.middleware.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { personalInfo } from '../models/schema.js';

function unauthorized(res: Response, message: string, status = 403) {
  return res.status(status).json({ success: false, error: message });
}

export async function requireOnboardingComplete(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  // lead_wellness sí puede hacer su check-in del día en Mi Evolución (el
  // front le oculta el historial/gráficas, pero el registro básico es
  // autoservicio, igual que Cortisol/Descanso) — no se le exige onboarding
  // completo ni se le bloquea aquí.
  if (req.client && req.client.clientType === 'lead_wellness') return next();
  try {
    const rows = await db.select().from(personalInfo).where(eq(personalInfo.clientId, req.user!.id)).limit(1);
    const info = rows[0];
    if (!info || !info.completedAt) {
      return unauthorized(res, 'Completa tu información personal para acceder a este módulo.');
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Eventos es funnel de conversión — abierto para los 3 tipos de cliente sin
// ninguna condición (ni plan vencido, ni onboarding, ni permissions).
export function requireEventsAccess(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (!req.client) return unauthorized(res, 'No tienes permiso para acceder a estos datos.');
  next();
}

// Reservar/gestionar Terapias: bloqueado únicamente para lead_wellness — la
// diferencia entre coaching_1_1 y coaching_online no aplica aquí, ambos ven
// y reservan exactamente igual. Ver la lista (GET) es más abierto — usa
// `requireEventsAccess` en su lugar para que un lead pueda ver una vista
// previa real (desenfocada) de los aliados, no una inventada.
export async function requireCommunityAccess(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (req.client && req.client.clientType === 'lead_wellness') {
    return unauthorized(res, 'No tienes acceso a este módulo.');
  }
  if (req.planExpired) return unauthorized(res, 'Tu plan ha vencido. Contacta a tu coach para renovarlo.', 402);
  return requireOnboardingComplete(req, res, next);
}
```

If `req.client.clientType` doesn't compile (check the `ClientAuthRow` type shape declared in `apps/api/src/middleware/auth.middleware.ts` first — it may be named differently or the property may already be present under this exact name), adjust to match the real type — do not guess without checking.

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/api && npx vitest run test/community-access.middleware.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Run the full apps/api suite to confirm no regressions**

Run: `cd apps/api && npx vitest run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/community-access.middleware.ts apps/api/test/community-access.middleware.test.ts
git commit -m "feat(comunidad): add requireOnboardingComplete/requireEventsAccess/requireCommunityAccess middleware"
```

---

### Task 4: `apps/api` — Events (CRUD + reserve/cancel)

**Files:**
- Create: `apps/api/src/services/events.service.ts`
- Create: `apps/api/src/controllers/events.controller.ts`
- Create: `apps/api/src/routes/events.routes.ts`
- Modify: `apps/api/src/app.ts` (mount `eventsRouter`)
- Test: `apps/api/test/events.routes.test.ts`

**Interfaces:**
- Consumes: `CommunityEventInputSchema` (Task 1); `communityEvents`, `eventReservations`, `type CommunityEvent` (Task 2); `requireEventsAccess` (Task 3); `db`; `authMiddleware`, `adminOnly`; `validateBody`; `asyncHandler`.
- Produces: `eventsRouter`, exposing `GET /api/community/events` (list with `confirmed_count`, public to any active client via `requireEventsAccess`), `POST/PUT/DELETE /api/community/events[/:eventId]` (`adminOnly`), `POST/DELETE /api/community/events/:eventId/reserve` (`requireEventsAccess`), `GET /api/clients/:id/event-reservations` (`ownerOrAdmin + requireEventsAccess`).

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/events.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, communityEvents, eventReservations } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('events routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Events Client', email: `events-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(eventReservations).where(eq(eventReservations.clientId, clientId));
    await db.delete(communityEvents);
  });

  it('admin creates, updates, and deletes an event', async () => {
    const createRes = await request(app)
      .post('/api/community/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Sesión grupal', location: 'Estudio', capacity: 20 });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.event.id;

    const updateRes = await request(app)
      .put(`/api/community/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Sesión grupal actualizada' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.event.title).toBe('Sesión grupal actualizada');

    const deleteRes = await request(app).delete(`/api/community/events/${eventId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects a client from creating an event (admin-only)', async () => {
    const res = await request(app).post('/api/community/events').set('Authorization', `Bearer ${clientToken}`).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  it('lists active events with a confirmed_count of 0 when nobody has reserved', async () => {
    await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento sin reservas' });
    const res = await request(app).get('/api/community/events').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.events[0].confirmed_count).toBe(0);
  });

  it('a client reserves an event, confirmed_count increments, and a second reserve attempt is a 409', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;

    const reserveRes = await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reserveRes.status).toBe(201);
    expect(reserveRes.body.reservation.status).toBe('confirmada');

    const listRes = await request(app).get('/api/community/events').set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.events.find((e: { id: string }) => e.id === eventId).confirmed_count).toBe(1);

    const duplicateRes = await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(duplicateRes.status).toBe(409);
  });

  it('cancelling a reservation flips status and allows re-reserving (the legacy cancel/re-reserve bug, must NOT reproduce)', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;

    await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    const cancelRes = await request(app).delete(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(cancelRes.status).toBe(200);

    const reReserveRes = await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reReserveRes.status).toBe(201);
    expect(reReserveRes.body.reservation.status).toBe('confirmada');

    const rows = await db.select().from(eventReservations).where(eq(eventReservations.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('cancelling with no active reservation is a 404', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;
    const res = await request(app).delete(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });

  it('lists a client\'s own event reservations', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;
    await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);

    const res = await request(app).get(`/api/clients/${clientId}/event-reservations`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reservations).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/events.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/services/events.service.js'`

- [ ] **Step 3: Implement the service**

`apps/api/src/services/events.service.ts`:

```ts
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communityEvents, eventReservations, type CommunityEvent, type EventReservation } from '../models/schema.js';
import type { CommunityEventInput } from '@latribu/shared-types';

function toEventFields(input: Partial<CommunityEventInput>) {
  const fields: Record<string, unknown> = {};
  if (input.title !== undefined) fields.title = input.title;
  if (input.description !== undefined) fields.description = input.description;
  if (input.event_date !== undefined) fields.eventDate = input.event_date ? new Date(input.event_date) : null;
  if (input.location !== undefined) fields.location = input.location;
  if (input.capacity !== undefined) fields.capacity = input.capacity;
  if (input.image_url !== undefined) fields.imageUrl = input.image_url;
  if (input.active !== undefined) fields.active = input.active;
  if (input.sort_order !== undefined) fields.sortOrder = input.sort_order;
  return fields;
}

export async function listActiveEventsWithCounts(): Promise<Array<CommunityEvent & { confirmedCount: number }>> {
  const events = await db.select().from(communityEvents).where(eq(communityEvents.active, true)).orderBy(asc(communityEvents.eventDate));
  if (events.length === 0) return [];
  const confirmed = await db.select().from(eventReservations).where(eq(eventReservations.status, 'confirmada'));
  const countByEvent = new Map<string, number>();
  for (const r of confirmed) countByEvent.set(r.eventId, (countByEvent.get(r.eventId) ?? 0) + 1);
  return events.map((e) => ({ ...e, confirmedCount: countByEvent.get(e.id) ?? 0 }));
}

export async function createEvent(input: CommunityEventInput): Promise<CommunityEvent> {
  const [event] = await db.insert(communityEvents).values(toEventFields(input)).returning();
  return event;
}

export async function updateEvent(eventId: string, input: Partial<CommunityEventInput>): Promise<CommunityEvent | null> {
  const [event] = await db.update(communityEvents).set(toEventFields(input)).where(eq(communityEvents.id, eventId)).returning();
  return event ?? null;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await db.delete(communityEvents).where(eq(communityEvents.id, eventId));
}

export async function reserveEvent(eventId: string, clientId: string): Promise<{ reservation: EventReservation | null; conflict: boolean }> {
  const existing = await db
    .select()
    .from(eventReservations)
    .where(and(eq(eventReservations.eventId, eventId), eq(eventReservations.clientId, clientId)));
  if (existing[0]?.status === 'confirmada') return { reservation: null, conflict: true };

  if (existing[0]) {
    const [reservation] = await db
      .update(eventReservations)
      .set({ status: 'confirmada' })
      .where(eq(eventReservations.id, existing[0].id))
      .returning();
    return { reservation, conflict: false };
  }
  const [reservation] = await db.insert(eventReservations).values({ eventId, clientId }).returning();
  return { reservation, conflict: false };
}

export async function cancelEventReservation(eventId: string, clientId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(eventReservations)
    .where(and(eq(eventReservations.eventId, eventId), eq(eventReservations.clientId, clientId), eq(eventReservations.status, 'confirmada')));
  if (!existing[0]) return false;
  await db.update(eventReservations).set({ status: 'cancelada' }).where(eq(eventReservations.id, existing[0].id));
  return true;
}

export async function listClientEventReservations(clientId: string): Promise<EventReservation[]> {
  return db.select().from(eventReservations).where(eq(eventReservations.clientId, clientId));
}
```

- [ ] **Step 4: Implement the controller**

`apps/api/src/controllers/events.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { CommunityEventInput } from '@latribu/shared-types';
import * as eventsService from '../services/events.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listEvents(_req: Request, res: Response) {
  const events = await eventsService.listActiveEventsWithCounts();
  return ok(res, { events: events.map((e) => ({ ...e, confirmed_count: e.confirmedCount })) });
}

export async function createEvent(req: Request, res: Response) {
  const event = await eventsService.createEvent(req.body as CommunityEventInput);
  return ok(res, { event }, 201);
}

export async function updateEvent(req: Request, res: Response) {
  const event = await eventsService.updateEvent(req.params.eventId, req.body as Partial<CommunityEventInput>);
  if (!event) return err(res, 'Evento no encontrado.', 404);
  return ok(res, { event });
}

export async function deleteEvent(req: Request, res: Response) {
  await eventsService.deleteEvent(req.params.eventId);
  return ok(res, { message: 'Evento eliminado.' });
}

export async function reserveEvent(req: Request, res: Response) {
  if (req.user?.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
  const { reservation, conflict } = await eventsService.reserveEvent(req.params.eventId, req.user.id);
  if (conflict) return err(res, 'Ya tienes una reserva para este evento.', 409);
  return ok(res, { reservation }, 201);
}

export async function cancelEventReservation(req: Request, res: Response) {
  const cancelled = await eventsService.cancelEventReservation(req.params.eventId, req.user!.id);
  if (!cancelled) return err(res, 'No tienes una reserva para este evento.', 404);
  return ok(res, { message: 'Reserva cancelada.' });
}

export async function listClientEventReservations(req: Request, res: Response) {
  const reservations = await eventsService.listClientEventReservations(req.params.id);
  return ok(res, { reservations });
}
```

- [ ] **Step 5: Implement the routes**

`apps/api/src/routes/events.routes.ts`:

```ts
import { Router } from 'express';
import { CommunityEventInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireEventsAccess } from '../middleware/community-access.middleware.js';
import * as eventsController from '../controllers/events.controller.js';

export const eventsRouter = Router();

eventsRouter.get('/community/events', authMiddleware, requireEventsAccess, asyncHandler(eventsController.listEvents));

eventsRouter.post(
  '/community/events',
  authMiddleware,
  adminOnly,
  validateBody(CommunityEventInputSchema),
  asyncHandler(eventsController.createEvent)
);

eventsRouter.put('/community/events/:eventId', authMiddleware, adminOnly, asyncHandler(eventsController.updateEvent));

eventsRouter.delete('/community/events/:eventId', authMiddleware, adminOnly, asyncHandler(eventsController.deleteEvent));

eventsRouter.post(
  '/community/events/:eventId/reserve',
  authMiddleware,
  requireEventsAccess,
  asyncHandler(eventsController.reserveEvent)
);

eventsRouter.delete(
  '/community/events/:eventId/reserve',
  authMiddleware,
  requireEventsAccess,
  asyncHandler(eventsController.cancelEventReservation)
);

eventsRouter.get(
  '/clients/:id/event-reservations',
  authMiddleware,
  ownerOrAdmin,
  requireEventsAccess,
  asyncHandler(eventsController.listClientEventReservations)
);
```

Note the PUT route intentionally has no `validateBody` — legacy passes `req.body` through to `dbUpdate` unvalidated for this route (`server.js:1802-1810`); mirror that (the service's `toEventFields` already whitelists known fields, so this is safe, not an injection risk).

- [ ] **Step 6: Mount the router**

Modify `apps/api/src/app.ts` — add the import and `app.use('/api', eventsRouter);` alongside the other `/api`-level routers (`geoRouter`, `adminPhrasesRouter`, `adminQuotesRouter`, `restToolsRouter`, `adminCortisolTipsRouter`) — note this router's paths already include `/community` and `/clients/:id/...` prefixes internally, so it must mount at bare `/api`, not `/api/clients`.

- [ ] **Step 7: Run to verify it passes**

Run: `cd apps/api && npx vitest run test/events.routes.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 8: Run the full apps/api suite to confirm no regressions**

Run: `cd apps/api && npx vitest run`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/events.service.ts apps/api/src/controllers/events.controller.ts apps/api/src/routes/events.routes.ts apps/api/src/app.ts apps/api/test/events.routes.test.ts
git commit -m "feat(comunidad): add events API (CRUD + reserve/cancel)"
```

---

### Task 5: `apps/api` — Therapies (CRUD + reserve/cancel)

**Files:**
- Create: `apps/api/src/services/therapies.service.ts`
- Create: `apps/api/src/controllers/therapies.controller.ts`
- Create: `apps/api/src/routes/therapies.routes.ts`
- Modify: `apps/api/src/app.ts` (mount `therapiesRouter`)
- Test: `apps/api/test/therapies.routes.test.ts`

**Interfaces:**
- Consumes: `CommunityTherapyInputSchema` (Task 1); `communityTherapies`, `therapyReservations`, `type CommunityTherapy` (Task 2); `requireEventsAccess` (list route), `requireCommunityAccess` (reserve/cancel routes) (Task 3).
- Produces: `therapiesRouter`, exposing `GET /api/community/therapies` (`requireEventsAccess`), `POST/PUT/DELETE /api/community/therapies[/:therapyId]` (`adminOnly`), `POST/DELETE /api/community/therapies/:therapyId/reserve` (`requireCommunityAccess` — NOT `requireEventsAccess`, this is the one difference from events), `GET /api/clients/:id/therapy-reservations` (`ownerOrAdmin + requireCommunityAccess`).

This task is structurally identical to Task 4 — same patterns, same file shapes, only the access-control middleware on the reserve/cancel/list-mine routes differs (`requireCommunityAccess` instead of `requireEventsAccess`) and the domain fields differ (`discount_pct`/`provider` instead of `event_date`/`location`/`capacity`).

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/therapies.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, communityTherapies, therapyReservations } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('therapies routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Therapies Client', email: `therapies-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
    // requireCommunityAccess needs completed onboarding for a coaching client.
    await db.insert(personalInfo).values({ clientId, completedAt: new Date() });
  });

  afterAll(async () => {
    await db.delete(personalInfo).where(eq(personalInfo.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(therapyReservations).where(eq(therapyReservations.clientId, clientId));
    await db.delete(communityTherapies);
  });

  it('admin creates, updates, and deletes a therapy', async () => {
    const createRes = await request(app)
      .post('/api/community/therapies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Masaje', provider: 'Clínica Aliada', discount_pct: 30 });
    expect(createRes.status).toBe(201);
    const therapyId = createRes.body.therapy.id;

    const updateRes = await request(app)
      .put(`/api/community/therapies/${therapyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Masaje actualizado' });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app).delete(`/api/community/therapies/${therapyId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects a client from creating a therapy (admin-only)', async () => {
    const res = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${clientToken}`).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  it('a client reserves a therapy, confirmed_count increments, and a second reserve attempt is a 409', async () => {
    const createRes = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Terapia' });
    const therapyId = createRes.body.therapy.id;

    const reserveRes = await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reserveRes.status).toBe(201);

    const listRes = await request(app).get('/api/community/therapies').set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.therapies.find((t: { id: string }) => t.id === therapyId).confirmed_count).toBe(1);

    const duplicateRes = await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(duplicateRes.status).toBe(409);
  });

  it('cancelling a reservation flips status and allows re-reserving (the legacy cancel/re-reserve bug, must NOT reproduce)', async () => {
    const createRes = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Terapia' });
    const therapyId = createRes.body.therapy.id;

    await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    const cancelRes = await request(app).delete(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(cancelRes.status).toBe(200);

    const reReserveRes = await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reReserveRes.status).toBe(201);

    const rows = await db.select().from(therapyReservations).where(eq(therapyReservations.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('lists a client\'s own therapy reservations', async () => {
    const createRes = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Terapia' });
    const therapyId = createRes.body.therapy.id;
    await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);

    const res = await request(app).get(`/api/clients/${clientId}/therapy-reservations`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reservations).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/therapies.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/services/therapies.service.js'`

- [ ] **Step 3: Implement the service**

`apps/api/src/services/therapies.service.ts`:

```ts
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communityTherapies, therapyReservations, type CommunityTherapy, type TherapyReservation } from '../models/schema.js';
import type { CommunityTherapyInput } from '@latribu/shared-types';

function toTherapyFields(input: Partial<CommunityTherapyInput>) {
  const fields: Record<string, unknown> = {};
  if (input.title !== undefined) fields.title = input.title;
  if (input.description !== undefined) fields.description = input.description;
  if (input.discount_pct !== undefined) fields.discountPct = input.discount_pct;
  if (input.provider !== undefined) fields.provider = input.provider;
  if (input.image_url !== undefined) fields.imageUrl = input.image_url;
  if (input.active !== undefined) fields.active = input.active;
  if (input.sort_order !== undefined) fields.sortOrder = input.sort_order;
  return fields;
}

export async function listActiveTherapiesWithCounts(): Promise<Array<CommunityTherapy & { confirmedCount: number }>> {
  const therapies = await db.select().from(communityTherapies).where(eq(communityTherapies.active, true)).orderBy(asc(communityTherapies.sortOrder));
  if (therapies.length === 0) return [];
  const confirmed = await db.select().from(therapyReservations).where(eq(therapyReservations.status, 'confirmada'));
  const countByTherapy = new Map<string, number>();
  for (const r of confirmed) countByTherapy.set(r.therapyId, (countByTherapy.get(r.therapyId) ?? 0) + 1);
  return therapies.map((t) => ({ ...t, confirmedCount: countByTherapy.get(t.id) ?? 0 }));
}

export async function createTherapy(input: CommunityTherapyInput): Promise<CommunityTherapy> {
  const [therapy] = await db.insert(communityTherapies).values(toTherapyFields(input)).returning();
  return therapy;
}

export async function updateTherapy(therapyId: string, input: Partial<CommunityTherapyInput>): Promise<CommunityTherapy | null> {
  const [therapy] = await db.update(communityTherapies).set(toTherapyFields(input)).where(eq(communityTherapies.id, therapyId)).returning();
  return therapy ?? null;
}

export async function deleteTherapy(therapyId: string): Promise<void> {
  await db.delete(communityTherapies).where(eq(communityTherapies.id, therapyId));
}

export async function reserveTherapy(therapyId: string, clientId: string): Promise<{ reservation: TherapyReservation | null; conflict: boolean }> {
  const existing = await db
    .select()
    .from(therapyReservations)
    .where(and(eq(therapyReservations.therapyId, therapyId), eq(therapyReservations.clientId, clientId)));
  if (existing[0]?.status === 'confirmada') return { reservation: null, conflict: true };

  if (existing[0]) {
    const [reservation] = await db
      .update(therapyReservations)
      .set({ status: 'confirmada' })
      .where(eq(therapyReservations.id, existing[0].id))
      .returning();
    return { reservation, conflict: false };
  }
  const [reservation] = await db.insert(therapyReservations).values({ therapyId, clientId }).returning();
  return { reservation, conflict: false };
}

export async function cancelTherapyReservation(therapyId: string, clientId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(therapyReservations)
    .where(and(eq(therapyReservations.therapyId, therapyId), eq(therapyReservations.clientId, clientId), eq(therapyReservations.status, 'confirmada')));
  if (!existing[0]) return false;
  await db.update(therapyReservations).set({ status: 'cancelada' }).where(eq(therapyReservations.id, existing[0].id));
  return true;
}

export async function listClientTherapyReservations(clientId: string): Promise<TherapyReservation[]> {
  return db.select().from(therapyReservations).where(eq(therapyReservations.clientId, clientId));
}
```

- [ ] **Step 4: Implement the controller**

`apps/api/src/controllers/therapies.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { CommunityTherapyInput } from '@latribu/shared-types';
import * as therapiesService from '../services/therapies.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listTherapies(_req: Request, res: Response) {
  const therapies = await therapiesService.listActiveTherapiesWithCounts();
  return ok(res, { therapies: therapies.map((t) => ({ ...t, confirmed_count: t.confirmedCount })) });
}

export async function createTherapy(req: Request, res: Response) {
  const therapy = await therapiesService.createTherapy(req.body as CommunityTherapyInput);
  return ok(res, { therapy }, 201);
}

export async function updateTherapy(req: Request, res: Response) {
  const therapy = await therapiesService.updateTherapy(req.params.therapyId, req.body as Partial<CommunityTherapyInput>);
  if (!therapy) return err(res, 'Terapia no encontrada.', 404);
  return ok(res, { therapy });
}

export async function deleteTherapy(req: Request, res: Response) {
  await therapiesService.deleteTherapy(req.params.therapyId);
  return ok(res, { message: 'Terapia eliminada.' });
}

export async function reserveTherapy(req: Request, res: Response) {
  if (req.user?.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
  const { reservation, conflict } = await therapiesService.reserveTherapy(req.params.therapyId, req.user.id);
  if (conflict) return err(res, 'Ya tienes una reserva para esta terapia.', 409);
  return ok(res, { reservation }, 201);
}

export async function cancelTherapyReservation(req: Request, res: Response) {
  const cancelled = await therapiesService.cancelTherapyReservation(req.params.therapyId, req.user!.id);
  if (!cancelled) return err(res, 'No tienes una reserva para esta terapia.', 404);
  return ok(res, { message: 'Reserva cancelada.' });
}

export async function listClientTherapyReservations(req: Request, res: Response) {
  const reservations = await therapiesService.listClientTherapyReservations(req.params.id);
  return ok(res, { reservations });
}
```

- [ ] **Step 5: Implement the routes**

`apps/api/src/routes/therapies.routes.ts`:

```ts
import { Router } from 'express';
import { CommunityTherapyInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireEventsAccess, requireCommunityAccess } from '../middleware/community-access.middleware.js';
import * as therapiesController from '../controllers/therapies.controller.js';

export const therapiesRouter = Router();

therapiesRouter.get('/community/therapies', authMiddleware, requireEventsAccess, asyncHandler(therapiesController.listTherapies));

therapiesRouter.post(
  '/community/therapies',
  authMiddleware,
  adminOnly,
  validateBody(CommunityTherapyInputSchema),
  asyncHandler(therapiesController.createTherapy)
);

therapiesRouter.put('/community/therapies/:therapyId', authMiddleware, adminOnly, asyncHandler(therapiesController.updateTherapy));

therapiesRouter.delete('/community/therapies/:therapyId', authMiddleware, adminOnly, asyncHandler(therapiesController.deleteTherapy));

therapiesRouter.post(
  '/community/therapies/:therapyId/reserve',
  authMiddleware,
  requireCommunityAccess,
  asyncHandler(therapiesController.reserveTherapy)
);

therapiesRouter.delete(
  '/community/therapies/:therapyId/reserve',
  authMiddleware,
  requireCommunityAccess,
  asyncHandler(therapiesController.cancelTherapyReservation)
);

therapiesRouter.get(
  '/clients/:id/therapy-reservations',
  authMiddleware,
  ownerOrAdmin,
  requireCommunityAccess,
  asyncHandler(therapiesController.listClientTherapyReservations)
);
```

Note: the LIST route (`GET /community/therapies`) uses `requireEventsAccess` (the more open gate), while reserve/cancel/list-mine use `requireCommunityAccess` — this asymmetry is intentional legacy parity, documented in the Global Constraints section, not a bug to "fix" into consistency.

- [ ] **Step 6: Mount the router**

Modify `apps/api/src/app.ts` — add the import and `app.use('/api', therapiesRouter);` alongside `eventsRouter` from Task 4.

- [ ] **Step 7: Run to verify it passes**

Run: `cd apps/api && npx vitest run test/therapies.routes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 8: Run the full apps/api suite to confirm no regressions**

Run: `cd apps/api && npx vitest run`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/therapies.service.ts apps/api/src/controllers/therapies.controller.ts apps/api/src/routes/therapies.routes.ts apps/api/src/app.ts apps/api/test/therapies.routes.test.ts
git commit -m "feat(comunidad): add therapies API (CRUD + reserve/cancel)"
```

---

### Task 6: `apps/api` — Admin aggregate reservations view

**Files:**
- Create: `apps/api/src/services/community-reservations.service.ts`
- Create: `apps/api/src/controllers/community-reservations.controller.ts`
- Modify: `apps/api/src/routes/events.routes.ts` (add the aggregate route here, since it's `/api/community/reservations` — same URL family as events/therapies but genuinely cross-cutting; adding it to `eventsRouter` avoids a third near-empty router file)
- Test: `apps/api/test/community-reservations.routes.test.ts`

**Interfaces:**
- Consumes: `eventReservations`, `communityEvents`, `therapyReservations`, `communityTherapies`, `clients`, `personalInfo` (all in `apps/api/src/models/schema.ts`); `db`; `authMiddleware`, `adminOnly`.
- Produces: `GET /api/community/reservations` (admin-only), returning `{ eventReservations: [...], therapyReservations: [...] }`, each item enriched with client name/phone and event/therapy details, filtered to `status = 'confirmada'` only.

- [ ] **Step 1: Write the failing route test**

`apps/api/test/community-reservations.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, communityEvents, eventReservations, communityTherapies, therapyReservations } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('community reservations aggregate route', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let eventId: string;
  let therapyId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Reservations Client', email: `reservations-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    await db.insert(personalInfo).values({ clientId, phoneCode: '+52', phoneNumber: '5512345678' });

    const [event] = await db.insert(communityEvents).values({ title: 'Evento Test', location: 'Estudio' }).returning();
    eventId = event.id;
    await db.insert(eventReservations).values({ eventId, clientId, status: 'confirmada' });

    const [therapy] = await db.insert(communityTherapies).values({ title: 'Terapia Test', provider: 'Aliado' }).returning();
    therapyId = therapy.id;
    await db.insert(therapyReservations).values({ therapyId, clientId, status: 'confirmada' });
  });

  afterAll(async () => {
    await db.delete(eventReservations).where(eq(eventReservations.clientId, clientId));
    await db.delete(therapyReservations).where(eq(therapyReservations.clientId, clientId));
    await db.delete(communityEvents).where(eq(communityEvents.id, eventId));
    await db.delete(communityTherapies).where(eq(communityTherapies.id, therapyId));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects a non-admin', async () => {
    const clientToken = signToken({ id: clientId, role: 'cliente', name: 'X', email: 'x@a.com' });
    const res = await request(app).get('/api/community/reservations').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('returns confirmed event and therapy reservations enriched with client name, phone, and content details', async () => {
    const res = await request(app).get('/api/community/reservations').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const eventRes = res.body.eventReservations.find((r: { eventId: string }) => r.eventId === eventId);
    expect(eventRes).toBeDefined();
    expect(eventRes.clientName).toBe('Reservations Client');
    expect(eventRes.clientPhone).toBe('+52 5512345678');
    expect(eventRes.eventTitle).toBe('Evento Test');

    const therapyRes = res.body.therapyReservations.find((r: { therapyId: string }) => r.therapyId === therapyId);
    expect(therapyRes).toBeDefined();
    expect(therapyRes.therapyTitle).toBe('Terapia Test');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/community-reservations.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/services/community-reservations.service.js'`

- [ ] **Step 3: Implement the service**

`apps/api/src/services/community-reservations.service.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { eventReservations, communityEvents, therapyReservations, communityTherapies, clients, personalInfo } from '../models/schema.js';

function formatPhone(phoneCode: string | null, phoneNumber: string | null): string | null {
  const number = (phoneNumber || '').trim();
  if (!number) return null;
  const alreadyHasCode = !phoneCode || number.startsWith('+') || number.startsWith(phoneCode);
  return alreadyHasCode ? number : [phoneCode, number].filter(Boolean).join(' ');
}

export async function getConfirmedReservations() {
  const eventRows = await db
    .select({
      id: eventReservations.id,
      createdAt: eventReservations.createdAt,
      clientId: eventReservations.clientId,
      eventId: eventReservations.eventId,
      clientName: clients.name,
      eventTitle: communityEvents.title,
      eventDate: communityEvents.eventDate,
      eventLocation: communityEvents.location,
    })
    .from(eventReservations)
    .leftJoin(clients, eq(eventReservations.clientId, clients.id))
    .leftJoin(communityEvents, eq(eventReservations.eventId, communityEvents.id))
    .where(eq(eventReservations.status, 'confirmada'));

  const therapyRows = await db
    .select({
      id: therapyReservations.id,
      createdAt: therapyReservations.createdAt,
      clientId: therapyReservations.clientId,
      therapyId: therapyReservations.therapyId,
      clientName: clients.name,
      therapyTitle: communityTherapies.title,
      therapyProvider: communityTherapies.provider,
      therapyDiscountPct: communityTherapies.discountPct,
    })
    .from(therapyReservations)
    .leftJoin(clients, eq(therapyReservations.clientId, clients.id))
    .leftJoin(communityTherapies, eq(therapyReservations.therapyId, communityTherapies.id))
    .where(eq(therapyReservations.status, 'confirmada'));

  const clientIds = Array.from(new Set([...eventRows.map((r) => r.clientId), ...therapyRows.map((r) => r.clientId)]));
  const phoneByClientId = new Map<string, string | null>();
  if (clientIds.length > 0) {
    const infoRows = await db.select().from(personalInfo);
    for (const row of infoRows) {
      if (clientIds.includes(row.clientId)) {
        phoneByClientId.set(row.clientId, formatPhone(row.phoneCode, row.phoneNumber));
      }
    }
  }

  return {
    eventReservations: eventRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      clientName: r.clientName || 'Cliente eliminado',
      clientPhone: phoneByClientId.get(r.clientId) ?? null,
      eventId: r.eventId,
      eventTitle: r.eventTitle || 'Evento eliminado',
      eventDate: r.eventDate,
      eventLocation: r.eventLocation,
    })),
    therapyReservations: therapyRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      clientName: r.clientName || 'Cliente eliminado',
      clientPhone: phoneByClientId.get(r.clientId) ?? null,
      therapyId: r.therapyId,
      therapyTitle: r.therapyTitle || 'Terapia eliminada',
      therapyProvider: r.therapyProvider,
      therapyDiscountPct: r.therapyDiscountPct,
    })),
  };
}
```

If the `IN`-style lookup above (fetching all `personalInfo` rows and filtering in memory) is inefficient at scale, that's an acceptable simplification for this migration pass (legacy used a proper `.in('client_id', clientIds)` filter — you may use Drizzle's `inArray` operator instead if it's cleanly available, but do not block on this, a full-table scan is fine for this dataset size).

- [ ] **Step 4: Implement the controller**

`apps/api/src/controllers/community-reservations.controller.ts`:

```ts
import type { Request, Response } from 'express';
import * as reservationsService from '../services/community-reservations.service.js';

export async function getConfirmedReservations(_req: Request, res: Response) {
  const result = await reservationsService.getConfirmedReservations();
  return res.status(200).json({ success: true, ...result });
}
```

- [ ] **Step 5: Add the route to `events.routes.ts`**

Modify `apps/api/src/routes/events.routes.ts` — add the import `import * as communityReservationsController from '../controllers/community-reservations.controller.js';` and this route, alongside the existing ones in `eventsRouter`:

```ts
eventsRouter.get(
  '/community/reservations',
  authMiddleware,
  adminOnly,
  asyncHandler(communityReservationsController.getConfirmedReservations)
);
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd apps/api && npx vitest run test/community-reservations.routes.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Run the full apps/api suite to confirm no regressions**

Run: `cd apps/api && npx vitest run`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/community-reservations.service.ts apps/api/src/controllers/community-reservations.controller.ts apps/api/src/routes/events.routes.ts apps/api/test/community-reservations.routes.test.ts
git commit -m "feat(comunidad): add admin aggregate reservations view"
```

---

### Task 7: `apps/web` — Admin panels (events + therapies CRUD)

**Files:**
- Create: `apps/web/lib/events-client.ts`
- Create: `apps/web/lib/therapies-client.ts`
- Create: `apps/web/components/community/AdminEventsPanel.tsx`
- Create: `apps/web/components/community/AdminTherapiesPanel.tsx`
- Create: `apps/web/app/admin/community-events/page.tsx`
- Create: `apps/web/app/admin/community-therapies/page.tsx`
- Test: `apps/web/test/admin-events-panel.test.tsx`, `apps/web/test/admin-therapies-panel.test.tsx`

**Interfaces:**
- Consumes: `getSessionToken` from `../api-client`.
- Produces: `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `type CommunityEvent` from `events-client.ts`; `listTherapies`, `createTherapy`, `updateTherapy`, `deleteTherapy`, `type CommunityTherapy` from `therapies-client.ts`; `AdminEventsPanel`, `AdminTherapiesPanel` (no props, self-contained, mirroring `RestToolsAdminPanel`/`CortisolTipsPanel`'s pattern for global admin-managed content).

- [ ] **Step 1: Implement `apps/web/lib/events-client.ts`**

```ts
import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type CommunityEvent = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  location: string | null;
  capacity: number | null;
  active: boolean;
  confirmed_count: number;
};

export async function listEvents(): Promise<CommunityEvent[]> {
  const body = await authorizedRequest<{ success: boolean; events: CommunityEvent[]; error?: string }>('/api/community/events', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener eventos.');
  return body.events;
}

export async function createEvent(input: { title: string; description?: string; event_date?: string; location?: string; capacity?: number }): Promise<CommunityEvent> {
  const body = await authorizedRequest<{ success: boolean; event: CommunityEvent; error?: string }>('/api/community/events', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear el evento.');
  return body.event;
}

export async function updateEvent(eventId: string, input: Partial<{ title: string; description: string; event_date: string; location: string; capacity: number; active: boolean }>): Promise<CommunityEvent> {
  const body = await authorizedRequest<{ success: boolean; event: CommunityEvent; error?: string }>(`/api/community/events/${eventId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el evento.');
  return body.event;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/events/${eventId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el evento.');
}

export async function reserveEvent(eventId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/events/${eventId}/reserve`, 'POST');
  if (!body.success) throw new Error(body.error || 'Error al reservar.');
}

export async function cancelEventReservation(eventId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/events/${eventId}/reserve`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al cancelar la reserva.');
}

export async function listMyEventReservations(clientId: string): Promise<Array<{ eventId: string; status: string }>> {
  const body = await authorizedRequest<{ success: boolean; reservations: Array<{ eventId: string; status: string }>; error?: string }>(`/api/clients/${clientId}/event-reservations`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener tus reservas.');
  return body.reservations;
}
```

- [ ] **Step 2: Implement `apps/web/lib/therapies-client.ts`**

```ts
import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type CommunityTherapy = {
  id: string;
  title: string;
  description: string | null;
  discountPct: number | null;
  provider: string | null;
  active: boolean;
  confirmed_count: number;
};

export async function listTherapies(): Promise<CommunityTherapy[]> {
  const body = await authorizedRequest<{ success: boolean; therapies: CommunityTherapy[]; error?: string }>('/api/community/therapies', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener terapias.');
  return body.therapies;
}

export async function createTherapy(input: { title: string; description?: string; discount_pct?: number; provider?: string }): Promise<CommunityTherapy> {
  const body = await authorizedRequest<{ success: boolean; therapy: CommunityTherapy; error?: string }>('/api/community/therapies', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear la terapia.');
  return body.therapy;
}

export async function updateTherapy(therapyId: string, input: Partial<{ title: string; description: string; discount_pct: number; provider: string; active: boolean }>): Promise<CommunityTherapy> {
  const body = await authorizedRequest<{ success: boolean; therapy: CommunityTherapy; error?: string }>(`/api/community/therapies/${therapyId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar la terapia.');
  return body.therapy;
}

export async function deleteTherapy(therapyId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/therapies/${therapyId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la terapia.');
}

export async function reserveTherapy(therapyId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/therapies/${therapyId}/reserve`, 'POST');
  if (!body.success) throw new Error(body.error || 'Error al reservar.');
}

export async function cancelTherapyReservation(therapyId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/therapies/${therapyId}/reserve`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al cancelar la reserva.');
}

export async function listMyTherapyReservations(clientId: string): Promise<Array<{ therapyId: string; status: string }>> {
  const body = await authorizedRequest<{ success: boolean; reservations: Array<{ therapyId: string; status: string }>; error?: string }>(`/api/clients/${clientId}/therapy-reservations`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener tus reservas.');
  return body.reservations;
}
```

- [ ] **Step 3: Write the failing admin panel tests**

`apps/web/test/admin-events-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminEventsPanel } from '../components/community/AdminEventsPanel';
import * as eventsClient from '../lib/events-client';

vi.mock('../lib/events-client');

describe('AdminEventsPanel', () => {
  beforeEach(() => {
    vi.mocked(eventsClient.listEvents).mockResolvedValue([]);
  });

  it('lists existing events with their confirmed count', async () => {
    vi.mocked(eventsClient.listEvents).mockResolvedValue([
      { id: 'e1', title: 'Sesión grupal', description: null, eventDate: null, location: 'Estudio', capacity: 20, active: true, confirmed_count: 3 },
    ]);
    render(<AdminEventsPanel />);
    await waitFor(() => expect(screen.getByText('Sesión grupal')).toBeInTheDocument());
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('creates a new event', async () => {
    const user = userEvent.setup();
    vi.mocked(eventsClient.createEvent).mockResolvedValue({ id: 'e2', title: 'Nuevo evento', description: null, eventDate: null, location: null, capacity: null, active: true, confirmed_count: 0 });
    render(<AdminEventsPanel />);
    await waitFor(() => screen.getByLabelText('Título del evento'));

    await user.type(screen.getByLabelText('Título del evento'), 'Nuevo evento');
    await user.click(screen.getByRole('button', { name: '+ Agregar evento' }));

    await waitFor(() => expect(eventsClient.createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nuevo evento' })));
  });

  it('deletes an event', async () => {
    const user = userEvent.setup();
    vi.mocked(eventsClient.listEvents).mockResolvedValue([
      { id: 'e1', title: 'Sesión grupal', description: null, eventDate: null, location: null, capacity: null, active: true, confirmed_count: 0 },
    ]);
    render(<AdminEventsPanel />);
    await waitFor(() => screen.getByText('Sesión grupal'));

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(eventsClient.deleteEvent).toHaveBeenCalledWith('e1'));
  });
});
```

`apps/web/test/admin-therapies-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminTherapiesPanel } from '../components/community/AdminTherapiesPanel';
import * as therapiesClient from '../lib/therapies-client';

vi.mock('../lib/therapies-client');

describe('AdminTherapiesPanel', () => {
  beforeEach(() => {
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([]);
  });

  it('lists existing therapies', async () => {
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([
      { id: 't1', title: 'Masaje', description: null, discountPct: 30, provider: 'Aliado', active: true, confirmed_count: 2 },
    ]);
    render(<AdminTherapiesPanel />);
    await waitFor(() => expect(screen.getByText('Masaje')).toBeInTheDocument());
  });

  it('creates a new therapy', async () => {
    const user = userEvent.setup();
    vi.mocked(therapiesClient.createTherapy).mockResolvedValue({ id: 't2', title: 'Nueva terapia', description: null, discountPct: null, provider: null, active: true, confirmed_count: 0 });
    render(<AdminTherapiesPanel />);
    await waitFor(() => screen.getByLabelText('Título de la terapia'));

    await user.type(screen.getByLabelText('Título de la terapia'), 'Nueva terapia');
    await user.click(screen.getByRole('button', { name: '+ Agregar terapia' }));

    await waitFor(() => expect(therapiesClient.createTherapy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nueva terapia' })));
  });

  it('deletes a therapy', async () => {
    const user = userEvent.setup();
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([
      { id: 't1', title: 'Masaje', description: null, discountPct: null, provider: null, active: true, confirmed_count: 0 },
    ]);
    render(<AdminTherapiesPanel />);
    await waitFor(() => screen.getByText('Masaje'));

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(therapiesClient.deleteTherapy).toHaveBeenCalledWith('t1'));
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd apps/web && npx vitest run test/admin-events-panel.test.tsx test/admin-therapies-panel.test.tsx`
Expected: FAIL — `Cannot find module '../components/community/AdminEventsPanel'`

- [ ] **Step 5: Implement `AdminEventsPanel`**

`apps/web/components/community/AdminEventsPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { listEvents, createEvent, deleteEvent, type CommunityEvent } from '../../lib/events-client';

export function AdminEventsPanel() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    setEvents(await listEvents());
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    try {
      await createEvent({ title: title.trim(), location: location || undefined, capacity: capacity ? Number(capacity) : undefined });
      setTitle('');
      setLocation('');
      setCapacity('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(eventId: string) {
    try {
      await deleteEvent(eventId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando eventos...</p>;

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="event-title">Título del evento</label>
      <input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="event-location">Ubicación</label>
      <input id="event-location" value={location} onChange={(e) => setLocation(e.target.value)} />
      <label htmlFor="event-capacity">Capacidad</label>
      <input id="event-capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      <button type="button" onClick={handleCreate}>
        + Agregar evento
      </button>

      {events.length === 0 ? (
        <p>Aún no hay eventos.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              {event.title} — {event.confirmed_count} confirmados
              <button type="button" onClick={() => handleDelete(event.id)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Implement `AdminTherapiesPanel`**

`apps/web/components/community/AdminTherapiesPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { listTherapies, createTherapy, deleteTherapy, type CommunityTherapy } from '../../lib/therapies-client';

export function AdminTherapiesPanel() {
  const [therapies, setTherapies] = useState<CommunityTherapy[]>([]);
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    setTherapies(await listTherapies());
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    try {
      await createTherapy({ title: title.trim(), provider: provider || undefined, discount_pct: discountPct ? Number(discountPct) : undefined });
      setTitle('');
      setProvider('');
      setDiscountPct('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(therapyId: string) {
    try {
      await deleteTherapy(therapyId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando terapias...</p>;

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="therapy-title">Título de la terapia</label>
      <input id="therapy-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="therapy-provider">Aliado</label>
      <input id="therapy-provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
      <label htmlFor="therapy-discount">Descuento (%)</label>
      <input id="therapy-discount" type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
      <button type="button" onClick={handleCreate}>
        + Agregar terapia
      </button>

      {therapies.length === 0 ? (
        <p>Aún no hay terapias.</p>
      ) : (
        <ul>
          {therapies.map((therapy) => (
            <li key={therapy.id}>
              {therapy.title} — {therapy.confirmed_count} confirmados
              <button type="button" onClick={() => handleDelete(therapy.id)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Implement the two admin pages**

`apps/web/app/admin/community-events/page.tsx`:

```tsx
'use client';

import { AdminEventsPanel } from '../../../components/community/AdminEventsPanel';

export default function AdminCommunityEventsPage() {
  return (
    <div>
      <h1>Eventos de Comunidad</h1>
      <AdminEventsPanel />
    </div>
  );
}
```

`apps/web/app/admin/community-therapies/page.tsx`:

```tsx
'use client';

import { AdminTherapiesPanel } from '../../../components/community/AdminTherapiesPanel';

export default function AdminCommunityTherapiesPage() {
  return (
    <div>
      <h1>Terapias de Comunidad</h1>
      <AdminTherapiesPanel />
    </div>
  );
}
```

- [ ] **Step 8: Run to verify tests pass**

Run: `cd apps/web && npx vitest run test/admin-events-panel.test.tsx test/admin-therapies-panel.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/events-client.ts apps/web/lib/therapies-client.ts apps/web/components/community/AdminEventsPanel.tsx apps/web/components/community/AdminTherapiesPanel.tsx apps/web/app/admin/community-events apps/web/app/admin/community-therapies apps/web/test/admin-events-panel.test.tsx apps/web/test/admin-therapies-panel.test.tsx
git commit -m "feat(comunidad): add admin panels for events and therapies"
```

---

### Task 8: `apps/web` — Client-facing browse + reserve/cancel pages

**Files:**
- Create: `apps/web/components/community/ClientEventsPanel.tsx`
- Create: `apps/web/components/community/ClientTherapiesPanel.tsx`
- Create: `apps/web/app/community/events/page.tsx`
- Create: `apps/web/app/community/therapies/page.tsx`
- Test: `apps/web/test/client-events-panel.test.tsx`, `apps/web/test/client-therapies-panel.test.tsx`

**Interfaces:**
- Consumes: `listEvents`, `reserveEvent`, `cancelEventReservation`, `listMyEventReservations`, `type CommunityEvent` (Task 7); `listTherapies`, `reserveTherapy`, `cancelTherapyReservation`, `listMyTherapyReservations`, `type CommunityTherapy` (Task 7); `getSessionToken` from `../lib/api-client`.
- Produces: `ClientEventsPanel`, `ClientTherapiesPanel` (`clientId: string` prop), `EventsPage`, `TherapiesPage` (decode `clientId` from JWT, same pattern as `app/training/page.tsx`).

**This task is the explicit fix for the missing "Cancelar reserva" button** (see Global Constraints) — each panel must show, per item, either a "Reservar" button (if the client has no confirmed reservation for it) or a "Cancelar reserva" button (if they do) — never both at once, and the button must flip immediately after the action succeeds (refetch the reservation list).

- [ ] **Step 1: Write the failing panel tests**

`apps/web/test/client-events-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientEventsPanel } from '../components/community/ClientEventsPanel';
import * as eventsClient from '../lib/events-client';

vi.mock('../lib/events-client');

describe('ClientEventsPanel', () => {
  it('shows a "Reservar" button when the client has no reservation for an event', async () => {
    vi.mocked(eventsClient.listEvents).mockResolvedValue([
      { id: 'e1', title: 'Sesión grupal', description: null, eventDate: null, location: null, capacity: null, active: true, confirmed_count: 0 },
    ]);
    vi.mocked(eventsClient.listMyEventReservations).mockResolvedValue([]);
    render(<ClientEventsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument());
  });

  it('shows a "Cancelar reserva" button when the client already has a confirmed reservation', async () => {
    vi.mocked(eventsClient.listEvents).mockResolvedValue([
      { id: 'e1', title: 'Sesión grupal', description: null, eventDate: null, location: null, capacity: null, active: true, confirmed_count: 1 },
    ]);
    vi.mocked(eventsClient.listMyEventReservations).mockResolvedValue([{ eventId: 'e1', status: 'confirmada' }]);
    render(<ClientEventsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Reservar' })).not.toBeInTheDocument();
  });

  it('reserving an event calls reserveEvent and flips the button to Cancelar reserva', async () => {
    const user = userEvent.setup();
    vi.mocked(eventsClient.listEvents).mockResolvedValue([
      { id: 'e1', title: 'Sesión grupal', description: null, eventDate: null, location: null, capacity: null, active: true, confirmed_count: 0 },
    ]);
    vi.mocked(eventsClient.listMyEventReservations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ eventId: 'e1', status: 'confirmada' }]);
    vi.mocked(eventsClient.reserveEvent).mockResolvedValue(undefined);

    render(<ClientEventsPanel clientId="client-1" />);
    await waitFor(() => screen.getByRole('button', { name: 'Reservar' }));
    await user.click(screen.getByRole('button', { name: 'Reservar' }));

    await waitFor(() => expect(eventsClient.reserveEvent).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument());
  });

  it('cancelling a reservation calls cancelEventReservation and flips the button back to Reservar', async () => {
    const user = userEvent.setup();
    vi.mocked(eventsClient.listEvents).mockResolvedValue([
      { id: 'e1', title: 'Sesión grupal', description: null, eventDate: null, location: null, capacity: null, active: true, confirmed_count: 1 },
    ]);
    vi.mocked(eventsClient.listMyEventReservations)
      .mockResolvedValueOnce([{ eventId: 'e1', status: 'confirmada' }])
      .mockResolvedValueOnce([]);
    vi.mocked(eventsClient.cancelEventReservation).mockResolvedValue(undefined);

    render(<ClientEventsPanel clientId="client-1" />);
    await waitFor(() => screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(eventsClient.cancelEventReservation).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument());
  });
});
```

`apps/web/test/client-therapies-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientTherapiesPanel } from '../components/community/ClientTherapiesPanel';
import * as therapiesClient from '../lib/therapies-client';

vi.mock('../lib/therapies-client');

describe('ClientTherapiesPanel', () => {
  it('shows a "Reservar" button when the client has no reservation for a therapy', async () => {
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([
      { id: 't1', title: 'Masaje', description: null, discountPct: null, provider: null, active: true, confirmed_count: 0 },
    ]);
    vi.mocked(therapiesClient.listMyTherapyReservations).mockResolvedValue([]);
    render(<ClientTherapiesPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument());
  });

  it('shows a "Cancelar reserva" button when the client already has a confirmed reservation', async () => {
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([
      { id: 't1', title: 'Masaje', description: null, discountPct: null, provider: null, active: true, confirmed_count: 1 },
    ]);
    vi.mocked(therapiesClient.listMyTherapyReservations).mockResolvedValue([{ therapyId: 't1', status: 'confirmada' }]);
    render(<ClientTherapiesPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument());
  });

  it('cancelling a therapy reservation calls cancelTherapyReservation', async () => {
    const user = userEvent.setup();
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([
      { id: 't1', title: 'Masaje', description: null, discountPct: null, provider: null, active: true, confirmed_count: 1 },
    ]);
    vi.mocked(therapiesClient.listMyTherapyReservations)
      .mockResolvedValueOnce([{ therapyId: 't1', status: 'confirmada' }])
      .mockResolvedValueOnce([]);
    vi.mocked(therapiesClient.cancelTherapyReservation).mockResolvedValue(undefined);

    render(<ClientTherapiesPanel clientId="client-1" />);
    await waitFor(() => screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));

    await waitFor(() => expect(therapiesClient.cancelTherapyReservation).toHaveBeenCalledWith('t1'));
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && npx vitest run test/client-events-panel.test.tsx test/client-therapies-panel.test.tsx`
Expected: FAIL — `Cannot find module '../components/community/ClientEventsPanel'`

- [ ] **Step 3: Implement `ClientEventsPanel`**

`apps/web/components/community/ClientEventsPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { listEvents, reserveEvent, cancelEventReservation, listMyEventReservations, type CommunityEvent } from '../../lib/events-client';

export function ClientEventsPanel({ clientId }: { clientId: string }) {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [reservedIds, setReservedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    const [eventList, reservations] = await Promise.all([listEvents(), listMyEventReservations(clientId)]);
    setEvents(eventList);
    setReservedIds(new Set(reservations.filter((r) => r.status === 'confirmada').map((r) => r.eventId)));
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleReserve(eventId: string) {
    try {
      await reserveEvent(eventId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCancel(eventId: string) {
    try {
      await cancelEventReservation(eventId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando eventos...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (events.length === 0) return <p>No hay eventos disponibles por ahora.</p>;

  return (
    <ul>
      {events.map((event) => (
        <li key={event.id}>
          {event.title} {event.location ? `— ${event.location}` : ''}
          {reservedIds.has(event.id) ? (
            <button type="button" onClick={() => handleCancel(event.id)}>
              Cancelar reserva
            </button>
          ) : (
            <button type="button" onClick={() => handleReserve(event.id)}>
              Reservar
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Implement `ClientTherapiesPanel`**

`apps/web/components/community/ClientTherapiesPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { listTherapies, reserveTherapy, cancelTherapyReservation, listMyTherapyReservations, type CommunityTherapy } from '../../lib/therapies-client';

export function ClientTherapiesPanel({ clientId }: { clientId: string }) {
  const [therapies, setTherapies] = useState<CommunityTherapy[]>([]);
  const [reservedIds, setReservedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    const [therapyList, reservations] = await Promise.all([listTherapies(), listMyTherapyReservations(clientId)]);
    setTherapies(therapyList);
    setReservedIds(new Set(reservations.filter((r) => r.status === 'confirmada').map((r) => r.therapyId)));
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleReserve(therapyId: string) {
    try {
      await reserveTherapy(therapyId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCancel(therapyId: string) {
    try {
      await cancelTherapyReservation(therapyId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando terapias...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (therapies.length === 0) return <p>No hay terapias disponibles por ahora.</p>;

  return (
    <ul>
      {therapies.map((therapy) => (
        <li key={therapy.id}>
          {therapy.title} {therapy.provider ? `— ${therapy.provider}` : ''}
          {reservedIds.has(therapy.id) ? (
            <button type="button" onClick={() => handleCancel(therapy.id)}>
              Cancelar reserva
            </button>
          ) : (
            <button type="button" onClick={() => handleReserve(therapy.id)}>
              Reservar
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Run the panel tests to verify they pass**

Run: `cd apps/web && npx vitest run test/client-events-panel.test.tsx test/client-therapies-panel.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 6: Implement the two client pages**

`apps/web/app/community/events/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '../../../lib/api-client';
import { ClientEventsPanel } from '../../../components/community/ClientEventsPanel';

function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

export default function CommunityEventsPage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (token) setClientId(decodeClientIdFromToken(token));
  }, []);

  return (
    <div>
      <h1>Eventos</h1>
      {clientId && <ClientEventsPanel clientId={clientId} />}
    </div>
  );
}
```

`apps/web/app/community/therapies/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '../../../lib/api-client';
import { ClientTherapiesPanel } from '../../../components/community/ClientTherapiesPanel';

function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

export default function CommunityTherapiesPage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (token) setClientId(decodeClientIdFromToken(token));
  }, []);

  return (
    <div>
      <h1>Terapias</h1>
      {clientId && <ClientTherapiesPanel clientId={clientId} />}
    </div>
  );
}
```

- [ ] **Step 7: Run the full apps/web suite to confirm no regressions**

Run: `cd apps/web && npx vitest run`
Expected: all tests pass (the pre-existing unrelated `wizard-shell-finalize.test.tsx` flake under parallel load is known — re-run standalone if it's the only failure)

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/community/ClientEventsPanel.tsx apps/web/components/community/ClientTherapiesPanel.tsx apps/web/app/community apps/web/test/client-events-panel.test.tsx apps/web/test/client-therapies-panel.test.tsx
git commit -m "feat(comunidad): add client-facing browse+reserve pages with cancel-reservation button"
```

---

### Task 9: `apps/web` — Admin reservations aggregate page

**Files:**
- Create: `apps/web/lib/community-reservations-client.ts`
- Create: `apps/web/components/community/AdminReservationsPanel.tsx`
- Create: `apps/web/app/admin/community-reservations/page.tsx`
- Test: `apps/web/test/admin-reservations-panel.test.tsx`

**Interfaces:**
- Consumes: `getSessionToken` from `../api-client`.
- Produces: `getConfirmedReservations` from `community-reservations-client.ts`; `AdminReservationsPanel` (no props, self-contained).

- [ ] **Step 1: Implement `apps/web/lib/community-reservations-client.ts`**

```ts
import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export type EventReservationRow = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  eventTitle: string;
  eventDate: string | null;
  eventLocation: string | null;
};

export type TherapyReservationRow = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  therapyTitle: string;
  therapyProvider: string | null;
  therapyDiscountPct: number | null;
};

export async function getConfirmedReservations(): Promise<{ eventReservations: EventReservationRow[]; therapyReservations: TherapyReservationRow[] }> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/community/reservations`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al obtener las reservas.');
  return { eventReservations: body.eventReservations, therapyReservations: body.therapyReservations };
}
```

- [ ] **Step 2: Write the failing test**

`apps/web/test/admin-reservations-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminReservationsPanel } from '../components/community/AdminReservationsPanel';
import * as reservationsClient from '../lib/community-reservations-client';

vi.mock('../lib/community-reservations-client');

describe('AdminReservationsPanel', () => {
  it('lists event and therapy reservations with client name and phone', async () => {
    vi.mocked(reservationsClient.getConfirmedReservations).mockResolvedValue({
      eventReservations: [{ id: 'r1', clientName: 'Ana', clientPhone: '+52 5512345678', eventTitle: 'Sesión grupal', eventDate: null, eventLocation: 'Estudio' }],
      therapyReservations: [{ id: 'r2', clientName: 'Beto', clientPhone: null, therapyTitle: 'Masaje', therapyProvider: 'Aliado', therapyDiscountPct: 30 }],
    });
    render(<AdminReservationsPanel />);
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());
    expect(screen.getByText('Sesión grupal')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
    expect(screen.getByText('Masaje')).toBeInTheDocument();
  });

  it('shows a message when there are no reservations at all', async () => {
    vi.mocked(reservationsClient.getConfirmedReservations).mockResolvedValue({ eventReservations: [], therapyReservations: [] });
    render(<AdminReservationsPanel />);
    await waitFor(() => expect(screen.getByText('Sin reservas confirmadas por ahora.')).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/web && npx vitest run test/admin-reservations-panel.test.tsx`
Expected: FAIL — `Cannot find module '../components/community/AdminReservationsPanel'`

- [ ] **Step 4: Implement `AdminReservationsPanel`**

`apps/web/components/community/AdminReservationsPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getConfirmedReservations, type EventReservationRow, type TherapyReservationRow } from '../../lib/community-reservations-client';

export function AdminReservationsPanel() {
  const [eventReservations, setEventReservations] = useState<EventReservationRow[]>([]);
  const [therapyReservations, setTherapyReservations] = useState<TherapyReservationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfirmedReservations()
      .then((result) => {
        setEventReservations(result.eventReservations);
        setTherapyReservations(result.therapyReservations);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando reservas...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (eventReservations.length === 0 && therapyReservations.length === 0) return <p>Sin reservas confirmadas por ahora.</p>;

  return (
    <div>
      <h2>Eventos</h2>
      {eventReservations.length === 0 ? (
        <p>Sin reservas de eventos.</p>
      ) : (
        <ul>
          {eventReservations.map((r) => (
            <li key={r.id}>
              {r.clientName} {r.clientPhone ? `(${r.clientPhone})` : ''} — {r.eventTitle} {r.eventLocation ? `@ ${r.eventLocation}` : ''}
            </li>
          ))}
        </ul>
      )}

      <h2>Terapias</h2>
      {therapyReservations.length === 0 ? (
        <p>Sin reservas de terapias.</p>
      ) : (
        <ul>
          {therapyReservations.map((r) => (
            <li key={r.id}>
              {r.clientName} {r.clientPhone ? `(${r.clientPhone})` : ''} — {r.therapyTitle} {r.therapyProvider ? `@ ${r.therapyProvider}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement the page**

`apps/web/app/admin/community-reservations/page.tsx`:

```tsx
'use client';

import { AdminReservationsPanel } from '../../../components/community/AdminReservationsPanel';

export default function AdminCommunityReservationsPage() {
  return (
    <div>
      <h1>Reservas de Comunidad</h1>
      <AdminReservationsPanel />
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd apps/web && npx vitest run test/admin-reservations-panel.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Run the full apps/web suite to confirm no regressions**

Run: `cd apps/web && npx vitest run`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/community-reservations-client.ts apps/web/components/community/AdminReservationsPanel.tsx apps/web/app/admin/community-reservations apps/web/test/admin-reservations-panel.test.tsx
git commit -m "feat(comunidad): add admin reservations aggregate page"
```

---

### Task 10: Manual production migration + `schema.sql` verification

**Files:**
- Verify (no changes expected): `schema.sql` lines covering `community_events`, `event_reservations`, `community_therapies`, `therapy_reservations`
- Create: `tasks/migration-2026-08-02-comunidad.sql`

**Interfaces:**
- None — this task only produces a SQL file for the user to run manually in the Supabase SQL Editor, following the exact same convention as every prior module's migration file.

- [ ] **Step 1: Diff `schema.sql` against `apps/api/src/models/schema.ts` for these 4 tables**

Run: `grep -n "CREATE TABLE community_events\|CREATE TABLE event_reservations\|CREATE TABLE community_therapies\|CREATE TABLE therapy_reservations" -A 15 schema.sql` and compare column-by-column against the Drizzle definitions from Task 2. Note any discrepancy precisely rather than silently "fixing" either file — in particular, the `status TEXT ... CHECK (status IN ('confirmada','cancelada'))` constraints on both reservation tables are expected to NOT have a matching Drizzle-level `CHECK`, the same accepted app/DB split already established elsewhere in this codebase — don't treat that as a new problem.

- [ ] **Step 2: Write the idempotent migration SQL**

`tasks/migration-2026-08-02-comunidad.sql`:

```sql
-- Migración manual para Comunidad (community_events, event_reservations,
-- community_therapies, therapy_reservations). Correr en el Supabase SQL
-- Editor de producción. Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  location TEXT,
  capacity INT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, client_id)
);

CREATE TABLE IF NOT EXISTS community_therapies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  discount_pct INT DEFAULT 0,
  provider TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS therapy_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapy_id UUID NOT NULL REFERENCES community_therapies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(therapy_id, client_id)
);
```

- [ ] **Step 3: Verification query (run manually after applying, not part of this repo)**

Document in the commit message or final report that the user should run, in the Supabase SQL Editor, after applying:

```sql
SELECT table_name, count(*) AS column_count
FROM information_schema.columns
WHERE table_name IN ('community_events', 'event_reservations', 'community_therapies', 'therapy_reservations')
GROUP BY table_name;
```

Expected: `community_events` → 10, `event_reservations` → 5, `community_therapies` → 9, `therapy_reservations` → 5.

- [ ] **Step 4: Commit**

```bash
git add tasks/migration-2026-08-02-comunidad.sql
git commit -m "docs(comunidad): add manual production migration SQL"
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `req.client.clientType` (or however `auth.middleware.ts` actually names the field on its `ClientAuthRow` type) may not match exactly what Task 3's middleware assumes | Medium | Task 3 Step 3 explicitly instructs checking the real type shape in `auth.middleware.ts` before writing the community-access middleware — don't guess |
| Ten total tasks is a large plan; task-to-task drift (e.g. events vs. therapies middleware asymmetry) could get silently "fixed into consistency" by an implementer who doesn't read the Global Constraints closely | Medium | Task 4/5's briefs both explicitly restate the asymmetry (`requireEventsAccess` on events reserve/cancel, `requireCommunityAccess` on therapies reserve/cancel) with a pointer to the legacy line numbers proving it's intentional |
| Production DB still lacks these 4 tables after this plan lands | High if deploy happens first | Task 10's SQL must be run in Supabase **before** `git push origin main` ships this code |
| `packages/shared-types`'s `dist/` must be rebuilt (`npx tsc`) after this plan lands on `main`, or `apps/api` will 500 on any community route — this exact failure mode has hit three prior merges | Medium | Note explicitly in the final report: run `cd packages/shared-types && npx tsc -p tsconfig.json` immediately after merging to `main`, before running any test suite or dev server there |

## Open Questions

None — legacy behavior (`server.js:335-374`, `1774-2008`, `schema.sql:376-417`) is fully specified and this plan mirrors it exactly, changing only the underlying stack, plus the one explicit, in-scope frontend addition (the cancel-reservation button) documented in Global Constraints.
