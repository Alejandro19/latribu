# Entrenamiento — Racha, Protector y Confirmación NFC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the minimal `confirm-session` endpoint (built in the "Admin & Ejecución" sub-project) with streak/protector/phrase/achievements, add the streak badge + week-progress card + protector button to `TrainingHome`, build the dark-only "¡Sesión confirmada!" screen, and wire up the NFC deep-link flow end-to-end.

**Architecture:** Extends the existing `apps/api` training module (service/controller/routes) with streak computation and two new endpoints (`/training/streak`, `/training/use-protector`), plus a small `/training/achievements` admin endpoint. On the frontend, extends `TrainingHome`/`TrainingShell` with the new data, adds a new `SessionConfirmedScreen` component, and adds a deep-link capture/consume mechanism spanning `/training` and `/login`.

**Tech Stack:** Express + TypeScript (`apps/api`), Drizzle ORM over Postgres/Supabase, Zod (`packages/shared-types`), Next.js App Router + React (`apps/web`), Vitest (both apps).

## Global Constraints

- No production cutover — `server.js`/`index.html` keep running in parallel; this plan only adds to the new stack.
- `packages/shared-types` must be rebuilt (`cd packages/shared-types && npm run build`) after Task 3 (the only task touching it) before `apps/api` tests can see the schema change.
- `apps/api` tests run against a real test database (`apps/api/.env.test`, already configured in this checkout) — no mocking of the DB layer.
- `apps/web` tests mock the `lib/*-client.ts` wrappers with `vi.mock` — no real network calls.
- Wire format convention (already established): request body Zod schemas use snake_case keys; GET/response payloads are raw Drizzle rows and therefore camelCase. This plan's new fields (`streakWeeks`, `sessionsDoneThisWeek`, etc.) are all read-only response fields, so they stay camelCase throughout — no new snake_case request fields are introduced except the already-existing `tz`/`source` on `confirm-session`'s body.
- `phrases`, `training_protector_uses`, `achievement_logs` tables already exist in the shared Supabase database (`schema.sql` lines 35-42, 205-224) — no new migration needed, only Drizzle mappings.
- `confirm-session`'s response is being **extended, not replaced**: the existing `{ alreadyConfirmedToday, dayNumber }` fields must keep their exact names and semantics; only `streak` and `phrase` are added.
- Contract already consumed by `apps/web/components/training/TrainingShell.tsx` (merged in the prior sub-project) must keep working without breaking changes to its existing call sites, except where this plan explicitly modifies `TrainingShell.tsx` itself.
- The NFC deep-link's timezone is always hard-coded to `America/Mexico_City` (`DEFAULT_TRAINING_TZ`) regardless of the scanning device's clock — the gym sticker is physically in Mexico; a client's own tz is only trusted for `source: 'manual'` confirmations.
- Scope decisions locked in the design spec (`docs/superpowers/specs/2026-07-30-entrenamiento-racha-protector-nfc-design.md`): the motivational phrase is included now (reading `phrases`, no admin CRUD); the "Compartir" button is rendered disabled with a "Próximamente" label (no card-sharing logic); the achievements admin view is included; deep-link NFC handling is in scope.

---

### Task 1: Drizzle schema + streak computation + GET /training/streak

**Files:**
- Modify: `apps/api/src/models/schema.ts` (append `phrases`, `trainingProtectorUses`, `achievementLogs` tables + types)
- Modify: `apps/api/src/services/training.service.ts:14-26` (existing `todayInTz`/`weekStartInTz` — wrap with a new `safeTz` guard; add `dowInTz`, `addDaysISO`, `computeTrainingStreakState`, `getStreak`)
- Modify: `apps/api/src/controllers/training.controller.ts` (add `getStreak`)
- Modify: `apps/api/src/routes/training.routes.ts` (add `GET /:id/training/streak`)
- Test: `apps/api/test/training.routes.test.ts` (add a new `describe('GET /training/streak', ...)` block)

**Interfaces:**
- Consumes: `clients`, `trainingCompletions` (existing, `apps/api/src/models/schema.ts`); `requirePermission`, `ownerOrAdmin` (existing middleware).
- Produces: Drizzle tables `phrases`, `trainingProtectorUses`, `achievementLogs` + types `Phrase`, `TrainingProtectorUse`, `AchievementLog` (consumed by Tasks 2-3). `export type TrainingStreak = { streakWeeks: number; sessionsDoneThisWeek: number; sessionsRequiredThisWeek: number; protectorAvailable: boolean; protectorUsedThisWeek: boolean; atRisk: boolean }` and `export async function computeTrainingStreakState(clientId: string, trainingDays: number, tz: string): Promise<TrainingStreak>` (consumed by Tasks 2-3). `DEFAULT_TRAINING_TZ` constant (consumed by Task 3).

- [ ] **Step 1: Add the Drizzle table definitions**

Append to `apps/api/src/models/schema.ts` (after the existing `clientNotifications` table and its exported types):

```typescript
export const phrases = pgTable('phrases', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  context: text('context').notNull(),
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
  type: text('type').notNull(),
  weekNumber: integer('week_number').notNull(),
  earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow(),
});

export type Phrase = typeof phrases.$inferSelect;
export type TrainingProtectorUse = typeof trainingProtectorUses.$inferSelect;
export type AchievementLog = typeof achievementLogs.$inferSelect;
```

- [ ] **Step 2: Write the failing test for the streak endpoint**

```typescript
// Add to apps/api/test/training.routes.test.ts, inside the existing `describe('training routes', ...)` block,
// after the existing tests. Also add these imports at the top of the file alongside the existing ones:
//   import { trainingProtectorUses } from '../src/models/schema.js';
// and add this cleanup line inside the existing `afterAll`:
//   await db.delete(trainingProtectorUses).where(eq(trainingProtectorUses.clientId, clientId));

describe('GET /training/streak', () => {
  it('computes streakWeeks=0 for a client with no completions', async () => {
    const [freshClient] = await db
      .insert(clients)
      .values({ name: 'Streak Client', email: `streak-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 3 })
      .returning();
    const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

    const res = await request(app)
      .get(`/api/clients/${freshClient.id}/training/streak?tz=America/Mexico_City`)
      .set('Authorization', `Bearer ${freshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.streak.streakWeeks).toBe(0);
    expect(res.body.streak.sessionsRequiredThisWeek).toBe(3);
    expect(res.body.streak.protectorAvailable).toBe(true);

    await db.delete(clients).where(eq(clients.id, freshClient.id));
  });

  it('computes streakWeeks=1 when this week already meets trainingDays', async () => {
    const [twoDayClient] = await db
      .insert(clients)
      .values({ name: 'Two Day Client', email: `twoday-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 2 })
      .returning();
    const token2 = signToken({ id: twoDayClient.id, role: 'cliente', name: twoDayClient.name, email: twoDayClient.email });

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    await db.insert(trainingCompletions).values([
      { clientId: twoDayClient.id, dayNumber: 1, completedDate: today, source: 'manual' },
      { clientId: twoDayClient.id, dayNumber: 2, completedDate: today, source: 'manual' },
    ]);

    const res = await request(app)
      .get(`/api/clients/${twoDayClient.id}/training/streak?tz=America/Mexico_City`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.streak.streakWeeks).toBe(1);
    expect(res.body.streak.sessionsDoneThisWeek).toBe(2);

    await db.delete(trainingCompletions).where(eq(trainingCompletions.clientId, twoDayClient.id));
    await db.delete(clients).where(eq(clients.id, twoDayClient.id));
  });

  it('falls back to the gym timezone for an invalid tz value instead of throwing', async () => {
    const [freshClient] = await db
      .insert(clients)
      .values({ name: 'Bad Tz Client', email: `badtz-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1 })
      .returning();
    const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

    const res = await request(app)
      .get(`/api/clients/${freshClient.id}/training/streak?tz=Not/A_Real_Timezone`)
      .set('Authorization', `Bearer ${freshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.streak.streakWeeks).toBe(0);

    await db.delete(clients).where(eq(clients.id, freshClient.id));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: FAIL — `Cannot find` `getStreak` export / route returns 404

- [ ] **Step 4: Extend `training.service.ts`**

Replace the existing `todayInTz`/`weekStartInTz` functions (lines 14-26) with the following (this adds `safeTz` as a defensive wrapper — behavior for any already-valid tz string like `'America/Mexico_City'` is unchanged, so the existing `confirm-session` tests continue to pass):

```typescript
const DEFAULT_TRAINING_TZ = 'America/Mexico_City';
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function safeTz(tz: string | undefined): string {
  if (!tz) return DEFAULT_TRAINING_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TRAINING_TZ;
  }
}

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeTz(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function dowInTz(tz: string): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: safeTz(tz), weekday: 'short' }).format(new Date());
  return WEEKDAY_INDEX[short];
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// Semana calendario lunes→domingo, calculada en la tz dada — mismo criterio
// que getWeekStart() en el legacy (index.html).
function weekStartInTz(tz: string): string {
  const today = todayInTz(tz);
  const dow = dowInTz(tz);
  return addDaysISO(today, (dow === 0 ? -6 : 1) - dow);
}
```

Then add, importing `trainingProtectorUses` alongside the existing imports (`import { clients, trainingCompletions, trainingProtectorUses, type TrainingCompletion, type Client } from '../models/schema.js';`):

```typescript
export type TrainingStreak = {
  streakWeeks: number;
  sessionsDoneThisWeek: number;
  sessionsRequiredThisWeek: number;
  protectorAvailable: boolean;
  protectorUsedThisWeek: boolean;
  atRisk: boolean;
};

// Puerto de computeTrainingStreakState (server.js:1254-1287).
export async function computeTrainingStreakState(clientId: string, trainingDays: number, tz: string): Promise<TrainingStreak> {
  const [completions, protectorUses] = await Promise.all([
    listTrainingCompletions(clientId),
    db.select().from(trainingProtectorUses).where(eq(trainingProtectorUses.clientId, clientId)),
  ]);
  const protectorWeeks = new Set(protectorUses.map((p) => p.weekStart));
  const weekStart = weekStartInTz(tz);
  const sessionsDoneThisWeek = new Set(completions.filter((c) => c.completedDate >= weekStart).map((c) => c.dayNumber)).size;
  const protectorUsedThisWeek = protectorWeeks.has(weekStart);

  let streakWeeks = trainingDays > 0 && (sessionsDoneThisWeek >= trainingDays || protectorUsedThisWeek) ? 1 : 0;
  let cStart = addDaysISO(weekStart, -7);
  for (let i = 0; i < 208 && trainingDays > 0; i++) {
    const cEnd = addDaysISO(cStart, 7);
    const doneInWeek = new Set(completions.filter((c) => c.completedDate >= cStart && c.completedDate < cEnd).map((c) => c.dayNumber)).size;
    if (doneInWeek >= trainingDays || protectorWeeks.has(cStart)) {
      streakWeeks++;
      cStart = addDaysISO(cStart, -7);
    } else break;
  }

  const dow = dowInTz(tz);
  const daysLeftInWeek = dow === 0 ? 1 : 8 - dow;
  const atRisk = trainingDays > 0 && !protectorUsedThisWeek && sessionsDoneThisWeek < trainingDays && daysLeftInWeek <= 2;

  return {
    streakWeeks,
    sessionsDoneThisWeek,
    sessionsRequiredThisWeek: trainingDays,
    protectorAvailable: !protectorUsedThisWeek,
    protectorUsedThisWeek,
    atRisk,
  };
}

export async function getStreak(clientId: string, tz: string): Promise<TrainingStreak> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const trainingDays = rows[0]?.trainingDays || 0;
  return computeTrainingStreakState(clientId, trainingDays, tz);
}
```

- [ ] **Step 5: Add the controller and route**

```typescript
// apps/api/src/controllers/training.controller.ts — add:
export async function getStreak(req: Request, res: Response) {
  const tz = typeof req.query.tz === 'string' ? req.query.tz : '';
  const streak = await trainingService.getStreak(req.params.id, tz);
  return ok(res, { streak });
}
```

```typescript
// apps/api/src/routes/training.routes.ts — add, after the existing training-completions route:
trainingRouter.get(
  '/:id/training/streak',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  asyncHandler(trainingController.getStreak)
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/models/schema.ts apps/api/src/services/training.service.ts apps/api/src/controllers/training.controller.ts apps/api/src/routes/training.routes.ts apps/api/test/training.routes.test.ts
git commit -m "feat(api): add phrases/protector/achievements schema, streak computation, GET /training/streak"
```

---

### Task 2: POST /training/use-protector

**Files:**
- Modify: `apps/api/src/services/training.service.ts` (add `useProtector`)
- Modify: `apps/api/src/controllers/training.controller.ts` (add `useProtector`)
- Modify: `apps/api/src/routes/training.routes.ts` (add `POST /:id/training/use-protector`)
- Test: `apps/api/test/training.routes.test.ts`

**Interfaces:**
- Consumes: `computeTrainingStreakState`, `trainingProtectorUses` (Task 1); `ConfirmSessionInputSchema` (existing, reused as-is for the `{ tz }` body shape — no new schema needed since the shape is identical).
- Produces: `export async function useProtector(clientId: string, tz: string): Promise<TrainingStreak>` — not consumed by any later backend task, but its route is consumed by Task 4's frontend wrapper.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to apps/api/test/training.routes.test.ts, inside `describe('training routes', ...)`:

describe('POST /training/use-protector', () => {
  it('marks the current week protected and reflects it in the streak', async () => {
    const [protClient] = await db
      .insert(clients)
      .values({ name: 'Protector Client', email: `protector-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 4 })
      .returning();
    const protToken = signToken({ id: protClient.id, role: 'cliente', name: protClient.name, email: protClient.email });

    const res = await request(app)
      .post(`/api/clients/${protClient.id}/training/use-protector`)
      .set('Authorization', `Bearer ${protToken}`)
      .send({ tz: 'America/Mexico_City' });
    expect(res.status).toBe(200);
    expect(res.body.streak.protectorUsedThisWeek).toBe(true);
    expect(res.body.streak.streakWeeks).toBe(1);

    await db.delete(clients).where(eq(clients.id, protClient.id));
  });

  it('does not insert a duplicate protector row for the same week', async () => {
    const [protClient] = await db
      .insert(clients)
      .values({ name: 'Protector Client 2', email: `protector2-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 4 })
      .returning();
    const protToken = signToken({ id: protClient.id, role: 'cliente', name: protClient.name, email: protClient.email });

    await request(app).post(`/api/clients/${protClient.id}/training/use-protector`).set('Authorization', `Bearer ${protToken}`).send({ tz: 'America/Mexico_City' });
    await request(app).post(`/api/clients/${protClient.id}/training/use-protector`).set('Authorization', `Bearer ${protToken}`).send({ tz: 'America/Mexico_City' });

    const rows = await db.select().from(trainingProtectorUses).where(eq(trainingProtectorUses.clientId, protClient.id));
    expect(rows).toHaveLength(1);

    await db.delete(clients).where(eq(clients.id, protClient.id));
  });

  it('rejects a client using another client\'s protector (IDOR guard via ownerOrAdmin)', async () => {
    const [victim] = await db
      .insert(clients)
      .values({ name: 'Victim Client', email: `victim-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 3 })
      .returning();
    const [attacker] = await db
      .insert(clients)
      .values({ name: 'Attacker Client', email: `attacker-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 3 })
      .returning();
    const attackerToken = signToken({ id: attacker.id, role: 'cliente', name: attacker.name, email: attacker.email });

    const res = await request(app)
      .post(`/api/clients/${victim.id}/training/use-protector`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ tz: 'America/Mexico_City' });
    expect(res.status).toBe(403);

    await db.delete(clients).where(eq(clients.id, victim.id));
    await db.delete(clients).where(eq(clients.id, attacker.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: FAIL — route returns 404 / `useProtector` not defined

- [ ] **Step 3: Write the implementation**

```typescript
// apps/api/src/services/training.service.ts — add:
export async function useProtector(clientId: string, tz: string): Promise<TrainingStreak> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const trainingDays = rows[0]?.trainingDays || 0;
  const weekStart = weekStartInTz(tz);
  const existing = await db
    .select()
    .from(trainingProtectorUses)
    .where(and(eq(trainingProtectorUses.clientId, clientId), eq(trainingProtectorUses.weekStart, weekStart)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(trainingProtectorUses).values({ clientId, weekStart });
  }
  return computeTrainingStreakState(clientId, trainingDays, tz);
}
```

```typescript
// apps/api/src/controllers/training.controller.ts — add:
export async function useProtector(req: Request, res: Response) {
  const { tz } = req.body as ConfirmSessionInput;
  const streak = await trainingService.useProtector(req.params.id, tz);
  return ok(res, { streak });
}
```

```typescript
// apps/api/src/routes/training.routes.ts — add, after the streak route:
trainingRouter.post(
  '/:id/training/use-protector',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  validateBody(ConfirmSessionInputSchema),
  asyncHandler(trainingController.useProtector)
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/training.service.ts apps/api/src/controllers/training.controller.ts apps/api/src/routes/training.routes.ts apps/api/test/training.routes.test.ts
git commit -m "feat(api): add POST /training/use-protector (idempotent per calendar week)"
```

---

### Task 3: Extend confirm-session (phrase + achievements + streak) + GET /training/achievements

**Files:**
- Modify: `packages/shared-types/src/training.ts` (add `source` to `ConfirmSessionInputSchema`)
- Modify: `packages/shared-types/test/training.test.ts`
- Modify: `apps/api/src/services/training.service.ts:35-72` (extend `confirmSession`; add `pickRandomPhrase`, `listAchievements`)
- Modify: `apps/api/src/controllers/training.controller.ts` (update `confirmSession`; add `listAchievements`)
- Modify: `apps/api/src/routes/training.routes.ts` (add `GET /:id/training/achievements`)
- Test: `apps/api/test/training.routes.test.ts`

**Interfaces:**
- Consumes: `computeTrainingStreakState`, `DEFAULT_TRAINING_TZ`, `phrases`, `achievementLogs`, `Phrase`, `AchievementLog` (Task 1).
- Produces: `confirmSession(clientId: string, tz: string, source?: 'manual' | 'nfc'): Promise<{ alreadyConfirmedToday: boolean; dayNumber: number | null; streak: TrainingStreak; phrase: string | null }>` — this is the final shape Task 4's frontend wrapper and Task 7's `TrainingShell` consume. `listAchievements(clientId: string): Promise<AchievementLog[]>`.

- [ ] **Step 1: Extend the shared-types schema and its test**

```typescript
// packages/shared-types/src/training.ts — replace ConfirmSessionInputSchema with:
export const ConfirmSessionInputSchema = z.object({
  tz: z.string().min(1),
  source: z.enum(['manual', 'nfc']).optional(),
});
export type ConfirmSessionInput = z.infer<typeof ConfirmSessionInputSchema>;
```

```typescript
// packages/shared-types/test/training.test.ts — replace the ConfirmSessionInputSchema describe block with:
describe('ConfirmSessionInputSchema', () => {
  it('requires a non-empty tz', () => {
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City' }).success).toBe(true);
    expect(ConfirmSessionInputSchema.safeParse({ tz: '' }).success).toBe(false);
  });
  it('accepts an optional source of manual or nfc, defaults to nothing when omitted', () => {
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City', source: 'nfc' }).success).toBe(true);
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City', source: 'manual' }).success).toBe(true);
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City' }).success).toBe(true);
  });
  it('rejects an invalid source value', () => {
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City', source: 'web' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the shared-types test, then rebuild the package**

Run: `cd packages/shared-types && npx vitest run test/training.test.ts`
Expected: PASS (10 tests)

Run: `cd packages/shared-types && npm run build`

- [ ] **Step 3: Write the failing tests for the extended confirm-session and achievements**

```typescript
// Add to apps/api/test/training.routes.test.ts, inside `describe('training routes', ...)`.
// Also add these imports at the top: `import { phrases, achievementLogs } from '../src/models/schema.js';`

describe('POST /training/confirm-session (extended)', () => {
  it('returns a streak object and a null phrase when there are no active phrases', async () => {
    const [freshClient] = await db
      .insert(clients)
      .values({ name: 'Confirm Ext Client', email: `confirmext-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1 })
      .returning();
    const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

    const res = await request(app)
      .post(`/api/clients/${freshClient.id}/training/confirm-session`)
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ tz: 'America/Mexico_City' });
    expect(res.status).toBe(200);
    expect(res.body.dayNumber).toBe(1);
    expect(res.body.streak.streakWeeks).toBe(1);
    expect(res.body.phrase).toBeNull();

    await db.delete(clients).where(eq(clients.id, freshClient.id));
  });

  it('draws an active "confirmacion"-context phrase when one exists', async () => {
    const [phraseRow] = await db.insert(phrases).values({ text: 'Cada sesión cuenta.', context: 'confirmacion', active: true }).returning();
    const [freshClient] = await db
      .insert(clients)
      .values({ name: 'Phrase Client', email: `phrase-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1 })
      .returning();
    const freshToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

    const res = await request(app)
      .post(`/api/clients/${freshClient.id}/training/confirm-session`)
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ tz: 'America/Mexico_City' });
    expect(res.status).toBe(200);
    expect(res.body.phrase).toBe('Cada sesión cuenta.');

    await db.delete(phrases).where(eq(phrases.id, phraseRow.id));
    await db.delete(clients).where(eq(clients.id, freshClient.id));
  });

  it('inserts an achievement_logs medalla only on the transition to a completed week, never twice', async () => {
    const [twoDayClient] = await db
      .insert(clients)
      .values({ name: 'Achievement Client', email: `achievement-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 1 })
      .returning();
    const token = signToken({ id: twoDayClient.id, role: 'cliente', name: twoDayClient.name, email: twoDayClient.email });

    await request(app).post(`/api/clients/${twoDayClient.id}/training/confirm-session`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });
    // Segunda llamada el mismo día: alreadyConfirmedToday=true, no debe insertar otra medalla.
    await request(app).post(`/api/clients/${twoDayClient.id}/training/confirm-session`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });

    const logs = await db.select().from(achievementLogs).where(eq(achievementLogs.clientId, twoDayClient.id));
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('medalla');

    await db.delete(achievementLogs).where(eq(achievementLogs.clientId, twoDayClient.id));
    await db.delete(clients).where(eq(clients.id, twoDayClient.id));
  });

  it('does not insert an achievement when the week is completed via the protector', async () => {
    const [protClient] = await db
      .insert(clients)
      .values({ name: 'No Achievement Client', email: `noachievement-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', trainingDays: 2 })
      .returning();
    const token = signToken({ id: protClient.id, role: 'cliente', name: protClient.name, email: protClient.email });

    await request(app).post(`/api/clients/${protClient.id}/training/use-protector`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });
    await request(app).post(`/api/clients/${protClient.id}/training/confirm-session`).set('Authorization', `Bearer ${token}`).send({ tz: 'America/Mexico_City' });

    const logs = await db.select().from(achievementLogs).where(eq(achievementLogs.clientId, protClient.id));
    expect(logs).toHaveLength(0);

    await db.delete(clients).where(eq(clients.id, protClient.id));
  });
});

describe('GET /training/achievements', () => {
  it('is admin-only', async () => {
    const [freshClient] = await db
      .insert(clients)
      .values({ name: 'Achievements View Client', email: `achview-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    const clientToken = signToken({ id: freshClient.id, role: 'cliente', name: freshClient.name, email: freshClient.email });

    const res = await request(app).get(`/api/clients/${freshClient.id}/training/achievements`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);

    await db.delete(clients).where(eq(clients.id, freshClient.id));
  });

  it('lists achievements ordered by earned_at descending', async () => {
    const [freshClient] = await db
      .insert(clients)
      .values({ name: 'Achievements List Client', email: `achlist-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    await db.insert(achievementLogs).values([
      { clientId: freshClient.id, type: 'medalla', weekNumber: 1 },
      { clientId: freshClient.id, type: 'medalla', weekNumber: 2 },
    ]);

    const res = await request(app).get(`/api/clients/${freshClient.id}/training/achievements`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.achievements).toHaveLength(2);

    await db.delete(achievementLogs).where(eq(achievementLogs.clientId, freshClient.id));
    await db.delete(clients).where(eq(clients.id, freshClient.id));
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: FAIL — `confirmSession` response missing `streak`/`phrase`, `listAchievements` undefined, achievements route 404

- [ ] **Step 5: Extend `confirmSession`, add `pickRandomPhrase` and `listAchievements`**

Import `phrases`, `achievementLogs`, `desc` (from `drizzle-orm`) alongside the existing imports in `apps/api/src/services/training.service.ts`. Replace the existing `confirmSession` function (current lines 35-72) with:

```typescript
export function pickRandomPhrase(pool: Phrase[], context: string): Phrase | null {
  const eligible = pool.filter((p) => p.active && (p.context === context || p.context === 'ambas'));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// Puerto del confirm-session del legacy (server.js:1305-1367), ahora completo:
// además de insertar training_completions, dibuja una frase (non-fatal) y
// calcula la racha; registra achievement_logs solo en la transición exacta
// de "semana incompleta" a "semana completa" causada por ESTA llamada — el
// protector nunca dispara un logro (no pasa por este código).
export async function confirmSession(
  clientId: string,
  tz: string,
  source: 'manual' | 'nfc' = 'manual'
): Promise<{ alreadyConfirmedToday: boolean; dayNumber: number | null; streak: TrainingStreak; phrase: string | null }> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  const trainingDays = client?.trainingDays || 0;
  if (!trainingDays) throw new NoTrainingDaysError();

  const effectiveTz = source === 'nfc' ? DEFAULT_TRAINING_TZ : tz;
  const today = todayInTz(effectiveTz);
  const weekStart = weekStartInTz(effectiveTz);
  const completions = await listTrainingCompletions(clientId);
  const alreadyConfirmedToday = completions.some((c) => c.completedDate === today);

  let dayNumber: number | null = null;
  let justInsertedNewSession = false;
  let wasCompletedBeforeThisCall = false;

  if (!alreadyConfirmedToday) {
    const doneThisWeek = new Set(completions.filter((c) => c.completedDate >= weekStart).map((c) => c.dayNumber)).size;
    wasCompletedBeforeThisCall = doneThisWeek >= trainingDays;
    dayNumber = Math.min(trainingDays, doneThisWeek + 1);

    const existing = await db
      .select()
      .from(trainingCompletions)
      .where(
        and(
          eq(trainingCompletions.clientId, clientId),
          eq(trainingCompletions.dayNumber, dayNumber),
          eq(trainingCompletions.completedDate, today)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(trainingCompletions).values({ clientId, dayNumber, completedDate: today, source });
      justInsertedNewSession = true;
    }
  }

  let phrase: string | null = null;
  try {
    const pool = await db.select().from(phrases).where(eq(phrases.active, true));
    const drawn = pickRandomPhrase(pool, 'confirmacion');
    phrase = drawn ? drawn.text : null;
  } catch {
    phrase = null;
  }

  const streak = await computeTrainingStreakState(clientId, trainingDays, effectiveTz);

  if (justInsertedNewSession && !wasCompletedBeforeThisCall && streak.sessionsDoneThisWeek >= trainingDays) {
    try {
      await db.insert(achievementLogs).values({ clientId, type: 'medalla', weekNumber: streak.streakWeeks });
      if (streak.streakWeeks > 0 && streak.streakWeeks % 4 === 0) {
        await db.insert(achievementLogs).values({ clientId, type: 'copa', weekNumber: streak.streakWeeks });
      }
    } catch {
      // non-fatal, igual que el legacy
    }
  }

  return { alreadyConfirmedToday, dayNumber, streak, phrase };
}

export async function listAchievements(clientId: string): Promise<AchievementLog[]> {
  return db.select().from(achievementLogs).where(eq(achievementLogs.clientId, clientId)).orderBy(desc(achievementLogs.earnedAt));
}
```

- [ ] **Step 6: Update the controller and add the achievements route**

```typescript
// apps/api/src/controllers/training.controller.ts — replace the existing confirmSession function with:
export async function confirmSession(req: Request, res: Response) {
  const { tz, source } = req.body as ConfirmSessionInput;
  try {
    const result = await trainingService.confirmSession(req.params.id, tz, source === 'nfc' ? 'nfc' : 'manual');
    return ok(res, result);
  } catch (e) {
    if (e instanceof trainingService.NoTrainingDaysError) return err(res, e.message, 400);
    throw e;
  }
}

export async function listAchievements(req: Request, res: Response) {
  const achievements = await trainingService.listAchievements(req.params.id);
  return ok(res, { achievements });
}
```

```typescript
// apps/api/src/routes/training.routes.ts — add, after the use-protector route:
trainingRouter.get(
  '/:id/training/achievements',
  authMiddleware,
  adminOnly,
  asyncHandler(trainingController.listAchievements)
);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: PASS (all tests)

Then run the full `apps/api` suite:

Run: `cd apps/api && npm test`
Expected: PASS (all tests, no regressions)

- [ ] **Step 8: Commit**

```bash
git add packages/shared-types/src/training.ts packages/shared-types/test/training.test.ts apps/api/src/services/training.service.ts apps/api/src/controllers/training.controller.ts apps/api/src/routes/training.routes.ts apps/api/test/training.routes.test.ts
git commit -m "feat(api): extend confirm-session with phrase/streak/achievements, add GET /training/achievements"
```

---

### Task 4: Frontend API client extensions

**Files:**
- Modify: `apps/web/lib/training-client.ts` (add `TrainingStreak`, `Achievement` types, `getStreak`, `useProtector`, `getAchievements`; update `confirmSession`)
- Modify: `apps/web/test/training-client.test.ts`

**Interfaces:**
- Produces: `TrainingStreak` type (matches Task 1's backend shape exactly), `getStreak(clientId, tz)`, `useProtector(clientId, tz)`, `getAchievements(clientId)`, updated `confirmSession(clientId, tz, source?)` returning `{ alreadyConfirmedToday, dayNumber, streak, phrase }` — consumed by Tasks 5-8.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/training-client.test.ts — add these tests inside the existing `describe('training-client', ...)`,
// and update the existing "confirmSession returns alreadyConfirmedToday and dayNumber" test as shown.

it('getStreak returns the streak object', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: async () => ({
      success: true,
      streak: { streakWeeks: 2, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 3, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
    }),
  });
  const result = await getStreak('client-1', 'America/Mexico_City');
  expect(result.streakWeeks).toBe(2);
  const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(url).toContain('/training/streak?tz=');
});

it('useProtector posts tz and returns the updated streak', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: async () => ({
      success: true,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 3, protectorAvailable: false, protectorUsedThisWeek: true, atRisk: false },
    }),
  });
  const result = await useProtector('client-1', 'America/Mexico_City');
  expect(result.protectorUsedThisWeek).toBe(true);
});

it('getAchievements returns the achievements array', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: async () => ({ success: true, achievements: [{ id: 'a1', clientId: 'client-1', type: 'medalla', weekNumber: 1, earnedAt: '2026-01-01' }] }),
  });
  const result = await getAchievements('client-1');
  expect(result).toHaveLength(1);
});
```

Replace the existing `confirmSession` test with:

```typescript
it('confirmSession returns alreadyConfirmedToday, dayNumber, streak, and phrase', async () => {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: async () => ({
      success: true,
      alreadyConfirmedToday: false,
      dayNumber: 2,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 2, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: 'Sigue así.',
    }),
  });
  const result = await confirmSession('client-1', 'America/Mexico_City');
  expect(result).toEqual({
    alreadyConfirmedToday: false,
    dayNumber: 2,
    streak: { streakWeeks: 1, sessionsDoneThisWeek: 2, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
    phrase: 'Sigue así.',
  });
});
```

Add `getStreak, useProtector, getAchievements` to the existing import line at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/training-client.test.ts`
Expected: FAIL — `getStreak`/`useProtector`/`getAchievements` not exported; `confirmSession` test fails on shape mismatch

- [ ] **Step 3: Write the implementation**

Add to `apps/web/lib/training-client.ts`:

```typescript
export type TrainingStreak = {
  streakWeeks: number;
  sessionsDoneThisWeek: number;
  sessionsRequiredThisWeek: number;
  protectorAvailable: boolean;
  protectorUsedThisWeek: boolean;
  atRisk: boolean;
};

export async function getStreak(clientId: string, tz: string): Promise<TrainingStreak> {
  const body = await authorizedRequest<{ success: boolean; streak: TrainingStreak; error?: string }>(
    `/api/clients/${clientId}/training/streak?tz=${encodeURIComponent(tz)}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener la racha.');
  return body.streak;
}

export async function useProtector(clientId: string, tz: string): Promise<TrainingStreak> {
  const body = await authorizedRequest<{ success: boolean; streak: TrainingStreak; error?: string }>(
    `/api/clients/${clientId}/training/use-protector`,
    'POST',
    { tz }
  );
  if (!body.success) throw new Error(body.error || 'Error al usar el protector.');
  return body.streak;
}

export type Achievement = {
  id: string;
  clientId: string;
  type: 'medalla' | 'copa';
  weekNumber: number;
  earnedAt: string;
};

export async function getAchievements(clientId: string): Promise<Achievement[]> {
  const body = await authorizedRequest<{ success: boolean; achievements: Achievement[]; error?: string }>(
    `/api/clients/${clientId}/training/achievements`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener los logros.');
  return body.achievements;
}
```

Replace the existing `confirmSession` function with:

```typescript
export async function confirmSession(
  clientId: string,
  tz: string,
  source: 'manual' | 'nfc' = 'manual'
): Promise<{ alreadyConfirmedToday: boolean; dayNumber: number | null; streak: TrainingStreak; phrase: string | null }> {
  const body = await authorizedRequest<{
    success: boolean;
    alreadyConfirmedToday: boolean;
    dayNumber: number | null;
    streak: TrainingStreak;
    phrase: string | null;
    error?: string;
  }>(`/api/clients/${clientId}/training/confirm-session`, 'POST', { tz, source });
  if (!body.success) throw new Error(body.error || 'Error al confirmar la sesión.');
  return { alreadyConfirmedToday: body.alreadyConfirmedToday, dayNumber: body.dayNumber, streak: body.streak, phrase: body.phrase };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/training-client.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/training-client.ts apps/web/test/training-client.test.ts
git commit -m "feat(web): add getStreak/useProtector/getAchievements client wrappers, extend confirmSession"
```

---

### Task 5: TrainingHome — streak badge, week progress card, protector button

**Files:**
- Modify: `apps/web/components/training/TrainingHome.tsx`
- Modify: `apps/web/test/training-home.test.tsx`

**Interfaces:**
- Consumes: `TrainingStreak` (Task 4).
- Produces: `TrainingHome` gains 3 new props: `streak: TrainingStreak | null`, `onUseProtector: () => void`, `protectorPending: boolean` — consumed by Task 7 (`TrainingShell`).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/training-home.test.tsx — add these tests, and add `streak: null, onUseProtector: vi.fn(), protectorPending: false`
// to every existing `render(<TrainingHome .../>)` call's props (all 3 existing tests need this to keep type-checking).

it('renders the streak badge with the current streakWeeks', () => {
  render(
    <TrainingHome
      trainingDays={2}
      exercises={[]}
      completions={[]}
      streak={{ streakWeeks: 3, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false }}
      onOpenDay={vi.fn()}
      onUseProtector={vi.fn()}
      protectorPending={false}
    />
  );
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText(/semanas seguidas/)).toBeInTheDocument();
});

it('shows an "en riesgo" label when atRisk is true', () => {
  render(
    <TrainingHome
      trainingDays={2}
      exercises={[]}
      completions={[]}
      streak={{ streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: true }}
      onOpenDay={vi.fn()}
      onUseProtector={vi.fn()}
      protectorPending={false}
    />
  );
  expect(screen.getByText(/en riesgo/)).toBeInTheDocument();
});

it('calls onUseProtector when the protector button is clicked, and disables it once used', () => {
  const onUseProtector = vi.fn();
  const { rerender } = render(
    <TrainingHome
      trainingDays={2}
      exercises={[]}
      completions={[]}
      streak={{ streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false }}
      onOpenDay={vi.fn()}
      onUseProtector={onUseProtector}
      protectorPending={false}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /usar/i }));
  expect(onUseProtector).toHaveBeenCalled();

  rerender(
    <TrainingHome
      trainingDays={2}
      exercises={[]}
      completions={[]}
      streak={{ streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 2, protectorAvailable: false, protectorUsedThisWeek: true, atRisk: false }}
      onOpenDay={vi.fn()}
      onUseProtector={onUseProtector}
      protectorPending={false}
    />
  );
  expect(screen.getByRole('button', { name: /usar|usado/i })).toBeDisabled();
});
```

Add `fireEvent` to the existing `@testing-library/react` import line if not already present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/training-home.test.tsx`
Expected: FAIL — `streak`/`onUseProtector`/`protectorPending` props don't exist yet, streak badge/protector button not rendered

- [ ] **Step 3: Write the implementation**

Replace `apps/web/components/training/TrainingHome.tsx` in full with:

```tsx
'use client';

import type { Exercise, TrainingCompletion, TrainingStreak } from '../../lib/training-client';
import { isDayUnlocked, isDayCompletedThisWeek, calculateDisciplineStats } from '../../lib/training-home-logic';

export type TrainingHomeProps = {
  trainingDays: number;
  exercises: Exercise[];
  completions: TrainingCompletion[];
  streak: TrainingStreak | null;
  onOpenDay: (day: number) => void;
  onUseProtector: () => void;
  protectorPending: boolean;
};

function monthCalendarCells(completions: TrainingCompletion[]): { day: number; completed: boolean }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const completedDates = new Set(completions.map((c) => c.completedDate));
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, completed: completedDates.has(iso) };
  });
}

function nextActionableDay(trainingDays: number, completions: TrainingCompletion[]): number | null {
  for (let day = 1; day <= trainingDays; day++) {
    if (isDayUnlocked(day, completions) && !isDayCompletedThisWeek(day, completions)) return day;
  }
  return null;
}

export function TrainingHome({ trainingDays, exercises, completions, streak, onOpenDay, onUseProtector, protectorPending }: TrainingHomeProps) {
  const days = Array.from({ length: trainingDays }, (_, i) => i + 1);
  const stats = calculateDisciplineStats(completions, trainingDays);
  const calendarCells = monthCalendarCells(completions);
  const heroDay = nextActionableDay(trainingDays, completions);

  return (
    <div>
      <h1>Entrenamiento</h1>

      {streak && (
        <div>
          <span>🔥</span>
          <span>{streak.streakWeeks}</span>
          <span>{streak.atRisk ? 'en riesgo' : streak.streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'}</span>
        </div>
      )}

      {streak && (
        <section>
          <h2>Tu semana</h2>
          <div>
            {Array.from({ length: streak.sessionsRequiredThisWeek }, (_, i) => i + 1).map((n) => (
              <span key={n}>
                {n <= streak.sessionsDoneThisWeek ? '✓' : streak.protectorUsedThisWeek ? '🛡️' : '?'}
              </span>
            ))}
          </div>
          <p>
            {streak.protectorUsedThisWeek
              ? 'Semana protegida — no necesitas completar más sesiones para conservar tu racha.'
              : `${streak.sessionsDoneThisWeek} de ${streak.sessionsRequiredThisWeek} sesiones completadas.`}
          </p>
          <button type="button" disabled={streak.protectorUsedThisWeek || protectorPending} onClick={onUseProtector}>
            {streak.protectorUsedThisWeek ? 'Usado' : 'Usar protector'}
          </button>
        </section>
      )}

      {heroDay !== null && (
        <section>
          <button type="button" onClick={() => onOpenDay(heroDay)}>
            Comenzar sesión
          </button>
        </section>
      )}

      <section>
        <h2>Días de entrenamiento</h2>
        <div>
          {days.map((day) => {
            const unlocked = isDayUnlocked(day, completions);
            const completedThisWeek = isDayCompletedThisWeek(day, completions);
            const count = exercises.filter((ex) => ex.dayNumber === day).length;
            return (
              <button key={day} type="button" disabled={!unlocked} onClick={() => onOpenDay(day)}>
                Día {day} {completedThisWeek ? '— Completado esta semana' : !unlocked ? '— Bloqueado' : `— ${count} ejercicios`}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Nivel de disciplina</h2>
        <p>
          {stats.doneDays}/{stats.expected} · {stats.pct}%
        </p>
        <div>
          {calendarCells.map(({ day, completed }) =>
            completed ? (
              <strong key={day}>{day}</strong>
            ) : (
              <span key={day}>{day}</span>
            )
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/training-home.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/training/TrainingHome.tsx apps/web/test/training-home.test.tsx
git commit -m "feat(web): add streak badge, week-progress card, and protector button to TrainingHome"
```

---

### Task 6: SessionConfirmedScreen component

**Files:**
- Create: `apps/web/components/training/SessionConfirmedScreen.tsx`
- Test: `apps/web/test/session-confirmed-screen.test.tsx`

**Interfaces:**
- Consumes: `TrainingStreak` (Task 4).
- Produces: `SessionConfirmedScreen` component (props: `streak: TrainingStreak`, `phrase: string | null`, `onClose: () => void`) — consumed by Task 7 (`TrainingShell`) and Task 8 (`/training` NFC path).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/test/session-confirmed-screen.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionConfirmedScreen } from '../components/training/SessionConfirmedScreen';

const baseStreak = {
  streakWeeks: 3,
  sessionsDoneThisWeek: 2,
  sessionsRequiredThisWeek: 2,
  protectorAvailable: true,
  protectorUsedThisWeek: false,
  atRisk: false,
};

describe('SessionConfirmedScreen', () => {
  it('shows the title, week fraction, and streak count', () => {
    render(<SessionConfirmedScreen streak={baseStreak} phrase={null} onClose={vi.fn()} />);
    expect(screen.getByText('¡Sesión confirmada!')).toBeInTheDocument();
    expect(screen.getByText('2/2 esta semana')).toBeInTheDocument();
    expect(screen.getByText(/3 semanas seguidas/)).toBeInTheDocument();
  });

  it('shows the phrase when provided, and nothing when null', () => {
    const { rerender } = render(<SessionConfirmedScreen streak={baseStreak} phrase="Sigue así." onClose={vi.fn()} />);
    expect(screen.getByText('"Sigue así."')).toBeInTheDocument();

    rerender(<SessionConfirmedScreen streak={baseStreak} phrase={null} onClose={vi.fn()} />);
    expect(screen.queryByText(/"/)).not.toBeInTheDocument();
  });

  it('calls onClose when Cerrar is clicked', () => {
    const onClose = vi.fn();
    render(<SessionConfirmedScreen streak={baseStreak} phrase={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('always renders the share button disabled', () => {
    render(<SessionConfirmedScreen streak={baseStreak} phrase={null} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /compartir/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/session-confirmed-screen.test.tsx`
Expected: FAIL — `Cannot find module '../components/training/SessionConfirmedScreen'`

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/components/training/SessionConfirmedScreen.tsx
'use client';

import type { TrainingStreak } from '../../lib/training-client';

export type SessionConfirmedScreenProps = {
  streak: TrainingStreak;
  phrase: string | null;
  onClose: () => void;
};

export function SessionConfirmedScreen({ streak, phrase, onClose }: SessionConfirmedScreenProps) {
  const dots = Array.from({ length: streak.sessionsRequiredThisWeek }, (_, i) => i + 1);

  return (
    <div>
      <h1>¡Sesión confirmada!</h1>
      <p>
        {streak.sessionsDoneThisWeek}/{streak.sessionsRequiredThisWeek} esta semana
      </p>
      <div>
        {dots.map((n) => (
          <span key={n}>{n <= streak.sessionsDoneThisWeek ? '✓' : n}</span>
        ))}
      </div>
      <p>
        {streak.streakWeeks} {streak.streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'}
      </p>
      {phrase && <p>&quot;{phrase}&quot;</p>}
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
      <button type="button" disabled>
        Compartir (Próximamente)
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/session-confirmed-screen.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/training/SessionConfirmedScreen.tsx apps/web/test/session-confirmed-screen.test.tsx
git commit -m "feat(web): add SessionConfirmedScreen (dark-only, share button disabled)"
```

---

### Task 7: Wire TrainingShell to the extended data and the confirmed-screen view

**Files:**
- Modify: `apps/web/components/training/TrainingShell.tsx`
- Modify: `apps/web/test/training-shell.test.tsx`

**Interfaces:**
- Consumes: `getStreak`, `useProtector` (Task 4); `TrainingHome`'s new props (Task 5); `SessionConfirmedScreen` (Task 6).
- Produces: `TrainingShell` now fetches and displays streak data, shows `SessionConfirmedScreen` after a real (non-duplicate) session confirmation, and wires the protector button — no change to `TrainingShellProps` (still just `clientId`).

- [ ] **Step 1: Update the test file's mocks and add new tests**

In `apps/web/test/training-shell.test.tsx`, add to the `beforeEach` (alongside the existing mocks):

```typescript
vi.mocked(trainingClient.getStreak).mockResolvedValue({
  streakWeeks: 0,
  sessionsDoneThisWeek: 0,
  sessionsRequiredThisWeek: 1,
  protectorAvailable: true,
  protectorUsedThisWeek: false,
  atRisk: false,
});
```

Update the existing mock for `confirmSession` in the "navigates home → day → category (player) → mark complete → confirm session" and any other test that calls it, so its resolved value includes the new fields, e.g.:

```typescript
vi.mocked(trainingClient.confirmSession).mockResolvedValue({
  alreadyConfirmedToday: false,
  dayNumber: 1,
  streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
  phrase: 'Vas muy bien.',
});
```

Add these new tests:

```typescript
it('shows SessionConfirmedScreen after a real (non-duplicate) day completion', async () => {
  vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
  render(<TrainingShell clientId="c1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
  expect(await screen.findByText('¡Sesión confirmada!')).toBeInTheDocument();
  expect(screen.getByText('"Vas muy bien."')).toBeInTheDocument();
});

it('returns to home when Cerrar is clicked on the confirmed screen', async () => {
  vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
  render(<TrainingShell clientId="c1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
  expect(await screen.findByRole('button', { name: /Día 1/ })).toBeInTheDocument();
});

it('shows the completionNotice (not the confirmed screen) when alreadyConfirmedToday is true', async () => {
  vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
  vi.mocked(trainingClient.confirmSession).mockResolvedValue({
    alreadyConfirmedToday: true,
    dayNumber: null,
    streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
    phrase: null,
  });
  render(<TrainingShell clientId="c1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
  expect(await screen.findByText(/Ya confirmaste tu sesión de hoy/)).toBeInTheDocument();
  expect(screen.queryByText('¡Sesión confirmada!')).not.toBeInTheDocument();
});

it('calls useProtector and updates the displayed streak', async () => {
  vi.mocked(trainingClient.useProtector).mockResolvedValue({
    streakWeeks: 1,
    sessionsDoneThisWeek: 0,
    sessionsRequiredThisWeek: 1,
    protectorAvailable: false,
    protectorUsedThisWeek: true,
    atRisk: false,
  });
  render(<TrainingShell clientId="c1" />);
  fireEvent.click(await screen.findByRole('button', { name: /usar protector/i }));
  await waitFor(() => expect(trainingClient.useProtector).toHaveBeenCalledWith('c1', expect.any(String)));
  expect(await screen.findByRole('button', { name: /^usado$/i })).toBeInTheDocument();
});
```

Add `waitFor` to the existing `@testing-library/react` import if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/training-shell.test.tsx`
Expected: FAIL — `getStreak` not called by `TrainingShell`, no `SessionConfirmedScreen` rendered, no protector button reachable

- [ ] **Step 3: Write the implementation**

Replace `apps/web/components/training/TrainingShell.tsx` in full with:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Exercise, ExerciseCategory, TrainingCompletion, TrainingStreak } from '../../lib/training-client';
import {
  getClientTrainingDays,
  listExercises,
  listTrainingCompletions,
  confirmSession,
  getStreak,
  useProtector,
} from '../../lib/training-client';
import { isDayCompletedThisWeek } from '../../lib/training-home-logic';
import { TrainingHome } from './TrainingHome';
import { TrainingDayView } from './TrainingDayView';
import { TrainingPlayer } from './TrainingPlayer';
import { SessionConfirmedScreen } from './SessionConfirmedScreen';

export type TrainingShellProps = {
  clientId: string;
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function TrainingShell({ clientId }: TrainingShellProps) {
  const [trainingDays, setTrainingDays] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [completions, setCompletions] = useState<TrainingCompletion[]>([]);
  const [streak, setStreak] = useState<TrainingStreak | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completingDay, setCompletingDay] = useState(false);
  const [protectorPending, setProtectorPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<{ streak: TrainingStreak; phrase: string | null } | null>(null);

  const load = useCallback(async () => {
    const tz = clientTz();
    const [days, exerciseList, completionList, streakState] = await Promise.all([
      getClientTrainingDays(clientId),
      listExercises(clientId),
      listTrainingCompletions(clientId),
      getStreak(clientId, tz),
    ]);
    setTrainingDays(days);
    setExercises(exerciseList);
    setCompletions(completionList);
    setStreak(streakState);
  }, [clientId]);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  function openDay(d: number) {
    setDay(d);
    setCategory(null);
    setCompletedIds(new Set());
    setCompletionNotice(null);
  }

  function backToHome() {
    setDay(null);
    setCategory(null);
    setCompletedIds(new Set());
  }

  function backToDay() {
    setCategory(null);
  }

  async function handleCompleteDay() {
    setCompletingDay(true);
    try {
      const result = await confirmSession(clientId, clientTz());
      await load();
      if (result.alreadyConfirmedToday) {
        backToHome();
        setCompletionNotice('Ya confirmaste tu sesión de hoy — vuelve mañana para el siguiente día.');
      } else {
        setConfirmedResult({ streak: result.streak, phrase: result.phrase });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCompletingDay(false);
    }
  }

  function closeConfirmedScreen() {
    setConfirmedResult(null);
    backToHome();
  }

  async function handleUseProtector() {
    setProtectorPending(true);
    try {
      const streakState = await useProtector(clientId, clientTz());
      setStreak(streakState);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProtectorPending(false);
    }
  }

  function handleMarkComplete(exerciseId: string) {
    setCompletedIds((prev) => new Set(prev).add(exerciseId));
  }

  if (error) return <p role="alert">{error}</p>;

  if (confirmedResult) {
    return <SessionConfirmedScreen streak={confirmedResult.streak} phrase={confirmedResult.phrase} onClose={closeConfirmedScreen} />;
  }

  if (day && category) {
    const categoryExercises = exercises
      .filter((ex) => ex.dayNumber === day && ex.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return (
      <TrainingPlayer exercises={categoryExercises} completedIds={completedIds} onMarkComplete={handleMarkComplete} onExit={backToDay} />
    );
  }

  if (day) {
    const dayExercises = exercises.filter((ex) => ex.dayNumber === day);
    const alreadyCompletedThisWeek = isDayCompletedThisWeek(day, completions);
    return (
      <TrainingDayView
        day={day}
        exercises={dayExercises}
        completedIds={completedIds}
        alreadyCompletedThisWeek={alreadyCompletedThisWeek}
        onOpenCategory={setCategory}
        onCompleteDay={handleCompleteDay}
        completingDay={completingDay}
      />
    );
  }

  return (
    <>
      {completionNotice && (
        <p>
          {completionNotice}
          <button type="button" onClick={() => setCompletionNotice(null)}>
            Cerrar
          </button>
        </p>
      )}
      <TrainingHome
        trainingDays={trainingDays}
        exercises={exercises}
        completions={completions}
        streak={streak}
        onOpenDay={openDay}
        onUseProtector={handleUseProtector}
        protectorPending={protectorPending}
      />
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/training-shell.test.tsx`
Expected: PASS (all tests)

Then run the full `apps/web` suite:

Run: `cd apps/web && npm test`
Expected: PASS (all tests, no regressions)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/training/TrainingShell.tsx apps/web/test/training-shell.test.tsx
git commit -m "feat(web): wire TrainingShell to streak/protector data and the SessionConfirmedScreen view"
```

---

### Task 8: NFC deep-link mechanism

**Files:**
- Create: `apps/web/lib/deep-link.ts`
- Test: `apps/web/test/deep-link.test.ts`
- Modify: `apps/web/app/training/page.tsx`
- Modify: `apps/web/test/training-page.test.tsx`
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/test/login-page.test.tsx`

**Interfaces:**
- Consumes: `confirmSession` (Task 4); `SessionConfirmedScreen` (Task 6); `getSessionToken` (existing `apps/web/lib/api-client.ts`).
- Produces: `captureIncomingDeepLink(search: string)`, `getPendingAction()`, `clearPendingAction()`, `isTrainingConfirmAction(action)` — consumed by both `/training` and `/login` pages.

- [ ] **Step 1: Write the failing test for the deep-link utility**

```typescript
// apps/web/test/deep-link.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { captureIncomingDeepLink, getPendingAction, clearPendingAction, isTrainingConfirmAction } from '../lib/deep-link';

describe('deep-link', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('captures m and a query params into localStorage', () => {
    captureIncomingDeepLink('?m=entrenamiento&a=confirmar');
    expect(getPendingAction()).toEqual({ m: 'entrenamiento', a: 'confirmar' });
  });

  it('does nothing when m or a is missing', () => {
    captureIncomingDeepLink('?m=entrenamiento');
    expect(getPendingAction()).toBeNull();
  });

  it('clearPendingAction removes the stored action', () => {
    captureIncomingDeepLink('?m=entrenamiento&a=confirmar');
    clearPendingAction();
    expect(getPendingAction()).toBeNull();
  });

  it('isTrainingConfirmAction recognizes the entrenamiento:confirmar action only', () => {
    expect(isTrainingConfirmAction({ m: 'entrenamiento', a: 'confirmar' })).toBe(true);
    expect(isTrainingConfirmAction({ m: 'otro', a: 'confirmar' })).toBe(false);
    expect(isTrainingConfirmAction(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/deep-link.test.ts`
Expected: FAIL — `Cannot find module '../lib/deep-link'`

- [ ] **Step 3: Write the deep-link utility**

```typescript
// apps/web/lib/deep-link.ts
const PENDING_ACTION_KEY = 'lt_pending_action';

export type PendingAction = { m: string; a: string };

export function captureIncomingDeepLink(search: string): void {
  const params = new URLSearchParams(search);
  const m = params.get('m');
  const a = params.get('a');
  if (!m || !a) return;
  window.localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify({ m, a }));
}

export function getPendingAction(): PendingAction | null {
  const raw = window.localStorage.getItem(PENDING_ACTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAction;
  } catch {
    return null;
  }
}

export function clearPendingAction(): void {
  window.localStorage.removeItem(PENDING_ACTION_KEY);
}

export function isTrainingConfirmAction(action: PendingAction | null): boolean {
  return action !== null && action.m === 'entrenamiento' && action.a === 'confirmar';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/deep-link.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing tests for `/training`'s NFC handling**

Add to `apps/web/test/training-page.test.tsx` (also add `replace: vi.fn()` to the existing `vi.mock('next/navigation', ...)` mock, and `import { confirmSession } from '../lib/training-client';` plus `import { clearPendingAction } from '../lib/deep-link';` at the top; call `clearPendingAction()` in `beforeEach` so tests don't leak `localStorage` state):

```typescript
it('executes the NFC confirmation immediately when m/a query params are present and a session exists', async () => {
  vi.spyOn(apiClient, 'getSessionToken').mockReturnValue('fake-token');
  vi.mocked(trainingClient.confirmSession).mockResolvedValue({
    alreadyConfirmedToday: false,
    dayNumber: 1,
    streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
    phrase: null,
  });
  window.history.pushState({}, '', '/training?m=entrenamiento&a=confirmar');

  render(<TrainingPage />);

  await waitFor(() => expect(trainingClient.confirmSession).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'nfc'));
  expect(await screen.findByText('¡Sesión confirmada!')).toBeInTheDocument();
});

it('consumes a pending action from localStorage (no query params) when a session exists', async () => {
  vi.spyOn(apiClient, 'getSessionToken').mockReturnValue('fake-token');
  vi.mocked(trainingClient.confirmSession).mockResolvedValue({
    alreadyConfirmedToday: false,
    dayNumber: 1,
    streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
    phrase: null,
  });
  window.localStorage.setItem('lt_pending_action', JSON.stringify({ m: 'entrenamiento', a: 'confirmar' }));
  window.history.pushState({}, '', '/training');

  render(<TrainingPage />);

  await waitFor(() => expect(trainingClient.confirmSession).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'nfc'));
  expect(window.localStorage.getItem('lt_pending_action')).toBeNull();
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/training-page.test.tsx`
Expected: FAIL — `confirmSession` never called with `'nfc'`, no confirmed screen shown

- [ ] **Step 7: Update `/training/page.tsx`**

```tsx
// apps/web/app/training/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionToken } from '../../lib/api-client';
import { confirmSession, type TrainingStreak } from '../../lib/training-client';
import { captureIncomingDeepLink, getPendingAction, clearPendingAction, isTrainingConfirmAction } from '../../lib/deep-link';
import { TrainingShell } from '../../components/training/TrainingShell';
import { SessionConfirmedScreen } from '../../components/training/SessionConfirmedScreen';

// Mismo patrón que apps/web/app/onboarding/page.tsx: el JWT ya trae el id del
// cliente en su payload — decodificarlo evita un round-trip solo para saber
// "quién soy". La autorización real de cada llamada la sigue haciendo el
// backend (ownerOrAdmin + requirePermission) sin importar este valor local.
function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function TrainingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [nfcResult, setNfcResult] = useState<{ streak: TrainingStreak; phrase: string | null } | null>(null);
  const [nfcError, setNfcError] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();

    captureIncomingDeepLink(window.location.search);
    const pending = getPendingAction();
    const hasNfcAction = isTrainingConfirmAction(pending);

    if (!token) {
      router.push('/login');
      return;
    }

    const id = decodeClientIdFromToken(token);
    setClientId(id);

    if (hasNfcAction && id) {
      clearPendingAction();
      router.replace('/training');
      confirmSession(id, clientTz(), 'nfc')
        .then((result) => setNfcResult({ streak: result.streak, phrase: result.phrase }))
        .catch((e: Error) => setNfcError(e.message))
        .finally(() => setReady(true));
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) return null;
  if (nfcError) return <p role="alert">{nfcError}</p>;
  if (nfcResult) {
    return <SessionConfirmedScreen streak={nfcResult.streak} phrase={nfcResult.phrase} onClose={() => setNfcResult(null)} />;
  }

  return <TrainingShell clientId={clientId ?? ''} />;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/training-page.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 9: Write the failing test for login's pending-action redirect**

Add to `apps/web/test/login-page.test.tsx` (add `beforeEach(() => window.localStorage.clear())` inside the existing `beforeEach`):

```typescript
it('redirects to /training when a pending NFC confirm action exists, ahead of the onboarding check', async () => {
  window.localStorage.setItem('lt_pending_action', JSON.stringify({ m: 'entrenamiento', a: 'confirmar' }));
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: async () => ({
      success: true,
      token: 'abc.def.ghi',
      role: 'cliente',
      user: { id: '5', name: 'Cliente', email: 'c5@c.com' },
      onboardingComplete: false,
    }),
  });

  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c5@c.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

  await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/training'));
  expect(pushMock).not.toHaveBeenCalledWith('/onboarding');
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/login-page.test.tsx`
Expected: FAIL — `pushMock` called with `/onboarding`, not `/training`

- [ ] **Step 11: Update `login/page.tsx`**

```tsx
// apps/web/app/(auth)/login/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loginRequest, saveSession } from '../../../lib/api-client';
import { getPendingAction, isTrainingConfirmAction } from '../../../lib/deep-link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await loginRequest(email, password);
    setSubmitting(false);
    if (!result.success || !result.token) {
      setError(result.error || 'Error al iniciar sesión.');
      return;
    }
    saveSession(result.token);

    if (result.role === 'cliente' && isTrainingConfirmAction(getPendingAction())) {
      router.push('/training');
      return;
    }

    if (result.role === 'cliente' && result.clientType !== 'lead_wellness' && !result.onboardingComplete) {
      router.push('/onboarding');
      return;
    }
    router.push('/admin/clients');
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Iniciar sesión</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="password">Contraseña</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/login-page.test.tsx`
Expected: PASS (all tests)

Then run the full `apps/web` suite:

Run: `cd apps/web && npm test`
Expected: PASS (all tests, no regressions)

- [ ] **Step 13: Commit**

```bash
git add apps/web/lib/deep-link.ts apps/web/test/deep-link.test.ts apps/web/app/training/page.tsx apps/web/test/training-page.test.tsx apps/web/app/\(auth\)/login/page.tsx apps/web/test/login-page.test.tsx
git commit -m "feat(web): add NFC deep-link capture/consume flow across /training and /login"
```
