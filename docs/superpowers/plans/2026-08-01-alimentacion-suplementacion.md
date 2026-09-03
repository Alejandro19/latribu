# Alimentación y Suplementación — Migración a la Arquitectura Nueva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the legacy Alimentación (`nutrition_plans` + `meals`) and Suplementación (`supplements`) modules from `server.js`/`index.html` to the new stack (`apps/api` + `apps/web`), following the exact Routes → Controllers → Services → Models pattern already used for Entrenamiento (`exercises`) and Descanso (`rest_tools`).

**Architecture:** Two new client-scoped routers (`nutritionRouter`, `supplementsRouter`) mounted at `/api/clients` in `apps/api`, backed by three new Drizzle tables. Frontend: an admin panel per module embedded as a new section in the existing `/admin/clients/[id]` detail page (mirroring `AdminExercisePanel`), plus two new client-facing pages (`/nutrition`, `/supplements`) mirroring `/rest` and the `clientId`-from-JWT pattern in `/training`.

**Tech Stack:** Same as the rest of the monorepo — TypeScript, Express 4, Drizzle ORM + `postgres` driver, Zod, Next.js App Router, Vitest + Testing Library, multer (PDF upload).

## Global Constraints

- No design/styling work in this plan — plain functional HTML only, exactly like every other migrated module so far (deliberate, agreed with the user: one dedicated design pass happens later, across all modules at once).
- Legacy behavior must be preserved exactly: `unlockModule` flips `clients.permissions[moduleKey]` to `true` and inserts a `client_notifications` row the first time an admin saves a plan / assigns a supplement (see `server.js:208-217`, already ported per-service in `exercises.service.ts:21-34` — replicate the same local, non-shared helper in each new service, don't extract a shared one; that's the existing convention in this codebase).
- `nutrition` and `supplementation` are both `LEAD_BLOCKED_MODULES` in `apps/api/src/middleware/require-permission.middleware.ts` already — reuse `requirePermission('nutrition')` / `requirePermission('supplementation')` as-is, do not modify that file.
- Client-scoped read/write routes use `authMiddleware` + `ownerOrAdmin`; admin-only writes (saving the plan, uploading the PDF, creating/editing/deleting meals and supplements) use `authMiddleware` + `adminOnly`, exactly mirroring `server.js:1455-1568`.
- PDF upload reuses the existing `multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })` pattern already used in `personal-info.routes.ts` and `exercises.routes.ts` — same bucket (`latribu-files` via `SUPABASE_BUCKET`), same `uploadFile` helper used by `rest-tools.service.ts` (`apps/api/src/storage/index.ts`).
- Tests run against the dedicated test Postgres database via `apps/api/test/helpers/setupTestEnv.ts` (already wired) — never mocks, never production.
- `schema.sql` at the repo root must be updated to match `apps/api/src/models/schema.ts` for these three tables (documentation only — the real migration is the manual SQL file from Task 8).

## File Structure

```
packages/shared-types/src/
  nutrition.ts                          ← NEW: NutritionPlanUpdateSchema, MealInputSchema
  supplements.ts                        ← NEW: SupplementInputSchema, SUPPLEMENT_CATEGORIES
  index.ts                              ← MODIFY: re-export both
apps/api/
  src/models/schema.ts                  ← MODIFY: add nutritionPlans, meals, supplements tables + types
  src/services/nutrition.service.ts     ← NEW
  src/services/supplements.service.ts   ← NEW
  src/controllers/nutrition.controller.ts    ← NEW
  src/controllers/supplements.controller.ts  ← NEW
  src/routes/nutrition.routes.ts        ← NEW
  src/routes/supplements.routes.ts      ← NEW
  src/app.ts                            ← MODIFY: mount both routers at /api/clients
  test/nutrition.routes.test.ts         ← NEW
  test/supplements.routes.test.ts       ← NEW
apps/web/
  lib/nutrition-client.ts               ← NEW
  lib/supplements-client.ts             ← NEW
  components/nutrition/AdminNutritionPanel.tsx    ← NEW
  components/nutrition/ClientNutritionPanel.tsx   ← NEW
  components/supplements/AdminSupplementsPanel.tsx  ← NEW
  components/supplements/ClientSupplementsPanel.tsx ← NEW
  app/admin/clients/[id]/page.tsx       ← MODIFY: embed both admin panels as new sections
  app/nutrition/page.tsx                ← NEW
  app/supplements/page.tsx              ← NEW
  test/admin-nutrition-panel.test.tsx   ← NEW
  test/client-nutrition-panel.test.tsx  ← NEW
  test/admin-supplements-panel.test.tsx ← NEW
  test/client-supplements-panel.test.tsx ← NEW
  test/nutrition-page.test.tsx          ← NEW
  test/supplements-page.test.tsx        ← NEW
schema.sql                              ← MODIFY: reflect the same 3 tables (already present, verify no drift)
tasks/migration-2026-08-01-nutrition-supplements.sql ← NEW: manual prod migration
```

---

### Task 1: Shared Zod schemas for nutrition and supplements

**Files:**
- Create: `packages/shared-types/src/nutrition.ts`
- Create: `packages/shared-types/src/supplements.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/test/nutrition.test.ts`, `packages/shared-types/test/supplements.test.ts`

**Interfaces:**
- Produces: `NutritionPlanUpdateSchema` (+ `NutritionPlanUpdate`), `MealInputSchema` (+ `MealInput`) from `nutrition.ts`; `SUPPLEMENT_CATEGORIES`, `SupplementInputSchema` (+ `SupplementInput`) from `supplements.ts`. Consumed by Tasks 3-4 (`apps/api`).

- [ ] **Step 1: Write the failing tests**

`packages/shared-types/test/nutrition.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NutritionPlanUpdateSchema, MealInputSchema } from '../src/nutrition.js';

describe('nutrition schemas', () => {
  it('accepts a full plan update', () => {
    const result = NutritionPlanUpdateSchema.safeParse({
      daily_cals: 2200,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 70,
      notes: 'Sin lácteos',
      summary: 'Plan de recomposición',
      menu_plan: [{ day: 'Lunes', items: ['Avena', 'Pollo'] }],
      recommendations: ['Tomar 3L de agua'],
      closing_message: 'Nos vemos en la próxima revisión.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty patch (all fields optional)', () => {
    const result = NutritionPlanUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative macros', () => {
    const result = NutritionPlanUpdateSchema.safeParse({ daily_cals: -100 });
    expect(result.success).toBe(false);
  });

  it('accepts a valid meal input', () => {
    const result = MealInputSchema.safeParse({
      meal_time: 'Desayuno',
      name: 'Avena con fruta',
      calories: 350,
      protein_g: 20,
      carbs_g: 45,
      fat_g: 8,
      tags: ['alto en fibra'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a meal input missing the name', () => {
    const result = MealInputSchema.safeParse({ meal_time: 'Desayuno', calories: 350 });
    expect(result.success).toBe(false);
  });

  it('defaults meal macros to 0 when omitted', () => {
    const result = MealInputSchema.safeParse({ meal_time: 'Cena', name: 'Ensalada' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.calories).toBe(0);
      expect(result.data.protein_g).toBe(0);
    }
  });
});
```

`packages/shared-types/test/supplements.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SupplementInputSchema, SUPPLEMENT_CATEGORIES } from '../src/supplements.js';

describe('supplement schemas', () => {
  it('accepts a valid supplement', () => {
    const result = SupplementInputSchema.safeParse({
      name: 'Magnesio',
      brand: 'NOW Foods',
      dose: '400mg',
      timing: 'Antes de dormir',
      benefit: 'Mejora la calidad del sueño',
      category: 'Sueño',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a supplement missing the name', () => {
    const result = SupplementInputSchema.safeParse({ category: 'Base' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = SupplementInputSchema.safeParse({ name: 'X', category: 'Inventado' });
    expect(result.success).toBe(false);
  });

  it('exposes exactly the 5 legacy categories', () => {
    expect(SUPPLEMENT_CATEGORIES).toEqual(['Nootrópico', 'Adaptógeno', 'Sueño', 'Rendimiento', 'Base']);
  });

  it('defaults active to true when omitted', () => {
    const result = SupplementInputSchema.safeParse({ name: 'Magnesio', category: 'Base' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/shared-types && npx vitest run test/nutrition.test.ts test/supplements.test.ts`
Expected: FAIL — `Cannot find module '../src/nutrition.js'`

- [ ] **Step 3: Implement `packages/shared-types/src/nutrition.ts`**

```ts
import { z } from 'zod';

export const NutritionPlanUpdateSchema = z.object({
  daily_cals: z.coerce.number().int().min(0).optional(),
  protein_g: z.coerce.number().int().min(0).optional(),
  carbs_g: z.coerce.number().int().min(0).optional(),
  fat_g: z.coerce.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  client_observations: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  menu_plan: z.array(z.record(z.string(), z.unknown())).optional(),
  recommendations: z.array(z.string()).optional(),
  closing_message: z.string().nullable().optional(),
});
export type NutritionPlanUpdate = z.infer<typeof NutritionPlanUpdateSchema>;

export const MealInputSchema = z.object({
  meal_time: z.string().min(1),
  name: z.string().min(1),
  calories: z.coerce.number().int().min(0).default(0),
  protein_g: z.coerce.number().int().min(0).default(0),
  carbs_g: z.coerce.number().int().min(0).default(0),
  fat_g: z.coerce.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
});
export type MealInput = z.infer<typeof MealInputSchema>;
```

- [ ] **Step 4: Implement `packages/shared-types/src/supplements.ts`**

```ts
import { z } from 'zod';

export const SUPPLEMENT_CATEGORIES = ['Nootrópico', 'Adaptógeno', 'Sueño', 'Rendimiento', 'Base'] as const;
export const SupplementCategorySchema = z.enum(SUPPLEMENT_CATEGORIES);
export type SupplementCategory = z.infer<typeof SupplementCategorySchema>;

export const SupplementInputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  dose: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  benefit: z.string().nullable().optional(),
  category: SupplementCategorySchema.optional(),
  active: z.coerce.boolean().default(true),
});
export type SupplementInput = z.infer<typeof SupplementInputSchema>;
```

- [ ] **Step 5: Re-export from the package index**

Modify `packages/shared-types/src/index.ts` — add these two lines alongside the existing `export * from './...'` lines (don't remove or reorder the existing ones):

```ts
export * from './nutrition.js';
export * from './supplements.js';
```

- [ ] **Step 6: Run to verify they pass**

Run: `cd packages/shared-types && npx vitest run test/nutrition.test.ts test/supplements.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types
git commit -m "feat(nutrition-supplements): add shared Zod schemas"
```

---

### Task 2: Drizzle schema — `nutritionPlans`, `meals`, `supplements` tables

**Files:**
- Modify: `apps/api/src/models/schema.ts`

**Interfaces:**
- Consumes: `pgTable`, `uuid`, `text`, `integer`, `boolean`, `jsonb`, `timestamp` already imported in `schema.ts` (add `text('...').array()` usage if not already imported — check the top of the file first).
- Produces: `nutritionPlans`, `meals`, `supplements` Drizzle tables and `NutritionPlan`, `Meal`, `Supplement` types. Consumed by Tasks 3-4.

- [ ] **Step 1: Read the current top of `apps/api/src/models/schema.ts`**

Confirm which imports from `drizzle-orm/pg-core` already exist (`pgTable`, `uuid`, `text`, `boolean`, `integer`, `jsonb`, `timestamp` are used elsewhere in the file already — reuse them, don't re-import). This task also needs `text(...).array()` — Drizzle's `text` column builder already supports `.array()` without a separate import.

- [ ] **Step 2: Append the three tables and their inferred types**

Add at the end of `apps/api/src/models/schema.ts` (after the existing `restTools` block and its `RestTool` type export):

```ts
export const nutritionPlans = pgTable('nutrition_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique().references(() => clients.id, { onDelete: 'cascade' }),
  dailyCals: integer('daily_cals').default(0),
  proteinG: integer('protein_g').default(0),
  carbsG: integer('carbs_g').default(0),
  fatG: integer('fat_g').default(0),
  notes: text('notes'),
  clientObservations: text('client_observations'),
  pdfUrl: text('pdf_url'),
  pdfName: text('pdf_name'),
  summary: text('summary'),
  menuPlan: jsonb('menu_plan').default([]),
  recommendations: jsonb('recommendations').default([]),
  closingMessage: text('closing_message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const meals = pgTable('meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  mealTime: text('meal_time').notNull(),
  name: text('name').notNull(),
  calories: integer('calories').default(0),
  proteinG: integer('protein_g').default(0),
  carbsG: integer('carbs_g').default(0),
  fatG: integer('fat_g').default(0),
  tags: text('tags').array().default([]),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const supplements = pgTable('supplements', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brand: text('brand'),
  dose: text('dose'),
  timing: text('timing'),
  benefit: text('benefit'),
  category: text('category'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type NutritionPlan = typeof nutritionPlans.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type Supplement = typeof supplements.$inferSelect;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/models/schema.ts
git commit -m "feat(nutrition-supplements): add Drizzle tables for nutrition_plans, meals, supplements"
```

---

### Task 3: `apps/api` — Alimentación (nutrition + meals)

**Files:**
- Create: `apps/api/src/services/nutrition.service.ts`
- Create: `apps/api/src/controllers/nutrition.controller.ts`
- Create: `apps/api/src/routes/nutrition.routes.ts`
- Modify: `apps/api/src/app.ts` (mount `nutritionRouter` at `/api/clients`)
- Test: `apps/api/test/nutrition.routes.test.ts`

**Interfaces:**
- Consumes: `NutritionPlanUpdateSchema`, `MealInput`, `MealInputSchema` (Task 1); `nutritionPlans`, `meals`, `clients`, `clientNotifications`, `type NutritionPlan`, `type Meal` (Task 2); `db` (`../db/index.js`); `authMiddleware`, `adminOnly`, `ownerOrAdmin` (`../middleware/auth.middleware.js`); `requirePermission` (`../middleware/require-permission.middleware.js`); `validateBody` (`../middleware/validate.js`); `asyncHandler` (`../middleware/async-handler.js`); `uploadFile` from `../storage/index.js` (same helper `rest-tools.service.ts` uses — check its exact export signature there before use).
- Produces: `nutritionRouter` mounted at `/api/clients`, exposing `GET /:id/nutrition`, `PUT /:id/nutrition`, `POST /:id/nutrition/upload-pdf`, `POST /:id/meals`, `PUT /:id/meals/:mealId`, `DELETE /:id/meals/:mealId`.

- [ ] **Step 1: Check the storage helper's exact signature**

Run: `grep -n "export" apps/api/src/storage/index.ts` and `grep -n "uploadFile" apps/api/src/services/rest-tools.service.ts`. Use whatever the real signature is (likely `uploadFile(pathPrefix: string, buffer: Buffer, mimetype: string, originalName: string): Promise<string>`, returning the public URL) — do not guess if it differs from this plan.

- [ ] **Step 2: Write the failing route tests**

`apps/api/test/nutrition.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, nutritionPlans, meals, clientNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('nutrition routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Nutrition Client', email: `nutrition-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(meals).where(eq(meals.clientId, clientId));
    await db.delete(nutritionPlans).where(eq(nutritionPlans.clientId, clientId));
  });

  it('a client with no plan yet gets an empty object back, not a 404', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.plan).toEqual({});
    expect(res.body.meals).toEqual([]);
  });

  it('rejects a client from saving their own plan (admin-only)', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}/nutrition`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ daily_cals: 2000 });
    expect(res.status).toBe(403);
  });

  it('admin saves a plan, which unlocks the nutrition module and notifies the client', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}/nutrition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ daily_cals: 2200, protein_g: 160 });
    expect(res.status).toBe(200);
    expect(res.body.plan.dailyCals).toBe(2200);

    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).nutrition).toBe(true);

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('nutrición'))).toBe(true);
  });

  it('saving the plan a second time does not duplicate the unlock notification', async () => {
    await request(app).put(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${adminToken}`).send({ daily_cals: 2000 });
    await request(app).put(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${adminToken}`).send({ daily_cals: 2100 });

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.filter((n) => n.message.includes('nutrición'))).toHaveLength(1);
  });

  it('admin creates, updates, and deletes a meal', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/meals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ meal_time: 'Desayuno', name: 'Avena', calories: 300 });
    expect(createRes.status).toBe(201);
    const mealId = createRes.body.meal.id;

    const updateRes = await request(app)
      .put(`/api/clients/${clientId}/meals/${mealId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ meal_time: 'Desayuno', name: 'Avena con fruta', calories: 350 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.meal.name).toBe('Avena con fruta');

    const deleteRes = await request(app).delete(`/api/clients/${clientId}/meals/${mealId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app).get(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.meals).toEqual([]);
  });

  it('creating a meal unlocks the nutrition module', async () => {
    await request(app)
      .post(`/api/clients/${clientId}/meals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ meal_time: 'Cena', name: 'Ensalada' });
    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).nutrition).toBe(true);
  });

  it('uploads a PDF and attaches it to the plan', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/nutrition/upload-pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), { filename: 'plan.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.plan.pdfName).toBe('plan.pdf');
    expect(res.body.plan.pdfUrl).toEqual(expect.stringContaining('http'));
  });

  it('rejects a non-PDF upload', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/nutrition/upload-pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('pdf', Buffer.from('not a pdf'), { filename: 'plan.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/nutrition.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/services/nutrition.service.js'`

- [ ] **Step 4: Implement the service**

`apps/api/src/services/nutrition.service.ts`:

```ts
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { nutritionPlans, meals, clients, clientNotifications, type NutritionPlan, type Meal } from '../models/schema.js';
import type { NutritionPlanUpdate, MealInput } from '@latribu/shared-types';

async function unlockModule(clientId: string, moduleKey: string): Promise<void> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client) return;
  const permissions = (client.permissions as Record<string, boolean>) || {};
  if (permissions[moduleKey] === true) return;
  await db.update(clients).set({ permissions: { ...permissions, [moduleKey]: true } }).where(eq(clients.id, clientId));
  await db.insert(clientNotifications).values({ clientId, message: 'Ahora tienes acceso a tu módulo de nutrición.' });
}

export async function getPlanAndMeals(clientId: string): Promise<{ plan: NutritionPlan | Record<string, never>; meals: Meal[] }> {
  const [planRows, mealRows] = await Promise.all([
    db.select().from(nutritionPlans).where(eq(nutritionPlans.clientId, clientId)).limit(1),
    db.select().from(meals).where(eq(meals.clientId, clientId)).orderBy(asc(meals.sortOrder)),
  ]);
  return { plan: planRows[0] || {}, meals: mealRows };
}

export async function upsertPlan(clientId: string, patch: NutritionPlanUpdate): Promise<NutritionPlan> {
  const fields: Record<string, unknown> = {};
  if (patch.daily_cals !== undefined) fields.dailyCals = patch.daily_cals;
  if (patch.protein_g !== undefined) fields.proteinG = patch.protein_g;
  if (patch.carbs_g !== undefined) fields.carbsG = patch.carbs_g;
  if (patch.fat_g !== undefined) fields.fatG = patch.fat_g;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  if (patch.client_observations !== undefined) fields.clientObservations = patch.client_observations;
  if (patch.summary !== undefined) fields.summary = patch.summary;
  if (patch.menu_plan !== undefined) fields.menuPlan = patch.menu_plan;
  if (patch.recommendations !== undefined) fields.recommendations = patch.recommendations;
  if (patch.closing_message !== undefined) fields.closingMessage = patch.closing_message;

  const [plan] = await db
    .insert(nutritionPlans)
    .values({ clientId, ...fields })
    .onConflictDoUpdate({ target: nutritionPlans.clientId, set: { ...fields, updatedAt: new Date() } })
    .returning();

  await unlockModule(clientId, 'nutrition');
  return plan;
}

export async function attachPdf(clientId: string, pdfUrl: string, pdfName: string): Promise<NutritionPlan> {
  const [plan] = await db
    .insert(nutritionPlans)
    .values({ clientId, pdfUrl, pdfName })
    .onConflictDoUpdate({ target: nutritionPlans.clientId, set: { pdfUrl, pdfName, updatedAt: new Date() } })
    .returning();
  return plan;
}

export async function createMeal(clientId: string, input: MealInput): Promise<Meal> {
  const [meal] = await db.insert(meals).values({ clientId, ...input }).returning();
  await unlockModule(clientId, 'nutrition');
  return meal;
}

export async function updateMeal(mealId: string, input: MealInput): Promise<Meal | null> {
  const [meal] = await db.update(meals).set(input).where(eq(meals.id, mealId)).returning();
  return meal ?? null;
}

export async function deleteMeal(mealId: string): Promise<void> {
  await db.delete(meals).where(eq(meals.id, mealId));
}
```

- [ ] **Step 5: Implement the controller**

`apps/api/src/controllers/nutrition.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { NutritionPlanUpdate, MealInput } from '@latribu/shared-types';
import * as nutritionService from '../services/nutrition.service.js';
import { uploadFile } from '../storage/index.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function getNutrition(req: Request, res: Response) {
  const result = await nutritionService.getPlanAndMeals(req.params.id);
  return ok(res, result);
}

export async function putNutrition(req: Request, res: Response) {
  const plan = await nutritionService.upsertPlan(req.params.id, req.body as NutritionPlanUpdate);
  return ok(res, { plan });
}

export async function uploadNutritionPdf(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  if (req.file.mimetype !== 'application/pdf') return err(res, 'Formato inválido. Usa PDF.');
  const pdfUrl = await uploadFile(`${req.params.id}/nutrition`, req.file.buffer, req.file.mimetype, req.file.originalname);
  const plan = await nutritionService.attachPdf(req.params.id, pdfUrl, req.file.originalname);
  return ok(res, { plan });
}

export async function createMeal(req: Request, res: Response) {
  const meal = await nutritionService.createMeal(req.params.id, req.body as MealInput);
  return ok(res, { meal }, 201);
}

export async function updateMeal(req: Request, res: Response) {
  const meal = await nutritionService.updateMeal(req.params.mealId, req.body as MealInput);
  if (!meal) return err(res, 'Comida no encontrada.', 404);
  return ok(res, { meal });
}

export async function deleteMeal(req: Request, res: Response) {
  await nutritionService.deleteMeal(req.params.mealId);
  return ok(res, { message: 'Comida eliminada.' });
}
```

Adjust the `uploadFile` import/call to match its real signature found in Step 1 if it differs.

- [ ] **Step 6: Implement the routes**

`apps/api/src/routes/nutrition.routes.ts`:

```ts
import { Router } from 'express';
import multer from 'multer';
import { NutritionPlanUpdateSchema, MealInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as nutritionController from '../controllers/nutrition.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const nutritionRouter = Router();

nutritionRouter.get(
  '/:id/nutrition',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('nutrition'),
  asyncHandler(nutritionController.getNutrition)
);

nutritionRouter.put(
  '/:id/nutrition',
  authMiddleware,
  adminOnly,
  validateBody(NutritionPlanUpdateSchema),
  asyncHandler(nutritionController.putNutrition)
);

nutritionRouter.post(
  '/:id/nutrition/upload-pdf',
  authMiddleware,
  adminOnly,
  upload.single('pdf'),
  asyncHandler(nutritionController.uploadNutritionPdf)
);

nutritionRouter.post(
  '/:id/meals',
  authMiddleware,
  adminOnly,
  validateBody(MealInputSchema),
  asyncHandler(nutritionController.createMeal)
);

nutritionRouter.put(
  '/:id/meals/:mealId',
  authMiddleware,
  adminOnly,
  validateBody(MealInputSchema),
  asyncHandler(nutritionController.updateMeal)
);

nutritionRouter.delete(
  '/:id/meals/:mealId',
  authMiddleware,
  adminOnly,
  asyncHandler(nutritionController.deleteMeal)
);
```

- [ ] **Step 7: Mount the router**

Modify `apps/api/src/app.ts` — add the import alongside the other router imports and `app.use('/api/clients', nutritionRouter);` alongside the other `/api/clients` mounts (after `trainingRouter`, same block).

- [ ] **Step 8: Run to verify it passes**

Run: `cd apps/api && npx vitest run test/nutrition.routes.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 9: Run the full apps/api suite to confirm no regressions**

Run: `cd apps/api && npx vitest run`
Expected: all tests pass (previous count + 9)

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/services/nutrition.service.ts apps/api/src/controllers/nutrition.controller.ts apps/api/src/routes/nutrition.routes.ts apps/api/src/app.ts apps/api/test/nutrition.routes.test.ts
git commit -m "feat(nutrition): add nutrition plan + meals API (Routes/Controllers/Services)"
```

---

### Task 4: `apps/api` — Suplementación

**Files:**
- Create: `apps/api/src/services/supplements.service.ts`
- Create: `apps/api/src/controllers/supplements.controller.ts`
- Create: `apps/api/src/routes/supplements.routes.ts`
- Modify: `apps/api/src/app.ts` (mount `supplementsRouter` at `/api/clients`)
- Test: `apps/api/test/supplements.routes.test.ts`

**Interfaces:**
- Consumes: `SupplementInput`, `SupplementInputSchema` (Task 1); `supplements`, `clients`, `clientNotifications`, `type Supplement` (Task 2); same middleware as Task 3.
- Produces: `supplementsRouter` mounted at `/api/clients`, exposing `GET /:id/supplements`, `POST /:id/supplements`, `PUT /:id/supplements/:suppId`, `DELETE /:id/supplements/:suppId`.

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/supplements.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, supplements, clientNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('supplements routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Supplement Client', email: `supplements-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(supplements).where(eq(supplements.clientId, clientId));
  });

  it('a client with no supplements yet gets an empty list', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.supplements).toEqual([]);
  });

  it('rejects a client from assigning their own supplement (admin-only)', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/supplements`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ name: 'Magnesio', category: 'Sueño' });
    expect(res.status).toBe(403);
  });

  it('admin assigns a supplement, which unlocks the module and notifies the client', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/supplements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Magnesio', category: 'Sueño', dose: '400mg' });
    expect(res.status).toBe(201);
    expect(res.body.supplement.name).toBe('Magnesio');

    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).supplementation).toBe(true);

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('suplementación'))).toBe(true);
  });

  it('rejects assigning a duplicate supplement name to the same client', async () => {
    await request(app).post(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Magnesio' });
    const res = await request(app).post(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Magnesio' });
    expect(res.status).toBe(409);
  });

  it('admin updates and deletes a supplement', async () => {
    const createRes = await request(app).post(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Ashwagandha' });
    const suppId = createRes.body.supplement.id;

    const updateRes = await request(app)
      .put(`/api/clients/${clientId}/supplements/${suppId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ashwagandha KSM-66', dose: '600mg' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.supplement.name).toBe('Ashwagandha KSM-66');

    const deleteRes = await request(app).delete(`/api/clients/${clientId}/supplements/${suppId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app).get(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.supplements).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/supplements.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/services/supplements.service.js'`

- [ ] **Step 3: Implement the service**

`apps/api/src/services/supplements.service.ts`:

```ts
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { supplements, clients, clientNotifications, type Supplement } from '../models/schema.js';
import type { SupplementInput } from '@latribu/shared-types';

async function unlockModule(clientId: string): Promise<void> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client) return;
  const permissions = (client.permissions as Record<string, boolean>) || {};
  if (permissions.supplementation === true) return;
  await db.update(clients).set({ permissions: { ...permissions, supplementation: true } }).where(eq(clients.id, clientId));
  await db.insert(clientNotifications).values({ clientId, message: 'Ahora tienes acceso a tu módulo de suplementación.' });
}

export async function listSupplements(clientId: string): Promise<Supplement[]> {
  return db.select().from(supplements).where(eq(supplements.clientId, clientId)).orderBy(asc(supplements.sortOrder));
}

export async function createSupplement(clientId: string, input: SupplementInput): Promise<Supplement | null> {
  const existing = await db
    .select()
    .from(supplements)
    .where(and(eq(supplements.clientId, clientId), eq(supplements.name, input.name)));
  if (existing.length > 0) return null;

  const [supplement] = await db.insert(supplements).values({ clientId, ...input }).returning();
  await unlockModule(clientId);
  return supplement;
}

export async function updateSupplement(suppId: string, input: SupplementInput): Promise<Supplement | null> {
  const [supplement] = await db.update(supplements).set({ ...input, updatedAt: new Date() }).where(eq(supplements.id, suppId)).returning();
  return supplement ?? null;
}

export async function deleteSupplement(suppId: string): Promise<void> {
  await db.delete(supplements).where(eq(supplements.id, suppId));
}
```

- [ ] **Step 4: Implement the controller**

`apps/api/src/controllers/supplements.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { SupplementInput } from '@latribu/shared-types';
import * as supplementsService from '../services/supplements.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 404) {
  return res.status(status).json({ success: false, error: message });
}

export async function listSupplements(req: Request, res: Response) {
  const supplementsList = await supplementsService.listSupplements(req.params.id);
  return ok(res, { supplements: supplementsList });
}

export async function createSupplement(req: Request, res: Response) {
  const supplement = await supplementsService.createSupplement(req.params.id, req.body as SupplementInput);
  if (!supplement) return err(res, 'Ya existe un suplemento con ese nombre para este cliente.', 409);
  return ok(res, { supplement }, 201);
}

export async function updateSupplement(req: Request, res: Response) {
  const supplement = await supplementsService.updateSupplement(req.params.suppId, req.body as SupplementInput);
  if (!supplement) return err(res, 'Suplemento no encontrado.');
  return ok(res, { supplement });
}

export async function deleteSupplement(req: Request, res: Response) {
  await supplementsService.deleteSupplement(req.params.suppId);
  return ok(res, { message: 'Suplemento eliminado.' });
}
```

- [ ] **Step 5: Implement the routes**

`apps/api/src/routes/supplements.routes.ts`:

```ts
import { Router } from 'express';
import { SupplementInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as supplementsController from '../controllers/supplements.controller.js';

export const supplementsRouter = Router();

supplementsRouter.get(
  '/:id/supplements',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('supplementation'),
  asyncHandler(supplementsController.listSupplements)
);

supplementsRouter.post(
  '/:id/supplements',
  authMiddleware,
  adminOnly,
  validateBody(SupplementInputSchema),
  asyncHandler(supplementsController.createSupplement)
);

supplementsRouter.put(
  '/:id/supplements/:suppId',
  authMiddleware,
  adminOnly,
  validateBody(SupplementInputSchema),
  asyncHandler(supplementsController.updateSupplement)
);

supplementsRouter.delete(
  '/:id/supplements/:suppId',
  authMiddleware,
  adminOnly,
  asyncHandler(supplementsController.deleteSupplement)
);
```

- [ ] **Step 6: Mount the router**

Modify `apps/api/src/app.ts` — add the import and `app.use('/api/clients', supplementsRouter);` alongside `nutritionRouter` from Task 3.

- [ ] **Step 7: Run to verify it passes**

Run: `cd apps/api && npx vitest run test/supplements.routes.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 8: Run the full apps/api suite to confirm no regressions**

Run: `cd apps/api && npx vitest run`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/supplements.service.ts apps/api/src/controllers/supplements.controller.ts apps/api/src/routes/supplements.routes.ts apps/api/src/app.ts apps/api/test/supplements.routes.test.ts
git commit -m "feat(supplements): add supplements API (Routes/Controllers/Services)"
```

---

### Task 5: `apps/web` — Admin panels (embedded in client detail page)

**Files:**
- Create: `apps/web/lib/nutrition-client.ts`
- Create: `apps/web/lib/supplements-client.ts`
- Create: `apps/web/components/nutrition/AdminNutritionPanel.tsx`
- Create: `apps/web/components/supplements/AdminSupplementsPanel.tsx`
- Modify: `apps/web/app/admin/clients/[id]/page.tsx` (add two new `<section>` blocks, same pattern as the existing `Entrenamiento` section using `AdminExercisePanel`)
- Test: `apps/web/test/admin-nutrition-panel.test.tsx`, `apps/web/test/admin-supplements-panel.test.tsx`

**Interfaces:**
- Consumes: `getSessionToken` from `../api-client` (existing pattern, see `rest-tools-client.ts`).
- Produces: `getNutrition`, `saveNutritionPlan`, `uploadNutritionPdf`, `createMeal`, `updateMeal`, `deleteMeal`, `type NutritionPlan`, `type Meal` from `nutrition-client.ts`; `listSupplements`, `createSupplement`, `updateSupplement`, `deleteSupplement`, `type Supplement` from `supplements-client.ts`; `AdminNutritionPanel`, `AdminSupplementsPanel` components (both take `clientId: string` prop, mirroring `AdminExercisePanel`). Consumed by Task 7 (client detail page) — Task 6 reuses the same `*-client.ts` files.

- [ ] **Step 1: Implement `apps/web/lib/nutrition-client.ts`**

```ts
import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type NutritionPlan = {
  id?: string;
  dailyCals?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  notes?: string | null;
  summary?: string | null;
  pdfUrl?: string | null;
  pdfName?: string | null;
};

export type Meal = {
  id: string;
  mealTime: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export async function getNutrition(clientId: string): Promise<{ plan: NutritionPlan; meals: Meal[] }> {
  const body = await authorizedRequest<{ success: boolean; plan: NutritionPlan; meals: Meal[]; error?: string }>(`/api/clients/${clientId}/nutrition`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el plan de nutrición.');
  return { plan: body.plan, meals: body.meals };
}

export async function saveNutritionPlan(clientId: string, patch: Partial<NutritionPlan> & { daily_cals?: number; protein_g?: number; carbs_g?: number; fat_g?: number; notes?: string }): Promise<NutritionPlan> {
  const body = await authorizedRequest<{ success: boolean; plan: NutritionPlan; error?: string }>(`/api/clients/${clientId}/nutrition`, 'PUT', patch);
  if (!body.success) throw new Error(body.error || 'Error al guardar el plan.');
  return body.plan;
}

export async function uploadNutritionPdf(clientId: string, file: File): Promise<NutritionPlan> {
  const formData = new FormData();
  formData.append('pdf', file);
  const body = await authorizedRequest<{ success: boolean; plan: NutritionPlan; error?: string }>(`/api/clients/${clientId}/nutrition/upload-pdf`, 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir el PDF.');
  return body.plan;
}

export async function createMeal(clientId: string, input: { meal_time: string; name: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }): Promise<Meal> {
  const body = await authorizedRequest<{ success: boolean; meal: Meal; error?: string }>(`/api/clients/${clientId}/meals`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear la comida.');
  return body.meal;
}

export async function updateMeal(clientId: string, mealId: string, input: { meal_time: string; name: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }): Promise<Meal> {
  const body = await authorizedRequest<{ success: boolean; meal: Meal; error?: string }>(`/api/clients/${clientId}/meals/${mealId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar la comida.');
  return body.meal;
}

export async function deleteMeal(clientId: string, mealId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/meals/${mealId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la comida.');
}
```

- [ ] **Step 2: Implement `apps/web/lib/supplements-client.ts`**

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

export type Supplement = {
  id: string;
  name: string;
  brand: string | null;
  dose: string | null;
  timing: string | null;
  benefit: string | null;
  category: string | null;
  active: boolean;
};

export async function listSupplements(clientId: string): Promise<Supplement[]> {
  const body = await authorizedRequest<{ success: boolean; supplements: Supplement[]; error?: string }>(`/api/clients/${clientId}/supplements`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener suplementos.');
  return body.supplements;
}

export async function createSupplement(clientId: string, input: { name: string; brand?: string; dose?: string; timing?: string; benefit?: string; category?: string }): Promise<Supplement> {
  const body = await authorizedRequest<{ success: boolean; supplement: Supplement; error?: string }>(`/api/clients/${clientId}/supplements`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al asignar el suplemento.');
  return body.supplement;
}

export async function updateSupplement(clientId: string, suppId: string, input: { name: string; brand?: string; dose?: string; timing?: string; benefit?: string; category?: string }): Promise<Supplement> {
  const body = await authorizedRequest<{ success: boolean; supplement: Supplement; error?: string }>(`/api/clients/${clientId}/supplements/${suppId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el suplemento.');
  return body.supplement;
}

export async function deleteSupplement(clientId: string, suppId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/supplements/${suppId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el suplemento.');
}
```

- [ ] **Step 3: Write the failing admin panel tests**

`apps/web/test/admin-nutrition-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminNutritionPanel } from '../components/nutrition/AdminNutritionPanel';
import * as nutritionClient from '../lib/nutrition-client';

vi.mock('../lib/nutrition-client');

describe('AdminNutritionPanel', () => {
  beforeEach(() => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: {}, meals: [] });
  });

  it('loads and shows the current plan macros', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: { dailyCals: 2200 }, meals: [] });
    render(<AdminNutritionPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByLabelText('Calorías diarias')).toHaveValue(2200));
  });

  it('saves the plan macros', async () => {
    const user = userEvent.setup();
    vi.mocked(nutritionClient.saveNutritionPlan).mockResolvedValue({ dailyCals: 2000 });
    render(<AdminNutritionPanel clientId="client-1" />);
    await waitFor(() => screen.getByLabelText('Calorías diarias'));

    await user.clear(screen.getByLabelText('Calorías diarias'));
    await user.type(screen.getByLabelText('Calorías diarias'), '2000');
    await user.click(screen.getByRole('button', { name: 'Guardar plan' }));

    await waitFor(() => expect(nutritionClient.saveNutritionPlan).toHaveBeenCalledWith('client-1', expect.objectContaining({ daily_cals: 2000 })));
  });

  it('adds a meal', async () => {
    const user = userEvent.setup();
    vi.mocked(nutritionClient.createMeal).mockResolvedValue({ id: 'meal-1', mealTime: 'Desayuno', name: 'Avena', calories: 300, proteinG: 10, carbsG: 40, fatG: 5 });
    render(<AdminNutritionPanel clientId="client-1" />);
    await waitFor(() => screen.getByLabelText('Calorías diarias'));

    await user.type(screen.getByLabelText('Momento'), 'Desayuno');
    await user.type(screen.getByLabelText('Nombre de la comida'), 'Avena');
    await user.click(screen.getByRole('button', { name: 'Agregar comida' }));

    await waitFor(() => expect(nutritionClient.createMeal).toHaveBeenCalledWith('client-1', expect.objectContaining({ meal_time: 'Desayuno', name: 'Avena' })));
  });
});
```

`apps/web/test/admin-supplements-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminSupplementsPanel } from '../components/supplements/AdminSupplementsPanel';
import * as supplementsClient from '../lib/supplements-client';

vi.mock('../lib/supplements-client');

describe('AdminSupplementsPanel', () => {
  beforeEach(() => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
  });

  it('lists existing supplements', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Magnesio', brand: null, dose: '400mg', timing: null, benefit: null, category: 'Sueño', active: true },
    ]);
    render(<AdminSupplementsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Magnesio')).toBeInTheDocument());
  });

  it('assigns a new supplement', async () => {
    const user = userEvent.setup();
    vi.mocked(supplementsClient.createSupplement).mockResolvedValue({ id: 's2', name: 'Ashwagandha', brand: null, dose: null, timing: null, benefit: null, category: null, active: true });
    render(<AdminSupplementsPanel clientId="client-1" />);
    await waitFor(() => screen.getByLabelText('Nombre del suplemento'));

    await user.type(screen.getByLabelText('Nombre del suplemento'), 'Ashwagandha');
    await user.click(screen.getByRole('button', { name: 'Asignar suplemento' }));

    await waitFor(() => expect(supplementsClient.createSupplement).toHaveBeenCalledWith('client-1', expect.objectContaining({ name: 'Ashwagandha' })));
  });

  it('deletes a supplement', async () => {
    const user = userEvent.setup();
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Magnesio', brand: null, dose: null, timing: null, benefit: null, category: null, active: true },
    ]);
    render(<AdminSupplementsPanel clientId="client-1" />);
    await waitFor(() => screen.getByText('Magnesio'));

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(supplementsClient.deleteSupplement).toHaveBeenCalledWith('client-1', 's1'));
  });
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd apps/web && npx vitest run test/admin-nutrition-panel.test.tsx test/admin-supplements-panel.test.tsx`
Expected: FAIL — `Cannot find module '../components/nutrition/AdminNutritionPanel'`

- [ ] **Step 5: Implement `AdminNutritionPanel`**

`apps/web/components/nutrition/AdminNutritionPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getNutrition, saveNutritionPlan, uploadNutritionPdf, createMeal, deleteMeal, type NutritionPlan, type Meal } from '../../lib/nutrition-client';

export function AdminNutritionPanel({ clientId }: { clientId: string }) {
  const [plan, setPlan] = useState<NutritionPlan>({});
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dailyCals, setDailyCals] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [notes, setNotes] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealName, setMealName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    const result = await getNutrition(clientId);
    setPlan(result.plan);
    setMeals(result.meals);
    setDailyCals(result.plan.dailyCals != null ? String(result.plan.dailyCals) : '');
    setProteinG(result.plan.proteinG != null ? String(result.plan.proteinG) : '');
    setCarbsG(result.plan.carbsG != null ? String(result.plan.carbsG) : '');
    setFatG(result.plan.fatG != null ? String(result.plan.fatG) : '');
    setNotes(result.plan.notes || '');
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleSavePlan() {
    try {
      await saveNutritionPlan(clientId, {
        daily_cals: dailyCals ? Number(dailyCals) : undefined,
        protein_g: proteinG ? Number(proteinG) : undefined,
        carbs_g: carbsG ? Number(carbsG) : undefined,
        fat_g: fatG ? Number(fatG) : undefined,
        notes: notes || null,
      });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUploadPdf(file: File) {
    try {
      await uploadNutritionPdf(clientId, file);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAddMeal() {
    if (!mealTime.trim() || !mealName.trim()) return;
    try {
      await createMeal(clientId, { meal_time: mealTime.trim(), name: mealName.trim() });
      setMealTime('');
      setMealName('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDeleteMeal(mealId: string) {
    try {
      await deleteMeal(clientId, mealId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando plan de nutrición...</p>;

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="nutrition-daily-cals">Calorías diarias</label>
      <input id="nutrition-daily-cals" type="number" value={dailyCals} onChange={(e) => setDailyCals(e.target.value)} />
      <label htmlFor="nutrition-protein">Proteína (g)</label>
      <input id="nutrition-protein" type="number" value={proteinG} onChange={(e) => setProteinG(e.target.value)} />
      <label htmlFor="nutrition-carbs">Carbohidratos (g)</label>
      <input id="nutrition-carbs" type="number" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} />
      <label htmlFor="nutrition-fat">Grasas (g)</label>
      <input id="nutrition-fat" type="number" value={fatG} onChange={(e) => setFatG(e.target.value)} />
      <label htmlFor="nutrition-notes">Notas</label>
      <textarea id="nutrition-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="button" onClick={handleSavePlan}>
        Guardar plan
      </button>

      <label htmlFor="nutrition-pdf">PDF del plan</label>
      <input
        id="nutrition-pdf"
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadPdf(file);
        }}
      />
      {plan.pdfUrl && (
        <a href={plan.pdfUrl} target="_blank" rel="noreferrer">
          {plan.pdfName || 'Ver PDF'}
        </a>
      )}

      <h3>Comidas</h3>
      <label htmlFor="meal-time">Momento</label>
      <input id="meal-time" value={mealTime} onChange={(e) => setMealTime(e.target.value)} />
      <label htmlFor="meal-name">Nombre de la comida</label>
      <input id="meal-name" value={mealName} onChange={(e) => setMealName(e.target.value)} />
      <button type="button" onClick={handleAddMeal}>
        Agregar comida
      </button>

      {meals.length === 0 ? (
        <p>Sin comidas asignadas.</p>
      ) : (
        <ul>
          {meals.map((meal) => (
            <li key={meal.id}>
              {meal.mealTime} — {meal.name} ({meal.calories} kcal)
              <button type="button" onClick={() => handleDeleteMeal(meal.id)}>
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

- [ ] **Step 6: Implement `AdminSupplementsPanel`**

`apps/web/components/supplements/AdminSupplementsPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { listSupplements, createSupplement, deleteSupplement, type Supplement } from '../../lib/supplements-client';

export function AdminSupplementsPanel({ clientId }: { clientId: string }) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refetch() {
    const result = await listSupplements(clientId);
    setSupplements(result);
  }

  useEffect(() => {
    refetch()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createSupplement(clientId, { name: name.trim(), dose: dose || undefined, category: category || undefined });
      setName('');
      setDose('');
      setCategory('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(suppId: string) {
    try {
      await deleteSupplement(clientId, suppId);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <p>Cargando suplementos...</p>;

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="supplement-name">Nombre del suplemento</label>
      <input id="supplement-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="supplement-dose">Dosis</label>
      <input id="supplement-dose" value={dose} onChange={(e) => setDose(e.target.value)} />
      <label htmlFor="supplement-category">Categoría</label>
      <select id="supplement-category" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Sin categoría</option>
        <option value="Nootrópico">Nootrópico</option>
        <option value="Adaptógeno">Adaptógeno</option>
        <option value="Sueño">Sueño</option>
        <option value="Rendimiento">Rendimiento</option>
        <option value="Base">Base</option>
      </select>
      <button type="button" onClick={handleCreate}>
        Asignar suplemento
      </button>

      {supplements.length === 0 ? (
        <p>Sin suplementos asignados.</p>
      ) : (
        <ul>
          {supplements.map((supplement) => (
            <li key={supplement.id}>
              {supplement.name} {supplement.dose ? `— ${supplement.dose}` : ''}
              <button type="button" onClick={() => handleDelete(supplement.id)}>
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

- [ ] **Step 7: Embed both panels in the client detail page**

Modify `apps/web/app/admin/clients/[id]/page.tsx` — add the imports (`AdminNutritionPanel` from `'../../../../components/nutrition/AdminNutritionPanel'`, `AdminSupplementsPanel` from `'../../../../components/supplements/AdminSupplementsPanel'`), and add two new `<section>` blocks right after the existing `Entrenamiento` section:

```tsx
<section>
  <h2>Alimentación</h2>
  <AdminNutritionPanel clientId={clientId} />
</section>

<section>
  <h2>Suplementación</h2>
  <AdminSupplementsPanel clientId={clientId} />
</section>
```

- [ ] **Step 8: Run to verify tests pass**

Run: `cd apps/web && npx vitest run test/admin-nutrition-panel.test.tsx test/admin-supplements-panel.test.tsx test/client-detail-page.test.tsx`
Expected: PASS (existing `client-detail-page.test.tsx` must still pass unmodified — it doesn't mock `nutrition-client`/`supplements-client`, so if it starts failing, check whether it needs those modules mocked too, following the same pattern it already uses for `training-client`)

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/nutrition-client.ts apps/web/lib/supplements-client.ts apps/web/components/nutrition apps/web/components/supplements apps/web/app/admin/clients/\[id\]/page.tsx apps/web/test/admin-nutrition-panel.test.tsx apps/web/test/admin-supplements-panel.test.tsx
git commit -m "feat(nutrition-supplements): add admin panels embedded in client detail page"
```

---

### Task 6: `apps/web` — Client-facing pages

**Files:**
- Create: `apps/web/components/nutrition/ClientNutritionPanel.tsx`
- Create: `apps/web/components/supplements/ClientSupplementsPanel.tsx`
- Create: `apps/web/app/nutrition/page.tsx`
- Create: `apps/web/app/supplements/page.tsx`
- Test: `apps/web/test/client-nutrition-panel.test.tsx`, `apps/web/test/client-supplements-panel.test.tsx`, `apps/web/test/nutrition-page.test.tsx`, `apps/web/test/supplements-page.test.tsx`

**Interfaces:**
- Consumes: `getNutrition` (Task 5), `listSupplements` (Task 5), `getSessionToken` from `../lib/api-client`.
- Produces: `ClientNutritionPanel`, `ClientSupplementsPanel` (no props — decode `clientId` from the JWT internally, same `decodeClientIdFromToken` pattern as `app/training/page.tsx`), `NutritionPage`, `SupplementsPage`.

- [ ] **Step 1: Write the failing panel tests**

`apps/web/test/client-nutrition-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ClientNutritionPanel } from '../components/nutrition/ClientNutritionPanel';
import * as nutritionClient from '../lib/nutrition-client';

vi.mock('../lib/nutrition-client');

describe('ClientNutritionPanel', () => {
  it('shows the assigned macros and meals', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({
      plan: { dailyCals: 2200, proteinG: 160 },
      meals: [{ id: 'm1', mealTime: 'Desayuno', name: 'Avena', calories: 300, proteinG: 10, carbsG: 40, fatG: 5 }],
    });
    render(<ClientNutritionPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText(/2200/)).toBeInTheDocument());
    expect(screen.getByText(/Avena/)).toBeInTheDocument();
  });

  it('shows a message when no plan has been assigned yet', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: {}, meals: [] });
    render(<ClientNutritionPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Todavía no tienes un plan de nutrición asignado.')).toBeInTheDocument());
  });

  it('shows a link to the PDF when the plan has one', async () => {
    vi.mocked(nutritionClient.getNutrition).mockResolvedValue({ plan: { dailyCals: 2000, pdfUrl: 'https://x.co/plan.pdf', pdfName: 'plan.pdf' }, meals: [] });
    render(<ClientNutritionPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'plan.pdf' })).toHaveAttribute('href', 'https://x.co/plan.pdf'));
  });
});
```

`apps/web/test/client-supplements-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ClientSupplementsPanel } from '../components/supplements/ClientSupplementsPanel';
import * as supplementsClient from '../lib/supplements-client';

vi.mock('../lib/supplements-client');

describe('ClientSupplementsPanel', () => {
  it('shows the assigned supplements', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Magnesio', brand: null, dose: '400mg', timing: 'Antes de dormir', benefit: null, category: 'Sueño', active: true },
    ]);
    render(<ClientSupplementsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Magnesio')).toBeInTheDocument());
    expect(screen.getByText(/400mg/)).toBeInTheDocument();
  });

  it('shows a message when no supplements are assigned yet', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    render(<ClientSupplementsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Todavía no tienes suplementos asignados.')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && npx vitest run test/client-nutrition-panel.test.tsx test/client-supplements-panel.test.tsx`
Expected: FAIL — `Cannot find module '../components/nutrition/ClientNutritionPanel'`

- [ ] **Step 3: Implement `ClientNutritionPanel`**

`apps/web/components/nutrition/ClientNutritionPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getNutrition, type NutritionPlan, type Meal } from '../../lib/nutrition-client';

export function ClientNutritionPanel({ clientId }: { clientId: string }) {
  const [plan, setPlan] = useState<NutritionPlan>({});
  const [meals, setMeals] = useState<Meal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNutrition(clientId)
      .then((result) => {
        setPlan(result.plan);
        setMeals(result.meals);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p>Cargando tu plan de nutrición...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (plan.dailyCals == null && !plan.pdfUrl) return <p>Todavía no tienes un plan de nutrición asignado.</p>;

  return (
    <div>
      <p>Calorías diarias: {plan.dailyCals ?? '—'}</p>
      <p>Proteína: {plan.proteinG ?? '—'} g</p>
      <p>Carbohidratos: {plan.carbsG ?? '—'} g</p>
      <p>Grasas: {plan.fatG ?? '—'} g</p>
      {plan.pdfUrl && (
        <a href={plan.pdfUrl} target="_blank" rel="noreferrer">
          {plan.pdfName || 'Ver PDF'}
        </a>
      )}

      <h3>Comidas</h3>
      {meals.length === 0 ? (
        <p>Sin comidas asignadas.</p>
      ) : (
        <ul>
          {meals.map((meal) => (
            <li key={meal.id}>
              {meal.mealTime} — {meal.name} ({meal.calories} kcal)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `ClientSupplementsPanel`**

`apps/web/components/supplements/ClientSupplementsPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { listSupplements, type Supplement } from '../../lib/supplements-client';

export function ClientSupplementsPanel({ clientId }: { clientId: string }) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSupplements(clientId)
      .then(setSupplements)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p>Cargando tus suplementos...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (supplements.length === 0) return <p>Todavía no tienes suplementos asignados.</p>;

  return (
    <ul>
      {supplements.map((supplement) => (
        <li key={supplement.id}>
          <strong>{supplement.name}</strong>
          {supplement.dose ? ` — ${supplement.dose}` : ''}
          {supplement.timing ? ` (${supplement.timing})` : ''}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Run panel tests to verify they pass**

Run: `cd apps/web && npx vitest run test/client-nutrition-panel.test.tsx test/client-supplements-panel.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Write the failing page tests**

`apps/web/test/nutrition-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NutritionPage from '../app/nutrition/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/nutrition-client', () => ({
  getNutrition: vi.fn().mockResolvedValue({ plan: {}, meals: [] }),
}));

describe('NutritionPage', () => {
  it('renders the nutrition heading', () => {
    render(<NutritionPage />);
    expect(screen.getByRole('heading', { name: 'Alimentación' })).toBeInTheDocument();
  });
});
```

`apps/web/test/supplements-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupplementsPage from '../app/supplements/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/supplements-client', () => ({
  listSupplements: vi.fn().mockResolvedValue([]),
}));

describe('SupplementsPage', () => {
  it('renders the supplements heading', () => {
    render(<SupplementsPage />);
    expect(screen.getByRole('heading', { name: 'Suplementación' })).toBeInTheDocument();
  });
});
```

Note: the mocked token `header.eyJpZCI6ImNsaWVudC0xIn0.signature` base64-decodes its payload segment to `{"id":"client-1"}` — matches the `decodeClientIdFromToken` helper's `atob(token.split('.')[1])` parsing already used in `app/training/page.tsx`.

- [ ] **Step 7: Run to verify they fail**

Run: `cd apps/web && npx vitest run test/nutrition-page.test.tsx test/supplements-page.test.tsx`
Expected: FAIL — `Cannot find module '../app/nutrition/page'`

- [ ] **Step 8: Implement the pages**

`apps/web/app/nutrition/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '../../lib/api-client';
import { ClientNutritionPanel } from '../../components/nutrition/ClientNutritionPanel';

function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

export default function NutritionPage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (token) setClientId(decodeClientIdFromToken(token));
  }, []);

  return (
    <div>
      <h1>Alimentación</h1>
      {clientId && <ClientNutritionPanel clientId={clientId} />}
    </div>
  );
}
```

`apps/web/app/supplements/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '../../lib/api-client';
import { ClientSupplementsPanel } from '../../components/supplements/ClientSupplementsPanel';

function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

export default function SupplementsPage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (token) setClientId(decodeClientIdFromToken(token));
  }, []);

  return (
    <div>
      <h1>Suplementación</h1>
      {clientId && <ClientSupplementsPanel clientId={clientId} />}
    </div>
  );
}
```

- [ ] **Step 9: Run all new web tests to verify they pass**

Run: `cd apps/web && npx vitest run test/client-nutrition-panel.test.tsx test/client-supplements-panel.test.tsx test/nutrition-page.test.tsx test/supplements-page.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 10: Run the full apps/web suite to confirm no regressions**

Run: `cd apps/web && npx vitest run`
Expected: all tests pass

- [ ] **Step 11: Commit**

```bash
git add apps/web/components/nutrition/ClientNutritionPanel.tsx apps/web/components/supplements/ClientSupplementsPanel.tsx apps/web/app/nutrition apps/web/app/supplements apps/web/test/client-nutrition-panel.test.tsx apps/web/test/client-supplements-panel.test.tsx apps/web/test/nutrition-page.test.tsx apps/web/test/supplements-page.test.tsx
git commit -m "feat(nutrition-supplements): add client-facing pages"
```

---

### Task 7: Manual production migration + `schema.sql` verification

**Files:**
- Verify (no changes expected): `schema.sql` lines covering `nutrition_plans`, `meals`, `supplements` (already present per Task 2's research — confirm no drift between `schema.sql` and `apps/api/src/models/schema.ts`)
- Create: `tasks/migration-2026-08-01-nutrition-supplements.sql`

**Interfaces:**
- None — this task only produces a SQL file for the user to run manually in the Supabase SQL Editor, following the exact same convention as `tasks/migration-2026-08-01-rest-tools.sql`.

- [ ] **Step 1: Diff `schema.sql` against `apps/api/src/models/schema.ts` for these 3 tables**

Run: `grep -n "CREATE TABLE nutrition_plans" -A 20 schema.sql` and compare column-by-column against the Drizzle definitions from Task 2. They should already match (both were derived from the same legacy source) — if any column differs, note it, but do not silently change `schema.sql`'s intent; flag it in the final report instead of guessing.

- [ ] **Step 2: Write the idempotent migration SQL**

`tasks/migration-2026-08-01-nutrition-supplements.sql`:

```sql
-- Migración manual para Alimentación (nutrition_plans, meals) y Suplementación (supplements)
-- Correr en el Supabase SQL Editor de producción. Idempotente (seguro re-correr).

CREATE TABLE IF NOT EXISTS nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  daily_cals INT DEFAULT 0,
  protein_g INT DEFAULT 0,
  carbs_g INT DEFAULT 0,
  fat_g INT DEFAULT 0,
  notes TEXT,
  client_observations TEXT,
  pdf_url TEXT,
  pdf_name TEXT,
  summary TEXT,
  menu_plan JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  closing_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  meal_time TEXT NOT NULL,
  name TEXT NOT NULL,
  calories INT DEFAULT 0,
  protein_g INT DEFAULT 0,
  carbs_g INT DEFAULT 0,
  fat_g INT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  dose TEXT,
  timing TEXT,
  benefit TEXT,
  category TEXT CHECK (category IN ('Nootrópico','Adaptógeno','Sueño','Rendimiento','Base')),
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 3: Verification query (run manually after applying, not part of this repo)**

Document in the commit message or final report that the user should run, in the Supabase SQL Editor, after applying:

```sql
SELECT table_name, count(*) AS column_count
FROM information_schema.columns
WHERE table_name IN ('nutrition_plans', 'meals', 'supplements')
GROUP BY table_name;
```

Expected: `nutrition_plans` → 15, `meals` → 11, `supplements` → 12.

- [ ] **Step 4: Commit**

```bash
git add tasks/migration-2026-08-01-nutrition-supplements.sql
git commit -m "docs(nutrition-supplements): add manual production migration SQL"
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `uploadFile` helper signature in `apps/api/src/storage/index.ts` doesn't exactly match what Task 3 assumes | Medium | Task 3 Step 1 explicitly requires checking the real signature before writing the controller — don't guess |
| `onConflictDoUpdate` syntax mismatch with the Drizzle version pinned in this repo | Low | If it fails, fall back to a manual `select` + `insert`/`update` branch, same pattern as `rest-tools.service.ts`'s `uploadAudio` (select-then-branch), and note the deviation in the task's completion report |
| `client-detail-page.test.tsx` breaks because it doesn't mock the two new client libs | Medium | Task 5 Step 8 explicitly checks this and instructs updating that test's mocks if needed, following its existing `training-client` mock as the template |
| Production DB still lacks these 3 tables after this plan lands (same gap Descanso had) | High if deploy happens first | Task 7's SQL must be run in Supabase **before** `git push origin main` ships this code, exactly like the Descanso rest_tools migration — flag this explicitly in the final report |

## Open Questions

None — legacy behavior (`server.js:1443-1568`, `schema.sql:231-282`) is fully specified and this plan mirrors it exactly, changing only the underlying stack.
