# Descanso — Protocolo de Sueño Personalizado — Migración a la Arquitectura Nueva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the legacy sleep-protocol module (`sleep_protocols`, `sleep_logs`) from `server.js`/`index.html` to the new stack (`apps/api` + `apps/web`), following the exact Routes → Controllers → Services → Models pattern already used for every prior module. This is distinct from the already-migrated "Herramientas para Dormir" (`rest_tools`) — this module is the mentor-authored personalized sleep protocol plus the client's daily sleep log used by Mi Evolución.

**Architecture:** One new client-scoped router (`sleepRouter`) mounted at `/api/clients`, backed by two new Drizzle tables. Frontend: an admin panel embedded in the existing client-detail page (mirroring `AdminNutritionPanel`'s plan-form pattern), plus a client-facing `/sleep-protocol` page (protocol view + a quick daily-log form, mirroring `/nutrition`'s client-panel structure).

**Tech Stack:** Same as the rest of the monorepo — TypeScript, Express 4, Drizzle ORM + `postgres` driver, Zod, Next.js App Router, Vitest + Testing Library.

## Global Constraints

- No design/styling work — plain functional HTML only, matching every other migrated module.
- `GET /:id/sleep-protocol` and `GET/POST` sleep-log routes use `authMiddleware` + `ownerOrAdmin` only — **no `requirePermission` gate**, matching legacy exactly (`server.js:2014`, `2038`, `2051`, `2061` — none of them call `requirePermission`). The code comment at `server.js:2010-2011` ("solo coaching_1_1/online") describes an intended frontend restriction, not a backend gate — do not add a permission check that legacy doesn't enforce.
- `PUT /:id/sleep-protocol` uses `authMiddleware` + `adminOnly` — the mentor writes the protocol, the client only reads it.
- `sleep_logs` is **one-row-per-client-per-day** (`UNIQUE(client_id, date)`): `POST /:id/sleep-log` is an upsert on `(client_id, date=today)` — a second call the same day updates the existing row (new `hours`/`quality`/`logged_at`), never creates a second row. This matches `server.js:2066-2071`'s explicit `.upsert(..., { onConflict: 'client_id,date' })`.
- `sleep_logs.hours` is `NUMERIC(3,1)` (e.g. `7.5`) and `quality` is an integer `1-5` — validate both at the Zod layer (`hours` positive number, `quality` int between 1 and 5 inclusive, matching the DB `CHECK (quality BETWEEN 1 AND 5)`).
- `GET /:id/sleep-protocol` returns `{ protocol: null }` (not a 404) when no protocol has been written yet — matches `server.js:2016-2017`'s `protocol || null`.
- Tests run against the dedicated test Postgres database via `apps/api/test/helpers/setupTestEnv.ts` (already wired) — never mocks, never production.
- `schema.sql` already has `sleep_protocols` (lines 363-370) and `sleep_logs` (lines 448-456) — verify no drift against the Drizzle definitions added in Task 2.

## File Structure

```
packages/shared-types/src/
  sleep.ts                              ← NEW: SleepProtocolUpdateSchema, SleepLogInputSchema
  index.ts                              ← MODIFY: re-export
apps/api/
  src/models/schema.ts                  ← MODIFY: add sleepProtocols, sleepLogs tables + types
  src/services/sleep.service.ts         ← NEW
  src/controllers/sleep.controller.ts   ← NEW
  src/routes/sleep.routes.ts            ← NEW
  src/app.ts                            ← MODIFY: mount sleepRouter at /api/clients
  test/sleep.routes.test.ts             ← NEW
apps/web/
  lib/sleep-client.ts                   ← NEW
  components/sleep/AdminSleepProtocolPanel.tsx  ← NEW
  components/sleep/ClientSleepPanel.tsx ← NEW
  app/admin/clients/[id]/page.tsx       ← MODIFY: embed AdminSleepProtocolPanel as a new section
  app/sleep-protocol/page.tsx           ← NEW
  test/admin-sleep-protocol-panel.test.tsx  ← NEW
  test/client-sleep-panel.test.tsx      ← NEW
  test/sleep-protocol-page.test.tsx     ← NEW
tasks/migration-2026-08-02-sleep-protocol.sql  ← NEW: manual prod migration
```

---

### Task 1: Shared Zod schemas for sleep protocol and sleep logs

**Files:**
- Create: `packages/shared-types/src/sleep.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/test/sleep.test.ts`

**Interfaces:**
- Produces: `SleepProtocolUpdateSchema` (+ `SleepProtocolUpdate`), `SleepLogInputSchema` (+ `SleepLogInput`). Consumed by Task 3 (`apps/api`).

- [ ] **Step 1: Write the failing tests**

`packages/shared-types/test/sleep.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SleepProtocolUpdateSchema, SleepLogInputSchema } from '../src/sleep.js';

describe('sleep protocol schema', () => {
  it('accepts a full protocol update', () => {
    const result = SleepProtocolUpdateSchema.safeParse({
      protocol_text: 'Apaga pantallas 1h antes de dormir.',
      sleep_window: '22:30 - 06:30',
      supplement: 'Magnesio 400mg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty patch (all fields optional)', () => {
    expect(SleepProtocolUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts null values (clearing a field)', () => {
    const result = SleepProtocolUpdateSchema.safeParse({ supplement: null });
    expect(result.success).toBe(true);
  });
});

describe('sleep log schema', () => {
  it('accepts a valid log', () => {
    const result = SleepLogInputSchema.safeParse({ hours: 7.5, quality: 4 });
    expect(result.success).toBe(true);
  });

  it('rejects missing hours', () => {
    expect(SleepLogInputSchema.safeParse({ quality: 4 }).success).toBe(false);
  });

  it('rejects missing quality', () => {
    expect(SleepLogInputSchema.safeParse({ hours: 7 }).success).toBe(false);
  });

  it('rejects a quality outside 1-5', () => {
    expect(SleepLogInputSchema.safeParse({ hours: 7, quality: 6 }).success).toBe(false);
    expect(SleepLogInputSchema.safeParse({ hours: 7, quality: 0 }).success).toBe(false);
  });

  it('rejects negative hours', () => {
    expect(SleepLogInputSchema.safeParse({ hours: -1, quality: 3 }).success).toBe(false);
  });

  it('accepts fractional hours', () => {
    expect(SleepLogInputSchema.safeParse({ hours: 6.5, quality: 3 }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/shared-types && npx vitest run test/sleep.test.ts`
Expected: FAIL — `Cannot find module '../src/sleep.js'`

- [ ] **Step 3: Implement `packages/shared-types/src/sleep.ts`**

```ts
import { z } from 'zod';

export const SleepProtocolUpdateSchema = z.object({
  protocol_text: z.string().nullable().optional(),
  sleep_window: z.string().nullable().optional(),
  supplement: z.string().nullable().optional(),
});
export type SleepProtocolUpdate = z.infer<typeof SleepProtocolUpdateSchema>;

export const SleepLogInputSchema = z.object({
  hours: z.coerce.number().min(0).max(24),
  quality: z.coerce.number().int().min(1).max(5),
});
export type SleepLogInput = z.infer<typeof SleepLogInputSchema>;
```

- [ ] **Step 4: Re-export from the package index**

Modify `packages/shared-types/src/index.ts` — add `export * from './sleep.js';` alongside the existing export lines (don't remove or reorder existing ones).

- [ ] **Step 5: Run to verify they pass**

Run: `cd packages/shared-types && npx vitest run test/sleep.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types
git commit -m "feat(sleep-protocol): add shared Zod schemas"
```

---

### Task 2: Drizzle schema — `sleepProtocols`, `sleepLogs` tables

**Files:**
- Modify: `apps/api/src/models/schema.ts`

**Interfaces:**
- Produces: `sleepProtocols`, `sleepLogs` Drizzle tables and `SleepProtocol`, `SleepLog` types. Consumed by Task 3.

- [ ] **Step 1: Append the two tables and their inferred types**

Add at the end of `apps/api/src/models/schema.ts` (after the `cortisolTips` table and its type export from the prior, already-merged plan):

```ts
export const sleepProtocols = pgTable('sleep_protocols', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique().references(() => clients.id, { onDelete: 'cascade' }),
  protocolText: text('protocol_text'),
  sleepWindow: text('sleep_window'),
  supplement: text('supplement'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const sleepLogs = pgTable('sleep_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  date: date('date').notNull().defaultNow(),
  hours: numeric('hours', { precision: 3, scale: 1 }).notNull().$type<number>(),
  quality: integer('quality').notNull(),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SleepProtocol = typeof sleepProtocols.$inferSelect;
export type SleepLog = typeof sleepLogs.$inferSelect;
```

Note: `numeric` is already imported at the top of this file (used by `personalInfo`/`anthropometricRecords`) — reuse that import, don't re-add it. The `UNIQUE(client_id, date)` composite constraint on `sleepLogs` is enforced at the SQL migration level (Task 6), not expressible as a simple Drizzle column modifier — same convention already established for `nutritionPlans`/`cortisolCompletions`/`cortisolCheckins` in this codebase; the service-layer upsert logic (Task 3) is what actually prevents duplicates at the application level.

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/models/schema.ts
git commit -m "feat(sleep-protocol): add Drizzle tables for sleep_protocols, sleep_logs"
```

---

### Task 3: `apps/api` — sleep protocol + daily sleep logs

**Files:**
- Create: `apps/api/src/services/sleep.service.ts`
- Create: `apps/api/src/controllers/sleep.controller.ts`
- Create: `apps/api/src/routes/sleep.routes.ts`
- Modify: `apps/api/src/app.ts` (mount `sleepRouter` at `/api/clients`)
- Test: `apps/api/test/sleep.routes.test.ts`

**Interfaces:**
- Consumes: `SleepProtocolUpdateSchema`, `SleepLogInputSchema` (Task 1); `sleepProtocols`, `sleepLogs`, `type SleepProtocol`, `type SleepLog` (Task 2); `db`; `authMiddleware`, `adminOnly`, `ownerOrAdmin`; `validateBody`; `asyncHandler`.
- Produces: `sleepRouter` mounted at `/api/clients`, exposing `GET /:id/sleep-protocol`, `PUT /:id/sleep-protocol`, `GET /:id/sleep-log-today`, `GET /:id/sleep-logs`, `POST /:id/sleep-log`.

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/sleep.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, sleepProtocols, sleepLogs } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('sleep protocol + logs routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Sleep Client', email: `sleep-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(sleepLogs).where(eq(sleepLogs.clientId, clientId));
    await db.delete(sleepProtocols).where(eq(sleepProtocols.clientId, clientId));
  });

  it('a client with no protocol yet gets null, not a 404', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.protocol).toBeNull();
  });

  it('rejects a client from saving their own protocol (admin-only)', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}/sleep-protocol`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ protocol_text: 'Test' });
    expect(res.status).toBe(403);
  });

  it('admin writes the protocol and the client can read it back', async () => {
    const putRes = await request(app)
      .put(`/api/clients/${clientId}/sleep-protocol`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ protocol_text: 'Apaga pantallas 1h antes.', sleep_window: '22:30 - 06:30', supplement: 'Magnesio' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.protocol.protocolText).toBe('Apaga pantallas 1h antes.');

    const getRes = await request(app).get(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.body.protocol.sleepWindow).toBe('22:30 - 06:30');
  });

  it('writing the protocol a second time updates the same row, not a duplicate', async () => {
    await request(app).put(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${adminToken}`).send({ protocol_text: 'v1' });
    await request(app).put(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${adminToken}`).send({ protocol_text: 'v2' });
    const rows = await db.select().from(sleepProtocols).where(eq(sleepProtocols.clientId, clientId));
    expect(rows).toHaveLength(1);
    expect(rows[0].protocolText).toBe('v2');
  });

  it('returns null for today\'s sleep log when none exists yet', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/sleep-log-today`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.log).toBeNull();
  });

  it('rejects a log with quality out of range', async () => {
    const res = await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 7, quality: 9 });
    expect(res.status).toBe(400);
  });

  it('logs sleep for today, and posting again the same day updates it in place (upsert, not duplicate)', async () => {
    const first = await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 6, quality: 3 });
    expect(first.status).toBe(200);
    expect(Number(first.body.log.hours)).toBe(6);

    const second = await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 8, quality: 5 });
    expect(second.status).toBe(200);
    expect(second.body.log.id).toBe(first.body.log.id);
    expect(Number(second.body.log.hours)).toBe(8);

    const rows = await db.select().from(sleepLogs).where(eq(sleepLogs.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('lists the full sleep log history', async () => {
    await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 7, quality: 4 });
    const res = await request(app).get(`/api/clients/${clientId}/sleep-logs`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/sleep.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/services/sleep.service.js'`

- [ ] **Step 3: Implement the service**

`apps/api/src/services/sleep.service.ts`:

```ts
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sleepProtocols, sleepLogs, type SleepProtocol, type SleepLog } from '../models/schema.js';
import type { SleepProtocolUpdate, SleepLogInput } from '@latribu/shared-types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getProtocol(clientId: string): Promise<SleepProtocol | null> {
  const rows = await db.select().from(sleepProtocols).where(eq(sleepProtocols.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertProtocol(clientId: string, patch: SleepProtocolUpdate): Promise<SleepProtocol> {
  const fields: Record<string, unknown> = {};
  if (patch.protocol_text !== undefined) fields.protocolText = patch.protocol_text;
  if (patch.sleep_window !== undefined) fields.sleepWindow = patch.sleep_window;
  if (patch.supplement !== undefined) fields.supplement = patch.supplement;

  const [protocol] = await db
    .insert(sleepProtocols)
    .values({ clientId, ...fields })
    .onConflictDoUpdate({ target: sleepProtocols.clientId, set: { ...fields, updatedAt: new Date() } })
    .returning();
  return protocol;
}

export async function getTodayLog(clientId: string): Promise<SleepLog | null> {
  const rows = await db
    .select()
    .from(sleepLogs)
    .where(and(eq(sleepLogs.clientId, clientId), eq(sleepLogs.date, today())));
  return rows[0] ?? null;
}

export async function listLogs(clientId: string): Promise<SleepLog[]> {
  return db.select().from(sleepLogs).where(eq(sleepLogs.clientId, clientId)).orderBy(asc(sleepLogs.date));
}

export async function logSleep(clientId: string, input: SleepLogInput): Promise<SleepLog> {
  const date = today();
  const [log] = await db
    .insert(sleepLogs)
    .values({ clientId, date, hours: input.hours, quality: input.quality, loggedAt: new Date() })
    .onConflictDoUpdate({
      target: [sleepLogs.clientId, sleepLogs.date],
      set: { hours: input.hours, quality: input.quality, loggedAt: new Date() },
    })
    .returning();
  return log;
}
```

- [ ] **Step 4: Implement the controller**

`apps/api/src/controllers/sleep.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { SleepProtocolUpdate, SleepLogInput } from '@latribu/shared-types';
import * as sleepService from '../services/sleep.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function getProtocol(req: Request, res: Response) {
  const protocol = await sleepService.getProtocol(req.params.id);
  return ok(res, { protocol });
}

export async function putProtocol(req: Request, res: Response) {
  const protocol = await sleepService.upsertProtocol(req.params.id, req.body as SleepProtocolUpdate);
  return ok(res, { protocol });
}

export async function getTodayLog(req: Request, res: Response) {
  const log = await sleepService.getTodayLog(req.params.id);
  return ok(res, { log });
}

export async function listLogs(req: Request, res: Response) {
  const logs = await sleepService.listLogs(req.params.id);
  return ok(res, { logs });
}

export async function logSleep(req: Request, res: Response) {
  const log = await sleepService.logSleep(req.params.id, req.body as SleepLogInput);
  return ok(res, { log });
}
```

- [ ] **Step 5: Implement the routes**

`apps/api/src/routes/sleep.routes.ts`:

```ts
import { Router } from 'express';
import { SleepProtocolUpdateSchema, SleepLogInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import * as sleepController from '../controllers/sleep.controller.js';

export const sleepRouter = Router();

sleepRouter.get('/:id/sleep-protocol', authMiddleware, ownerOrAdmin, asyncHandler(sleepController.getProtocol));

sleepRouter.put(
  '/:id/sleep-protocol',
  authMiddleware,
  adminOnly,
  validateBody(SleepProtocolUpdateSchema),
  asyncHandler(sleepController.putProtocol)
);

sleepRouter.get('/:id/sleep-log-today', authMiddleware, ownerOrAdmin, asyncHandler(sleepController.getTodayLog));

sleepRouter.get('/:id/sleep-logs', authMiddleware, ownerOrAdmin, asyncHandler(sleepController.listLogs));

sleepRouter.post(
  '/:id/sleep-log',
  authMiddleware,
  ownerOrAdmin,
  validateBody(SleepLogInputSchema),
  asyncHandler(sleepController.logSleep)
);
```

Note: none of these five routes use `requirePermission` — this is deliberate legacy parity (see Global Constraints), not an omission.

- [ ] **Step 6: Mount the router**

Modify `apps/api/src/app.ts` — add the import and `app.use('/api/clients', sleepRouter);` alongside the other `/api/clients` mounts.

- [ ] **Step 7: Run to verify it passes**

Run: `cd apps/api && npx vitest run test/sleep.routes.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 8: Run the full apps/api suite to confirm no regressions**

Run: `cd apps/api && npx vitest run`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/sleep.service.ts apps/api/src/controllers/sleep.controller.ts apps/api/src/routes/sleep.routes.ts apps/api/src/app.ts apps/api/test/sleep.routes.test.ts
git commit -m "feat(sleep-protocol): add sleep protocol + daily logs API"
```

---

### Task 4: `apps/web` — admin panel (embedded in client detail page)

**Files:**
- Create: `apps/web/lib/sleep-client.ts`
- Create: `apps/web/components/sleep/AdminSleepProtocolPanel.tsx`
- Modify: `apps/web/app/admin/clients/[id]/page.tsx` (embed as a new section)
- Test: `apps/web/test/admin-sleep-protocol-panel.test.tsx`

**Interfaces:**
- Consumes: `getSessionToken` from `../api-client`.
- Produces: `getProtocol`, `saveProtocol`, `type SleepProtocol` from `sleep-client.ts` (this file also exports `getTodayLog`, `listLogs`, `logSleep`, `type SleepLog` for Task 5's reuse). `AdminSleepProtocolPanel` (`clientId: string` prop, mirrors `AdminNutritionPanel`).

- [ ] **Step 1: Implement `apps/web/lib/sleep-client.ts`**

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

export type SleepProtocol = {
  protocolText: string | null;
  sleepWindow: string | null;
  supplement: string | null;
} | null;

export type SleepLog = {
  id: string;
  date: string;
  hours: string | number;
  quality: number;
};

export async function getProtocol(clientId: string): Promise<SleepProtocol> {
  const body = await authorizedRequest<{ success: boolean; protocol: SleepProtocol; error?: string }>(`/api/clients/${clientId}/sleep-protocol`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el protocolo de sueño.');
  return body.protocol;
}

export async function saveProtocol(clientId: string, patch: { protocol_text?: string | null; sleep_window?: string | null; supplement?: string | null }): Promise<SleepProtocol> {
  const body = await authorizedRequest<{ success: boolean; protocol: SleepProtocol; error?: string }>(`/api/clients/${clientId}/sleep-protocol`, 'PUT', patch);
  if (!body.success) throw new Error(body.error || 'Error al guardar el protocolo.');
  return body.protocol;
}

export async function getTodayLog(clientId: string): Promise<SleepLog | null> {
  const body = await authorizedRequest<{ success: boolean; log: SleepLog | null; error?: string }>(`/api/clients/${clientId}/sleep-log-today`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el registro de hoy.');
  return body.log;
}

export async function listLogs(clientId: string): Promise<SleepLog[]> {
  const body = await authorizedRequest<{ success: boolean; logs: SleepLog[]; error?: string }>(`/api/clients/${clientId}/sleep-logs`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el historial de sueño.');
  return body.logs;
}

export async function logSleep(clientId: string, input: { hours: number; quality: number }): Promise<SleepLog> {
  const body = await authorizedRequest<{ success: boolean; log: SleepLog; error?: string }>(`/api/clients/${clientId}/sleep-log`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar el registro.');
  return body.log;
}
```

- [ ] **Step 2: Write the failing test**

`apps/web/test/admin-sleep-protocol-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminSleepProtocolPanel } from '../components/sleep/AdminSleepProtocolPanel';
import * as sleepClient from '../lib/sleep-client';

vi.mock('../lib/sleep-client');

describe('AdminSleepProtocolPanel', () => {
  beforeEach(() => {
    vi.mocked(sleepClient.getProtocol).mockResolvedValue(null);
  });

  it('loads and shows the current protocol', async () => {
    vi.mocked(sleepClient.getProtocol).mockResolvedValue({ protocolText: 'Apaga pantallas', sleepWindow: '22:30 - 06:30', supplement: null });
    render(<AdminSleepProtocolPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByLabelText('Protocolo')).toHaveValue('Apaga pantallas'));
  });

  it('saves the protocol', async () => {
    const user = userEvent.setup();
    vi.mocked(sleepClient.saveProtocol).mockResolvedValue({ protocolText: 'Nuevo protocolo', sleepWindow: null, supplement: null });
    render(<AdminSleepProtocolPanel clientId="client-1" />);
    await waitFor(() => screen.getByLabelText('Protocolo'));

    await user.type(screen.getByLabelText('Protocolo'), 'Nuevo protocolo');
    await user.click(screen.getByRole('button', { name: 'Guardar protocolo' }));

    await waitFor(() => expect(sleepClient.saveProtocol).toHaveBeenCalledWith('client-1', expect.objectContaining({ protocol_text: 'Nuevo protocolo' })));
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/web && npx vitest run test/admin-sleep-protocol-panel.test.tsx`
Expected: FAIL — `Cannot find module '../components/sleep/AdminSleepProtocolPanel'`

- [ ] **Step 4: Implement `AdminSleepProtocolPanel`**

`apps/web/components/sleep/AdminSleepProtocolPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getProtocol, saveProtocol } from '../../lib/sleep-client';

export function AdminSleepProtocolPanel({ clientId }: { clientId: string }) {
  const [protocolText, setProtocolText] = useState('');
  const [sleepWindow, setSleepWindow] = useState('');
  const [supplement, setSupplement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProtocol(clientId)
      .then((protocol) => {
        setProtocolText(protocol?.protocolText || '');
        setSleepWindow(protocol?.sleepWindow || '');
        setSupplement(protocol?.supplement || '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleSave() {
    try {
      await saveProtocol(clientId, {
        protocol_text: protocolText || null,
        sleep_window: sleepWindow || null,
        supplement: supplement || null,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando protocolo de sueño...</p>;

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="sleep-protocol-text">Protocolo</label>
      <textarea id="sleep-protocol-text" value={protocolText} onChange={(e) => setProtocolText(e.target.value)} />
      <label htmlFor="sleep-window">Ventana de sueño</label>
      <input id="sleep-window" value={sleepWindow} onChange={(e) => setSleepWindow(e.target.value)} placeholder="22:30 - 06:30" />
      <label htmlFor="sleep-supplement">Suplemento</label>
      <input id="sleep-supplement" value={supplement} onChange={(e) => setSupplement(e.target.value)} />
      <button type="button" onClick={handleSave}>
        Guardar protocolo
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Embed the panel in the client detail page**

Modify `apps/web/app/admin/clients/[id]/page.tsx` — add the import (`AdminSleepProtocolPanel` from `'../../../../components/sleep/AdminSleepProtocolPanel'`) and a new section right after the "Gestión de Cortisol" section from the prior plan:

```tsx
<section>
  <h2>Protocolo de Sueño</h2>
  <AdminSleepProtocolPanel clientId={clientId} />
</section>
```

- [ ] **Step 6: Run to verify tests pass**

Run: `cd apps/web && npx vitest run test/admin-sleep-protocol-panel.test.tsx test/client-detail-page.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/sleep-client.ts apps/web/components/sleep/AdminSleepProtocolPanel.tsx apps/web/app/admin/clients/\[id\]/page.tsx apps/web/test/admin-sleep-protocol-panel.test.tsx
git commit -m "feat(sleep-protocol): add admin panel embedded in client detail page"
```

---

### Task 5: `apps/web` — client-facing page

**Files:**
- Create: `apps/web/components/sleep/ClientSleepPanel.tsx`
- Create: `apps/web/app/sleep-protocol/page.tsx`
- Test: `apps/web/test/client-sleep-panel.test.tsx`, `apps/web/test/sleep-protocol-page.test.tsx`

**Interfaces:**
- Consumes: `getProtocol`, `getTodayLog`, `logSleep`, `type SleepProtocol`, `type SleepLog` (Task 4); `getSessionToken` from `../lib/api-client`.
- Produces: `ClientSleepPanel` (`clientId: string` prop), `SleepProtocolPage` (decodes `clientId` from JWT, same pattern as `app/training/page.tsx`).

- [ ] **Step 1: Write the failing panel test**

`apps/web/test/client-sleep-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientSleepPanel } from '../components/sleep/ClientSleepPanel';
import * as sleepClient from '../lib/sleep-client';

vi.mock('../lib/sleep-client');

describe('ClientSleepPanel', () => {
  it('shows the assigned protocol', async () => {
    vi.mocked(sleepClient.getProtocol).mockResolvedValue({ protocolText: 'Apaga pantallas 1h antes.', sleepWindow: '22:30 - 06:30', supplement: 'Magnesio' });
    vi.mocked(sleepClient.getTodayLog).mockResolvedValue(null);
    render(<ClientSleepPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Apaga pantallas 1h antes.')).toBeInTheDocument());
    expect(screen.getByText(/22:30 - 06:30/)).toBeInTheDocument();
  });

  it('shows a message when no protocol has been assigned yet', async () => {
    vi.mocked(sleepClient.getProtocol).mockResolvedValue(null);
    vi.mocked(sleepClient.getTodayLog).mockResolvedValue(null);
    render(<ClientSleepPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Todavía no tienes un protocolo de sueño asignado.')).toBeInTheDocument());
  });

  it('logs sleep for today', async () => {
    const user = userEvent.setup();
    vi.mocked(sleepClient.getProtocol).mockResolvedValue(null);
    vi.mocked(sleepClient.getTodayLog).mockResolvedValue(null);
    vi.mocked(sleepClient.logSleep).mockResolvedValue({ id: 'l1', date: '2026-08-02', hours: 7, quality: 4 });
    render(<ClientSleepPanel clientId="client-1" />);
    await waitFor(() => screen.getByLabelText('Horas dormidas'));

    await user.type(screen.getByLabelText('Horas dormidas'), '7');
    await user.selectOptions(screen.getByLabelText('Calidad (1-5)'), '4');
    await user.click(screen.getByRole('button', { name: 'Guardar registro de hoy' }));

    await waitFor(() => expect(sleepClient.logSleep).toHaveBeenCalledWith('client-1', { hours: 7, quality: 4 }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run test/client-sleep-panel.test.tsx`
Expected: FAIL — `Cannot find module '../components/sleep/ClientSleepPanel'`

- [ ] **Step 3: Implement `ClientSleepPanel`**

`apps/web/components/sleep/ClientSleepPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getProtocol, getTodayLog, logSleep, type SleepProtocol, type SleepLog } from '../../lib/sleep-client';

export function ClientSleepPanel({ clientId }: { clientId: string }) {
  const [protocol, setProtocol] = useState<SleepProtocol>(null);
  const [todayLog, setTodayLog] = useState<SleepLog | null>(null);
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProtocol(clientId), getTodayLog(clientId)])
      .then(([p, log]) => {
        setProtocol(p);
        setTodayLog(log);
        if (log) {
          setHours(String(log.hours));
          setQuality(String(log.quality));
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleLogSleep() {
    if (!hours || !quality) return;
    try {
      const log = await logSleep(clientId, { hours: Number(hours), quality: Number(quality) });
      setTodayLog(log);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando tu protocolo de sueño...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <div>
      {protocol ? (
        <div>
          {protocol.protocolText && <p>{protocol.protocolText}</p>}
          {protocol.sleepWindow && <p>Ventana de sueño: {protocol.sleepWindow}</p>}
          {protocol.supplement && <p>Suplemento: {protocol.supplement}</p>}
        </div>
      ) : (
        <p>Todavía no tienes un protocolo de sueño asignado.</p>
      )}

      <h3>Registro de hoy</h3>
      <label htmlFor="sleep-hours">Horas dormidas</label>
      <input id="sleep-hours" type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
      <label htmlFor="sleep-quality">Calidad (1-5)</label>
      <select id="sleep-quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
        <option value="">Selecciona</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
      <button type="button" onClick={handleLogSleep}>
        Guardar registro de hoy
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the panel test to verify it passes**

Run: `cd apps/web && npx vitest run test/client-sleep-panel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing page test**

`apps/web/test/sleep-protocol-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SleepProtocolPage from '../app/sleep-protocol/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/sleep-client', () => ({
  getProtocol: vi.fn().mockResolvedValue(null),
  getTodayLog: vi.fn().mockResolvedValue(null),
}));

describe('SleepProtocolPage', () => {
  it('renders the sleep protocol heading', () => {
    render(<SleepProtocolPage />);
    expect(screen.getByRole('heading', { name: 'Protocolo de Sueño' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd apps/web && npx vitest run test/sleep-protocol-page.test.tsx`
Expected: FAIL — `Cannot find module '../app/sleep-protocol/page'`

- [ ] **Step 7: Implement the page**

`apps/web/app/sleep-protocol/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '../../lib/api-client';
import { ClientSleepPanel } from '../../components/sleep/ClientSleepPanel';

function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

export default function SleepProtocolPage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (token) setClientId(decodeClientIdFromToken(token));
  }, []);

  return (
    <div>
      <h1>Protocolo de Sueño</h1>
      {clientId && <ClientSleepPanel clientId={clientId} />}
    </div>
  );
}
```

- [ ] **Step 8: Run all new web tests to verify they pass**

Run: `cd apps/web && npx vitest run test/client-sleep-panel.test.tsx test/sleep-protocol-page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 9: Run the full apps/web suite to confirm no regressions**

Run: `cd apps/web && npx vitest run`
Expected: all tests pass (the pre-existing unrelated `wizard-shell-finalize.test.tsx` flake under parallel load is known — re-run standalone if it's the only failure)

- [ ] **Step 10: Commit**

```bash
git add apps/web/components/sleep/ClientSleepPanel.tsx apps/web/app/sleep-protocol apps/web/test/client-sleep-panel.test.tsx apps/web/test/sleep-protocol-page.test.tsx
git commit -m "feat(sleep-protocol): add client-facing page"
```

---

### Task 6: Manual production migration + `schema.sql` verification

**Files:**
- Verify (no changes expected): `schema.sql` lines covering `sleep_protocols`, `sleep_logs`
- Create: `tasks/migration-2026-08-02-sleep-protocol.sql`

**Interfaces:**
- None — this task only produces a SQL file for the user to run manually in the Supabase SQL Editor, following the exact same convention as every prior module's migration file.

- [ ] **Step 1: Diff `schema.sql` against `apps/api/src/models/schema.ts` for these 2 tables**

Run: `grep -n "CREATE TABLE sleep_protocols\|CREATE TABLE sleep_logs" -A 10 schema.sql` and compare column-by-column against the Drizzle definitions from Task 2. Note any discrepancy precisely rather than silently "fixing" either file — in particular, `sleep_logs.hours NUMERIC(3,1) NOT NULL` and `quality INT NOT NULL CHECK (quality BETWEEN 1 AND 5)` are expected to NOT have a matching Drizzle-level `CHECK`, the same accepted app/DB split already established for `cortisol_checkins.emotion` and `supplements.category` in prior modules — don't treat that as a new problem.

- [ ] **Step 2: Write the idempotent migration SQL**

`tasks/migration-2026-08-02-sleep-protocol.sql`:

```sql
-- Migración manual para Descanso — Protocolo de Sueño Personalizado
-- (sleep_protocols, sleep_logs). Correr en el Supabase SQL Editor de
-- producción. Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS sleep_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  protocol_text TEXT,
  sleep_window TEXT,
  supplement TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC(3,1) NOT NULL,
  quality INT NOT NULL CHECK (quality BETWEEN 1 AND 5),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, date)
);
```

- [ ] **Step 3: Verification query (run manually after applying, not part of this repo)**

Document in the commit message or final report that the user should run, in the Supabase SQL Editor, after applying:

```sql
SELECT table_name, count(*) AS column_count
FROM information_schema.columns
WHERE table_name IN ('sleep_protocols', 'sleep_logs')
GROUP BY table_name;
```

Expected: `sleep_protocols` → 6, `sleep_logs` → 6.

- [ ] **Step 4: Commit**

```bash
git add tasks/migration-2026-08-02-sleep-protocol.sql
git commit -m "docs(sleep-protocol): add manual production migration SQL"
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `onConflictDoUpdate` with a composite target (`[sleepLogs.clientId, sleepLogs.date]`) may need the underlying unique index to exist for Drizzle/Postgres to accept it as a conflict target — this index is only created by Task 6's SQL, not by Task 2's Drizzle definition | Medium | Task 3's implementer must verify this against the real test database (which already gets its schema from `schema.sql`, not from Drizzle) — if `onConflictDoUpdate` fails to compile/run against the test DB, fall back to the same manual select-then-branch pattern already used by `cortisol-logs.service.ts`'s `upsertCheckin`, and note the deviation |
| Production DB still lacks these 2 tables after this plan lands (same gap every prior module had) | High if deploy happens first | Task 6's SQL must be run in Supabase **before** `git push origin main` ships this code |
| `packages/shared-types`'s `dist/` must be rebuilt (`npx tsc`) after this plan lands on `main`, or `apps/api` will 500 on any sleep route — this exact failure mode hit two prior merges | Medium | Note explicitly in the final report: run `cd packages/shared-types && npx tsc -p tsconfig.json` immediately after merging to `main`, before running any test suite or dev server there |

## Open Questions

None — legacy behavior (`server.js:2010-2077`, `schema.sql:363-370`, `448-456`) is fully specified and this plan mirrors it exactly, changing only the underlying stack.
