# Entrenamiento — Frases (Card RR.SS) y Frases de Mentalidad: Admin CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full admin CRUD for the `phrases` table ("Frases Card RR.SS") and a brand-new `mindset_quotes` table + CRUD, per-client quote assignment, and a client-facing affirmation banner in `TrainingHome`.

**Architecture:** Two new global admin-only route families (`/api/admin/phrases`, `/api/admin/quotes`) plus two new client-scoped routes on the existing `trainingRouter` (`GET /:id/quote-of-the-day`, `PATCH /:id/assigned-quote`). Frontend gets two new thin API-client wrapper files, two new admin CRUD panel components, one new combined admin page, and small additions to two existing components (`TrainingHome`, `AdminExercisePanel`).

**Tech Stack:** Express + TypeScript (`apps/api`), Next.js App Router + React (`apps/web`), Drizzle/Postgres, Vitest (both packages, jsdom for web).

## Global Constraints

- `phrases` context values are exactly `'confirmacion' | 'instagram' | 'ambas'`. Invalid/missing context on create/update → 400, validated manually in the controller — no new Zod schema for phrase context (matches the existing read-only `GET /training/phrase` endpoint's own manual validation).
- Empty/missing `text` on phrase create, or empty/missing `quote` on quote create → 400 with the exact legacy message ("La frase no puede estar vacía.").
- All `/api/admin/phrases*` and `/api/admin/quotes*` routes are `adminOnly` — no client, including the owning client, may reach them.
- `PATCH /:id/assigned-quote` is a **dedicated, admin-only** endpoint — `assignedQuoteId` must never be settable through the generic `PUT /api/clients/:id` (already excluded from `ClientUpdateInputSchema`; do not add it there).
- `mindset_quotes.active` has no toggle button in the admin UI (`QuotesPanel`) — only `PhrasesPanel` gets an active/inactive toggle. Do not add one to `QuotesPanel`; this matches the legacy exactly.
- `getQuoteOfTheDay` returns the assigned quote **even if `active` is false** (an explicit per-client assignment overrides the active filter) — only the random-pool fallback filters by `active`.
- `getPhraseByContext`'s existing read-only behavior (from the Instagram-card sub-project) is unchanged by this plan — `listAllPhrases`/`drawPreviewPhrase` are new, separate functions for the admin surface.
- No production cutover — must not touch `server.js` or `index.html`.

---

### Task 1: Backend — `mindset_quotes` schema + admin phrases CRUD (service, controller, routes)

**Files:**
- Modify: `apps/api/src/models/schema.ts` — add `mindsetQuotes` table + `MindsetQuote` type.
- Modify: `apps/api/src/services/training.service.ts` — add `listAllPhrases`, `createPhrase`, `updatePhrase`, `deletePhrase`, `drawPreviewPhrase`.
- Create: `apps/api/src/controllers/admin-phrases.controller.ts`
- Create: `apps/api/src/routes/admin-phrases.routes.ts`
- Modify: `apps/api/src/app.ts` — mount the new router.
- Test: Create `apps/api/test/admin-phrases.routes.test.ts`

**Interfaces:**
- Consumes: `phrases`/`Phrase` from `apps/api/src/models/schema.js` (already exported); `adminOnly`, `authMiddleware` from `../middleware/auth.middleware.js`; `asyncHandler` from `../middleware/async-handler.js`.
- Produces: `listAllPhrases(): Promise<Phrase[]>`, `createPhrase(text: string, context: string): Promise<Phrase>`, `updatePhrase(id: string, patch: { text?: string; context?: string; active?: boolean }): Promise<Phrase | null>`, `deletePhrase(id: string): Promise<void>`, `drawPreviewPhrase(context: string, excludeId?: string): Promise<Phrase | null>` — all exported from `training.service.ts`. `mindsetQuotes` table + `MindsetQuote` type exported from `schema.ts` (needed by Task 2).

- [ ] **Step 1: Add the `mindset_quotes` table to the schema**

In `apps/api/src/models/schema.ts`, append after the existing `AchievementLog` type export at the end of the file:

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

- [ ] **Step 2: Write the failing tests for admin phrases CRUD**

Create `apps/api/test/admin-phrases.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, phrases } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('admin phrases routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientToken: string;
  let clientId: string;
  const createdPhraseIds: string[] = [];

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
    const [client] = await db
      .insert(clients)
      .values({ name: 'Admin Phrases Client', email: `adminphrases-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    for (const id of createdPhraseIds) {
      await db.delete(phrases).where(eq(phrases.id, id)).catch(() => {});
    }
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects a client on every admin phrases route', async () => {
    const getRes = await request(app).get('/api/admin/phrases').set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.status).toBe(403);
    const postRes = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'x', context: 'ambas' });
    expect(postRes.status).toBe(403);
  });

  it('rejects an empty text on create', async () => {
    const res = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: '', context: 'ambas' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid context on create', async () => {
    const res = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Frase válida', context: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('creates, lists (including inactive), updates, and deletes a phrase', async () => {
    const createRes = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Cada sesión cuenta', context: 'confirmacion' });
    expect(createRes.status).toBe(201);
    const phraseId = createRes.body.phrase.id;
    createdPhraseIds.push(phraseId);

    const updateRes = await request(app)
      .patch(`/api/admin/phrases/${phraseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.phrase.active).toBe(false);

    const listRes = await request(app).get('/api/admin/phrases').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.phrases.some((p: { id: string; active: boolean }) => p.id === phraseId && p.active === false)).toBe(true);

    const deleteRes = await request(app).delete(`/api/admin/phrases/${phraseId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    const afterDelete = await request(app).get('/api/admin/phrases').set('Authorization', `Bearer ${adminToken}`);
    expect(afterDelete.body.phrases.some((p: { id: string }) => p.id === phraseId)).toBe(false);
  });

  it('excludes the given id from GET /admin/phrases/random when more than one candidate is eligible', async () => {
    const [p1] = await db.insert(phrases).values({ text: 'Frase uno', context: 'instagram', active: true }).returning();
    const [p2] = await db.insert(phrases).values({ text: 'Frase dos', context: 'instagram', active: true }).returning();
    createdPhraseIds.push(p1.id, p2.id);

    const res = await request(app)
      .get(`/api/admin/phrases/random?context=instagram&exclude=${p1.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.phrase.id).toBe(p2.id);
  });

  it('returns null from GET /admin/phrases/random when there are no eligible phrases', async () => {
    const res = await request(app)
      .get('/api/admin/phrases/random?context=confirmacion')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.phrase).toBeNull();
  });
});
```

- [ ] **Step 2b: Run the tests to verify they fail**

Run: `cd apps/api && npx vitest run test/admin-phrases.routes.test.ts`
Expected: FAIL — `/api/admin/phrases` doesn't exist yet (404s).

- [ ] **Step 3: Add the service functions**

In `apps/api/src/services/training.service.ts`, add near `pickRandomPhrase` (the `phrases`/`Phrase` imports already exist at the top of this file):

```ts
export async function listAllPhrases(): Promise<Phrase[]> {
  return db.select().from(phrases);
}

export async function createPhrase(text: string, context: string): Promise<Phrase> {
  const [created] = await db.insert(phrases).values({ text, context }).returning();
  return created;
}

export async function updatePhrase(
  id: string,
  patch: { text?: string; context?: string; active?: boolean }
): Promise<Phrase | null> {
  const [updated] = await db
    .update(phrases)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(phrases.id, id))
    .returning();
  return updated ?? null;
}

export async function deletePhrase(id: string): Promise<void> {
  await db.delete(phrases).where(eq(phrases.id, id));
}

export async function drawPreviewPhrase(context: string, excludeId?: string): Promise<Phrase | null> {
  const pool = await db.select().from(phrases).where(eq(phrases.active, true));
  const eligible = pool.filter((p) => p.context === context || p.context === 'ambas');
  const candidates = excludeId && eligible.length > 1 ? eligible.filter((p) => p.id !== excludeId) : eligible;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

- [ ] **Step 4: Create the admin phrases controller**

Create `apps/api/src/controllers/admin-phrases.controller.ts`:

```ts
import type { Request, Response } from 'express';
import * as trainingService from '../services/training.service.js';

const VALID_CONTEXTS = ['confirmacion', 'instagram', 'ambas'];

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listAllPhrases(_req: Request, res: Response) {
  const phrases = await trainingService.listAllPhrases();
  return ok(res, { phrases });
}

export async function createPhrase(req: Request, res: Response) {
  const { text, context } = req.body as { text?: string; context?: string };
  if (!text || !text.trim()) return err(res, 'La frase no puede estar vacía.');
  if (!context || !VALID_CONTEXTS.includes(context)) return err(res, 'Contexto inválido.');
  const phrase = await trainingService.createPhrase(text.trim(), context);
  return ok(res, { phrase }, 201);
}

export async function updatePhrase(req: Request, res: Response) {
  const { text, context, active } = req.body as { text?: string; context?: string; active?: boolean };
  if (context !== undefined && !VALID_CONTEXTS.includes(context)) return err(res, 'Contexto inválido.');
  const patch: { text?: string; context?: string; active?: boolean } = {};
  if (text !== undefined) patch.text = text.trim();
  if (context !== undefined) patch.context = context;
  if (active !== undefined) patch.active = active;
  const phrase = await trainingService.updatePhrase(req.params.id, patch);
  if (!phrase) return err(res, 'Frase no encontrada.', 404);
  return ok(res, { phrase });
}

export async function deletePhrase(req: Request, res: Response) {
  await trainingService.deletePhrase(req.params.id);
  return ok(res, { message: 'Frase eliminada.' });
}

export async function drawPreviewPhrase(req: Request, res: Response) {
  const context = typeof req.query.context === 'string' ? req.query.context : '';
  if (!VALID_CONTEXTS.includes(context)) return err(res, 'Contexto inválido.');
  const excludeId = typeof req.query.exclude === 'string' ? req.query.exclude : undefined;
  const phrase = await trainingService.drawPreviewPhrase(context, excludeId);
  return ok(res, { phrase });
}
```

- [ ] **Step 5: Create the admin phrases routes**

Create `apps/api/src/routes/admin-phrases.routes.ts`:

```ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import * as adminPhrasesController from '../controllers/admin-phrases.controller.js';

export const adminPhrasesRouter = Router();

adminPhrasesRouter.get('/admin/phrases', authMiddleware, adminOnly, asyncHandler(adminPhrasesController.listAllPhrases));
adminPhrasesRouter.post('/admin/phrases', authMiddleware, adminOnly, asyncHandler(adminPhrasesController.createPhrase));
adminPhrasesRouter.get(
  '/admin/phrases/random',
  authMiddleware,
  adminOnly,
  asyncHandler(adminPhrasesController.drawPreviewPhrase)
);
adminPhrasesRouter.patch(
  '/admin/phrases/:id',
  authMiddleware,
  adminOnly,
  asyncHandler(adminPhrasesController.updatePhrase)
);
adminPhrasesRouter.delete(
  '/admin/phrases/:id',
  authMiddleware,
  adminOnly,
  asyncHandler(adminPhrasesController.deletePhrase)
);
```

Note: `/admin/phrases/random` is registered before `/admin/phrases/:id` so Express doesn't match `random` as an `:id` param on the wrong route — actually these are different HTTP methods (GET vs PATCH/DELETE) so there's no real conflict, but keep `random` directly under the plural `GET` route for readability.

- [ ] **Step 6: Mount the new router in `app.ts`**

In `apps/api/src/app.ts`, add the import and mount it at the root `/api` (same pattern as `geoRouter`):

```ts
import { adminPhrasesRouter } from './routes/admin-phrases.routes.js';
```

and add, alongside the other `app.use('/api', ...)` line:

```ts
app.use('/api', adminPhrasesRouter);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd apps/api && npx vitest run test/admin-phrases.routes.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/models/schema.ts apps/api/src/services/training.service.ts apps/api/src/controllers/admin-phrases.controller.ts apps/api/src/routes/admin-phrases.routes.ts apps/api/src/app.ts apps/api/test/admin-phrases.routes.test.ts
git commit -m "feat(api): add mindset_quotes table and admin CRUD for phrases"
```

---

### Task 2: Backend — `quotes.service.ts` + admin quotes CRUD (controller, routes)

**Files:**
- Create: `apps/api/src/services/quotes.service.ts`
- Create: `apps/api/src/controllers/quotes.controller.ts`
- Create: `apps/api/src/routes/admin-quotes.routes.ts`
- Modify: `apps/api/src/app.ts` — mount the new router.
- Test: Create `apps/api/test/admin-quotes.routes.test.ts`

**Interfaces:**
- Consumes: `mindsetQuotes`/`MindsetQuote` from `apps/api/src/models/schema.js` (added in Task 1); `clients`/`Client` from the same file (already exported).
- Produces: `listQuotes(): Promise<MindsetQuote[]>`, `createQuote(quote: string, author: string | null): Promise<MindsetQuote>`, `updateQuote(id: string, patch: { quote?: string; author?: string | null; active?: boolean }): Promise<MindsetQuote | null>`, `deleteQuote(id: string): Promise<void>` from `quotes.service.ts` — all consumed by Task 4's frontend wrapper. `getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null>` and `assignQuote(clientId: string, quoteId: string | null): Promise<Client | null>` are ALSO added to this same service file in this task (Task 3 wires their routes/controller handlers).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/admin-quotes.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, mindsetQuotes } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('admin quotes routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientToken: string;
  let clientId: string;
  const createdQuoteIds: string[] = [];

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
    const [client] = await db
      .insert(clients)
      .values({ name: 'Admin Quotes Client', email: `adminquotes-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    for (const id of createdQuoteIds) {
      await db.delete(mindsetQuotes).where(eq(mindsetQuotes.id, id)).catch(() => {});
    }
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects a client on every admin quotes route', async () => {
    const getRes = await request(app).get('/api/admin/quotes').set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.status).toBe(403);
    const postRes = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ quote: 'x' });
    expect(postRes.status).toBe(403);
  });

  it('rejects an empty quote on create', async () => {
    const res = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: '' });
    expect(res.status).toBe(400);
  });

  it('creates, lists, updates, and deletes a quote', async () => {
    const createRes = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: 'Estoy trabajando en mi cuerpo con amor y disciplina', author: 'La Tribu' });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.quote.id;
    createdQuoteIds.push(quoteId);
    expect(createRes.body.quote.author).toBe('La Tribu');

    const updateRes = await request(app)
      .patch(`/api/admin/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: 'Texto actualizado', active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.quote.quote).toBe('Texto actualizado');
    expect(updateRes.body.quote.active).toBe(false);

    const listRes = await request(app).get('/api/admin/quotes').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.quotes.some((q: { id: string }) => q.id === quoteId)).toBe(true);

    const deleteRes = await request(app).delete(`/api/admin/quotes/${quoteId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    const afterDelete = await request(app).get('/api/admin/quotes').set('Authorization', `Bearer ${adminToken}`);
    expect(afterDelete.body.quotes.some((q: { id: string }) => q.id === quoteId)).toBe(false);
  });

  it('allows creating a quote with no author', async () => {
    const res = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: 'Frase sin autor' });
    expect(res.status).toBe(201);
    expect(res.body.quote.author).toBeNull();
    createdQuoteIds.push(res.body.quote.id);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && npx vitest run test/admin-quotes.routes.test.ts`
Expected: FAIL — `/api/admin/quotes` doesn't exist yet.

- [ ] **Step 3: Create `quotes.service.ts`**

Create `apps/api/src/services/quotes.service.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, mindsetQuotes, type Client, type MindsetQuote } from '../models/schema.js';

export async function listQuotes(): Promise<MindsetQuote[]> {
  return db.select().from(mindsetQuotes);
}

export async function createQuote(quote: string, author: string | null): Promise<MindsetQuote> {
  const [created] = await db.insert(mindsetQuotes).values({ quote, author }).returning();
  return created;
}

export async function updateQuote(
  id: string,
  patch: { quote?: string; author?: string | null; active?: boolean }
): Promise<MindsetQuote | null> {
  const [updated] = await db
    .update(mindsetQuotes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(mindsetQuotes.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteQuote(id: string): Promise<void> {
  await db.delete(mindsetQuotes).where(eq(mindsetQuotes.id, id));
}

// Puerto de /api/clients/:id/quote-of-the-day del legacy (server.js:942-955):
// una asignación explícita gana incluso si está inactiva (active solo filtra
// el pool aleatorio de respaldo, no una asignación directa).
export async function getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const assignedId = rows[0]?.assignedQuoteId;
  if (assignedId) {
    const assigned = await db.select().from(mindsetQuotes).where(eq(mindsetQuotes.id, assignedId)).limit(1);
    if (assigned[0]) return assigned[0];
  }
  const pool = await db.select().from(mindsetQuotes).where(eq(mindsetQuotes.active, true));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function assignQuote(clientId: string, quoteId: string | null): Promise<Client | null> {
  const [client] = await db
    .update(clients)
    .set({ assignedQuoteId: quoteId, updatedAt: new Date() })
    .where(eq(clients.id, clientId))
    .returning();
  return client ?? null;
}
```

- [ ] **Step 4: Create the quotes controller**

Create `apps/api/src/controllers/quotes.controller.ts`:

```ts
import type { Request, Response } from 'express';
import * as quotesService from '../services/quotes.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listQuotes(_req: Request, res: Response) {
  const quotes = await quotesService.listQuotes();
  return ok(res, { quotes });
}

export async function createQuote(req: Request, res: Response) {
  const { quote, author } = req.body as { quote?: string; author?: string | null };
  if (!quote || !quote.trim()) return err(res, 'La frase no puede estar vacía.');
  const created = await quotesService.createQuote(quote.trim(), author || null);
  return ok(res, { quote: created }, 201);
}

export async function updateQuote(req: Request, res: Response) {
  const { quote, author, active } = req.body as { quote?: string; author?: string | null; active?: boolean };
  const patch: { quote?: string; author?: string | null; active?: boolean } = {};
  if (quote !== undefined) patch.quote = quote.trim();
  if (author !== undefined) patch.author = author;
  if (active !== undefined) patch.active = active;
  const updated = await quotesService.updateQuote(req.params.id, patch);
  if (!updated) return err(res, 'Frase no encontrada.', 404);
  return ok(res, { quote: updated });
}

export async function deleteQuote(req: Request, res: Response) {
  await quotesService.deleteQuote(req.params.id);
  return ok(res, { message: 'Frase eliminada.' });
}
```

- [ ] **Step 5: Create the admin quotes routes**

Create `apps/api/src/routes/admin-quotes.routes.ts`:

```ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import * as quotesController from '../controllers/quotes.controller.js';

export const adminQuotesRouter = Router();

adminQuotesRouter.get('/admin/quotes', authMiddleware, adminOnly, asyncHandler(quotesController.listQuotes));
adminQuotesRouter.post('/admin/quotes', authMiddleware, adminOnly, asyncHandler(quotesController.createQuote));
adminQuotesRouter.patch('/admin/quotes/:id', authMiddleware, adminOnly, asyncHandler(quotesController.updateQuote));
adminQuotesRouter.delete('/admin/quotes/:id', authMiddleware, adminOnly, asyncHandler(quotesController.deleteQuote));
```

- [ ] **Step 6: Mount the new router in `app.ts`**

In `apps/api/src/app.ts`, add the import:

```ts
import { adminQuotesRouter } from './routes/admin-quotes.routes.js';
```

and mount it alongside `adminPhrasesRouter`:

```ts
app.use('/api', adminQuotesRouter);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd apps/api && npx vitest run test/admin-quotes.routes.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/quotes.service.ts apps/api/src/controllers/quotes.controller.ts apps/api/src/routes/admin-quotes.routes.ts apps/api/src/app.ts apps/api/test/admin-quotes.routes.test.ts
git commit -m "feat(api): add mindset_quotes admin CRUD (quotes.service, controller, routes)"
```

---

### Task 3: Backend — `GET /quote-of-the-day` and `PATCH /assigned-quote` on `trainingRouter`

**Files:**
- Modify: `packages/shared-types/src/training.ts` — add `AssignedQuotePatchSchema`.
- Modify: `apps/api/src/routes/training.routes.ts` — add the two routes.
- Test: Modify `apps/api/test/training.routes.test.ts` — add a `describe('GET /quote-of-the-day and PATCH /assigned-quote', ...)` block.

**Interfaces:**
- Consumes: `getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null>` and `assignQuote(clientId: string, quoteId: string | null): Promise<Client | null>`, both already added to `apps/api/src/services/quotes.service.ts` in Task 2; `quotesController.listQuotes` etc. are NOT used here — this task imports `../controllers/quotes.controller.js` directly for two NEW handlers added in this task (`getQuoteOfTheDay`, `assignQuote`).
- Produces: `GET /api/clients/:id/quote-of-the-day` returning `{ success: true, quote: MindsetQuote | null }`; `PATCH /api/clients/:id/assigned-quote` returning `{ success: true, client: Client }`. Task 5's frontend wrapper consumes both by these exact paths.

- [ ] **Step 1: Add `AssignedQuotePatchSchema` to shared-types**

In `packages/shared-types/src/training.ts`, add after `ConfirmSessionInputSchema`:

```ts
export const AssignedQuotePatchSchema = z.object({
  quote_id: z.string().uuid().nullable(),
});
export type AssignedQuotePatch = z.infer<typeof AssignedQuotePatchSchema>;
```

Then rebuild: `cd packages/shared-types && npx tsc`.

- [ ] **Step 2: Write the failing tests**

Add `mindsetQuotes` to the existing top-of-file import from `../src/models/schema.js` in `apps/api/test/training.routes.test.ts` (it already imports `clients, trainingCompletions, trainingProtectorUses, phrases, achievementLogs` from that module — add `mindsetQuotes` to that same list). Then add, inside the existing `describe('training routes', ...)` block:

```ts
describe('GET /quote-of-the-day and PATCH /assigned-quote', () => {
  it('rejects a client using assigned-quote (admin-only)', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/assigned-quote`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ quote_id: null });
    expect(res.status).toBe(403);
  });

  it('returns null from quote-of-the-day when there is no assignment and no active pool', async () => {
    const res = await request(app)
      .get(`/api/clients/${clientId}/quote-of-the-day`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.quote).toBeNull();
  });

  it('assigns a quote and returns it from quote-of-the-day even when inactive', async () => {
    const [created] = await db.insert(mindsetQuotes).values({ quote: 'Frase asignada', active: false }).returning();

    const assignRes = await request(app)
      .patch(`/api/clients/${clientId}/assigned-quote`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote_id: created.id });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.client.assignedQuoteId).toBe(created.id);

    const qotdRes = await request(app)
      .get(`/api/clients/${clientId}/quote-of-the-day`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(qotdRes.status).toBe(200);
    expect(qotdRes.body.quote.id).toBe(created.id);

    const clearRes = await request(app)
      .patch(`/api/clients/${clientId}/assigned-quote`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote_id: null });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.client.assignedQuoteId).toBeNull();

    await db.delete(mindsetQuotes).where(eq(mindsetQuotes.id, created.id));
  });
});
```

- [ ] **Step 2b: Run the tests to verify they fail**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts -t "quote-of-the-day"`
Expected: FAIL — routes don't exist yet (404s).

- [ ] **Step 3: Add the two handlers to `quotes.controller.ts`**

In `apps/api/src/controllers/quotes.controller.ts` (from Task 2), add:

```ts
export async function getQuoteOfTheDay(req: Request, res: Response) {
  const quote = await quotesService.getQuoteOfTheDay(req.params.id);
  return ok(res, { quote });
}

export async function assignQuote(req: Request, res: Response) {
  const { quote_id } = req.body as { quote_id: string | null };
  const client = await quotesService.assignQuote(req.params.id, quote_id);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}
```

- [ ] **Step 4: Add the two routes to `training.routes.ts`**

In `apps/api/src/routes/training.routes.ts`, add the import:

```ts
import { AssignedQuotePatchSchema } from '@latribu/shared-types';
import * as quotesController from '../controllers/quotes.controller.js';
```

(add `AssignedQuotePatchSchema` to the existing `@latribu/shared-types` import line rather than a second import line for that package)

and add the routes after the existing `training/achievements` route:

```ts
trainingRouter.get(
  '/:id/quote-of-the-day',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  asyncHandler(quotesController.getQuoteOfTheDay)
);

trainingRouter.patch(
  '/:id/assigned-quote',
  authMiddleware,
  adminOnly,
  validateBody(AssignedQuotePatchSchema),
  asyncHandler(quotesController.assignQuote)
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: PASS (full file, including the new block).

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/training.ts apps/api/src/controllers/quotes.controller.ts apps/api/src/routes/training.routes.ts apps/api/test/training.routes.test.ts
git commit -m "feat(api): add GET /quote-of-the-day and PATCH /assigned-quote"
```

---

### Task 4: Frontend — `lib/phrases-client.ts` and `lib/quotes-client.ts`

**Files:**
- Create: `apps/web/lib/phrases-client.ts`
- Create: `apps/web/lib/quotes-client.ts`
- Test: Create `apps/web/test/phrases-client.test.ts`
- Test: Create `apps/web/test/quotes-client.test.ts`

**Interfaces:**
- Consumes: `getSessionToken` from `./api-client` (already used by `training-client.ts` — follow the exact same `authorizedRequest<T>` pattern, copied into each new file since it's currently a private, non-shared helper in `training-client.ts`).
- Produces:
  - From `phrases-client.ts`: `type AdminPhrase = { id: string; text: string; context: string; active: boolean }`; `listPhrases(): Promise<AdminPhrase[]>`; `createPhrase(text: string, context: string): Promise<AdminPhrase>`; `updatePhrase(id: string, patch: { text?: string; context?: string; active?: boolean }): Promise<AdminPhrase>`; `deletePhrase(id: string): Promise<void>`; `drawPreviewPhrase(context: string, excludeId?: string): Promise<AdminPhrase | null>`.
  - From `quotes-client.ts`: `type MindsetQuote = { id: string; quote: string; author: string | null; active: boolean }`; `listQuotes(): Promise<MindsetQuote[]>`; `createQuote(quote: string, author: string | null): Promise<MindsetQuote>`; `updateQuote(id: string, patch: { quote?: string; author?: string | null; active?: boolean }): Promise<MindsetQuote>`; `deleteQuote(id: string): Promise<void>`; `getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null>`; `assignQuote(clientId: string, quoteId: string | null): Promise<void>`; `getClientAssignedQuoteId(clientId: string): Promise<string | null>`.
  - Tasks 6, 7, 8, 9 all import from these two files by these exact names.

- [ ] **Step 1: Write the failing tests for `phrases-client.ts`**

Create `apps/web/test/phrases-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPhrases, createPhrase, updatePhrase, deletePhrase, drawPreviewPhrase } from '../lib/phrases-client';

describe('phrases-client (admin)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('lists phrases', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrases: [{ id: 'p1', text: 'x', context: 'ambas', active: true }] }),
    });
    const result = await listPhrases();
    expect(result).toEqual([{ id: 'p1', text: 'x', context: 'ambas', active: true }]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/phrases'), expect.objectContaining({ method: 'GET' }));
  });

  it('creates a phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: { id: 'p2', text: 'nueva', context: 'instagram', active: true } }),
    });
    const result = await createPhrase('nueva', 'instagram');
    expect(result.id).toBe('p2');
  });

  it('updates a phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: { id: 'p1', text: 'x', context: 'ambas', active: false } }),
    });
    const result = await updatePhrase('p1', { active: false });
    expect(result.active).toBe(false);
  });

  it('deletes a phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await expect(deletePhrase('p1')).resolves.toBeUndefined();
  });

  it('draws a preview phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: { id: 'p3', text: 'preview', context: 'confirmacion', active: true } }),
    });
    const result = await drawPreviewPhrase('confirmacion', 'p1');
    expect(result?.id).toBe('p3');
  });

  it('throws when the backend reports failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: false, error: 'Contexto inválido.' }) });
    await expect(createPhrase('x', 'bogus')).rejects.toThrow('Contexto inválido.');
  });
});
```

- [ ] **Step 2: Write the failing tests for `quotes-client.ts`**

Create `apps/web/test/quotes-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
  getQuoteOfTheDay,
  assignQuote,
  getClientAssignedQuoteId,
} from '../lib/quotes-client';

describe('quotes-client', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('lists quotes', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quotes: [{ id: 'q1', quote: 'x', author: null, active: true }] }),
    });
    const result = await listQuotes();
    expect(result).toEqual([{ id: 'q1', quote: 'x', author: null, active: true }]);
  });

  it('creates a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quote: { id: 'q2', quote: 'nueva', author: 'Autor', active: true } }),
    });
    const result = await createQuote('nueva', 'Autor');
    expect(result.id).toBe('q2');
  });

  it('updates a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quote: { id: 'q1', quote: 'editada', author: null, active: true } }),
    });
    const result = await updateQuote('q1', { quote: 'editada' });
    expect(result.quote).toBe('editada');
  });

  it('deletes a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await expect(deleteQuote('q1')).resolves.toBeUndefined();
  });

  it('gets the quote of the day', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, quote: { id: 'q1', quote: 'del día', author: null, active: true } }),
    });
    const result = await getQuoteOfTheDay('client-1');
    expect(result?.quote).toBe('del día');
  });

  it('returns null when there is no quote of the day', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true, quote: null }) });
    const result = await getQuoteOfTheDay('client-1');
    expect(result).toBeNull();
  });

  it('assigns a quote', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, client: { id: 'client-1', assignedQuoteId: 'q1' } }),
    });
    await expect(assignQuote('client-1', 'q1')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/clients/client-1/assigned-quote'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quote_id: 'q1' }) })
    );
  });

  it('gets the assigned quote id for a client', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, client: { assignedQuoteId: 'q9' } }),
    });
    const result = await getClientAssignedQuoteId('client-1');
    expect(result).toBe('q9');
  });

  it('throws when the backend reports failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: false, error: 'La frase no puede estar vacía.' }) });
    await expect(createQuote('', null)).rejects.toThrow('La frase no puede estar vacía.');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/phrases-client.test.ts test/quotes-client.test.ts`
Expected: FAIL — neither module exists yet.

- [ ] **Step 4: Implement `phrases-client.ts`**

Create `apps/web/lib/phrases-client.ts`:

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

export type AdminPhrase = {
  id: string;
  text: string;
  context: string;
  active: boolean;
};

export async function listPhrases(): Promise<AdminPhrase[]> {
  const body = await authorizedRequest<{ success: boolean; phrases: AdminPhrase[]; error?: string }>('/api/admin/phrases', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las frases.');
  return body.phrases;
}

export async function createPhrase(text: string, context: string): Promise<AdminPhrase> {
  const body = await authorizedRequest<{ success: boolean; phrase: AdminPhrase; error?: string }>('/api/admin/phrases', 'POST', {
    text,
    context,
  });
  if (!body.success) throw new Error(body.error || 'Error al crear la frase.');
  return body.phrase;
}

export async function updatePhrase(
  id: string,
  patch: { text?: string; context?: string; active?: boolean }
): Promise<AdminPhrase> {
  const body = await authorizedRequest<{ success: boolean; phrase: AdminPhrase; error?: string }>(
    `/api/admin/phrases/${id}`,
    'PATCH',
    patch
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar la frase.');
  return body.phrase;
}

export async function deletePhrase(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/phrases/${id}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la frase.');
}

export async function drawPreviewPhrase(context: string, excludeId?: string): Promise<AdminPhrase | null> {
  const qs = new URLSearchParams({ context });
  if (excludeId) qs.set('exclude', excludeId);
  const body = await authorizedRequest<{ success: boolean; phrase: AdminPhrase | null; error?: string }>(
    `/api/admin/phrases/random?${qs.toString()}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al sortear la frase.');
  return body.phrase;
}
```

- [ ] **Step 5: Implement `quotes-client.ts`**

Create `apps/web/lib/quotes-client.ts`:

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

export type MindsetQuote = {
  id: string;
  quote: string;
  author: string | null;
  active: boolean;
};

export async function listQuotes(): Promise<MindsetQuote[]> {
  const body = await authorizedRequest<{ success: boolean; quotes: MindsetQuote[]; error?: string }>('/api/admin/quotes', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las frases.');
  return body.quotes;
}

export async function createQuote(quote: string, author: string | null): Promise<MindsetQuote> {
  const body = await authorizedRequest<{ success: boolean; quote: MindsetQuote; error?: string }>('/api/admin/quotes', 'POST', {
    quote,
    author,
  });
  if (!body.success) throw new Error(body.error || 'Error al crear la frase.');
  return body.quote;
}

export async function updateQuote(
  id: string,
  patch: { quote?: string; author?: string | null; active?: boolean }
): Promise<MindsetQuote> {
  const body = await authorizedRequest<{ success: boolean; quote: MindsetQuote; error?: string }>(
    `/api/admin/quotes/${id}`,
    'PATCH',
    patch
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar la frase.');
  return body.quote;
}

export async function deleteQuote(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/quotes/${id}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la frase.');
}

export async function getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null> {
  const body = await authorizedRequest<{ success: boolean; quote: MindsetQuote | null; error?: string }>(
    `/api/clients/${clientId}/quote-of-the-day`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener la frase del día.');
  return body.quote;
}

export async function assignQuote(clientId: string, quoteId: string | null): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/assigned-quote`, 'PATCH', {
    quote_id: quoteId,
  });
  if (!body.success) throw new Error(body.error || 'Error al asignar la frase.');
}

export async function getClientAssignedQuoteId(clientId: string): Promise<string | null> {
  const body = await authorizedRequest<{ success: boolean; client: { assignedQuoteId: string | null }; error?: string }>(
    `/api/clients/${clientId}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener el cliente.');
  return body.client.assignedQuoteId;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/phrases-client.test.ts test/quotes-client.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/phrases-client.ts apps/web/lib/quotes-client.ts apps/web/test/phrases-client.test.ts apps/web/test/quotes-client.test.ts
git commit -m "feat(web): add phrases-client and quotes-client API wrappers"
```

---

### Task 5: Frontend — `PhrasesPanel.tsx`

**Files:**
- Create: `apps/web/components/admin/PhrasesPanel.tsx`
- Test: Create `apps/web/test/phrases-panel.test.tsx`

**Interfaces:**
- Consumes: `listPhrases`, `createPhrase`, `updatePhrase`, `deletePhrase`, `drawPreviewPhrase`, `type AdminPhrase` from `apps/web/lib/phrases-client.ts` (Task 4).
- Produces: `PhrasesPanel` component, no props (self-contained, fetches on mount). Consumed by Task 8's combined admin page.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/phrases-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhrasesPanel } from '../components/admin/PhrasesPanel';
import * as phrasesClient from '../lib/phrases-client';

const samplePhrases = [
  { id: 'p1', text: 'Frase de confirmación', context: 'confirmacion', active: true },
  { id: 'p2', text: 'Frase de instagram', context: 'instagram', active: false },
];

describe('PhrasesPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(phrasesClient, 'listPhrases').mockResolvedValue(samplePhrases);
  });

  it('renders the fetched phrases', async () => {
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());
    expect(screen.getByText('Frase de instagram')).toBeInTheDocument();
  });

  it('creates a phrase and refetches the list', async () => {
    const createSpy = vi.spyOn(phrasesClient, 'createPhrase').mockResolvedValue({
      id: 'p3',
      text: 'Nueva frase',
      context: 'ambas',
      active: true,
    });
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nueva frase'), { target: { value: 'Nueva frase' } });
    fireEvent.change(screen.getByLabelText('Contexto'), { target: { value: 'ambas' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar frase' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledWith('Nueva frase', 'ambas'));
  });

  it('toggles a phrase active state', async () => {
    const updateSpy = vi.spyOn(phrasesClient, 'updatePhrase').mockResolvedValue({ ...samplePhrases[0], active: false });
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '● Activa' }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('p1', { active: false }));
  });

  it('deletes a phrase', async () => {
    const deleteSpy = vi.spyOn(phrasesClient, 'deletePhrase').mockResolvedValue(undefined);
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('p1'));
  });

  it('filters the list by context', async () => {
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    expect(screen.queryByText('Frase de confirmación')).not.toBeInTheDocument();
    expect(screen.getByText('Frase de instagram')).toBeInTheDocument();
  });

  it('blocks creating a phrase with empty text', async () => {
    const createSpy = vi.spyOn(phrasesClient, 'createPhrase');
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar frase' }));
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('draws a preview phrase for a context', async () => {
    const previewSpy = vi
      .spyOn(phrasesClient, 'drawPreviewPhrase')
      .mockResolvedValue({ id: 'p9', text: 'Frase de prueba', context: 'confirmacion', active: true });
    render(<PhrasesPanel />);
    await waitFor(() => expect(screen.getByText('Frase de confirmación')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: '🔀 Probar otra' })[0]);
    await waitFor(() => expect(previewSpy).toHaveBeenCalledWith('confirmacion', undefined));
    await waitFor(() => expect(screen.getByText('Frase de prueba')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/phrases-panel.test.tsx`
Expected: FAIL — `../components/admin/PhrasesPanel` doesn't exist yet.

- [ ] **Step 3: Implement `PhrasesPanel.tsx`**

Create `apps/web/components/admin/PhrasesPanel.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  type AdminPhrase,
  listPhrases,
  createPhrase,
  updatePhrase,
  deletePhrase,
  drawPreviewPhrase,
} from '../../lib/phrases-client';

const CONTEXT_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'confirmacion', label: 'Confirmación' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'ambas', label: 'Ambas' },
];

export function PhrasesPanel() {
  const [phrases, setPhrases] = useState<AdminPhrase[]>([]);
  const [filter, setFilter] = useState('all');
  const [newText, setNewText] = useState('');
  const [newContext, setNewContext] = useState('confirmacion');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editContext, setEditContext] = useState('confirmacion');
  const [preview, setPreview] = useState<Record<string, AdminPhrase | null>>({});
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const list = await listPhrases();
    setPhrases(list);
  }, []);

  useEffect(() => {
    refetch().catch((e: Error) => setError(e.message));
  }, [refetch]);

  async function handleCreate() {
    if (!newText.trim()) return;
    try {
      await createPhrase(newText.trim(), newContext);
      setNewText('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleToggleActive(phrase: AdminPhrase) {
    try {
      await updatePhrase(phrase.id, { active: !phrase.active });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(phrase: AdminPhrase) {
    setEditingId(phrase.id);
    setEditText(phrase.text);
    setEditContext(phrase.context);
  }

  async function handleSaveEdit(id: string) {
    try {
      await updatePhrase(id, { text: editText, context: editContext });
      setEditingId(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePhrase(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handlePreview(context: 'confirmacion' | 'instagram') {
    try {
      const current = preview[context];
      const drawn = await drawPreviewPhrase(context, current?.id);
      setPreview((prev) => ({ ...prev, [context]: drawn }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const list = filter === 'all' ? phrases : phrases.filter((p) => p.context === filter);

  return (
    <section>
      <h2>Frases Card RR.SS</h2>
      {error && <p role="alert">{error}</p>}

      <div>
        {CONTEXT_FILTERS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="ph-new-text">Nueva frase</label>
      <textarea id="ph-new-text" value={newText} onChange={(e) => setNewText(e.target.value)} />
      <label htmlFor="ph-new-context">Contexto</label>
      <select id="ph-new-context" value={newContext} onChange={(e) => setNewContext(e.target.value)}>
        <option value="confirmacion">Confirmación</option>
        <option value="instagram">Instagram</option>
        <option value="ambas">Ambas</option>
      </select>
      <button type="button" onClick={handleCreate}>
        + Agregar frase
      </button>

      {list.length === 0 && <p>No hay frases para este filtro.</p>}
      {list.map((phrase) =>
        editingId === phrase.id ? (
          <div key={phrase.id}>
            <label htmlFor={`ph-edit-text-${phrase.id}`}>Frase</label>
            <textarea id={`ph-edit-text-${phrase.id}`} value={editText} onChange={(e) => setEditText(e.target.value)} />
            <label htmlFor={`ph-edit-context-${phrase.id}`}>Contexto</label>
            <select id={`ph-edit-context-${phrase.id}`} value={editContext} onChange={(e) => setEditContext(e.target.value)}>
              <option value="confirmacion">Confirmación</option>
              <option value="instagram">Instagram</option>
              <option value="ambas">Ambas</option>
            </select>
            <button type="button" onClick={() => handleSaveEdit(phrase.id)}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div key={phrase.id}>
            <p>{phrase.text}</p>
            <span>{phrase.context}</span>
            <button type="button" onClick={() => handleToggleActive(phrase)}>
              {phrase.active ? '● Activa' : '○ Inactiva'}
            </button>
            <button type="button" onClick={() => startEdit(phrase)}>
              Editar
            </button>
            <button type="button" onClick={() => handleDelete(phrase.id)}>
              Eliminar
            </button>
          </div>
        )
      )}

      <div>
        <div>
          <h3>Pantalla de confirmación</h3>
          <p>{preview.confirmacion ? preview.confirmacion.text : 'No hay frases activas para este contexto.'}</p>
          <button type="button" onClick={() => handlePreview('confirmacion')}>
            🔀 Probar otra
          </button>
        </div>
        <div>
          <h3>Tarjeta de Instagram</h3>
          <p>{preview.instagram ? preview.instagram.text : 'No hay frases activas para este contexto.'}</p>
          <button type="button" onClick={() => handlePreview('instagram')}>
            🔀 Probar otra
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/phrases-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/PhrasesPanel.tsx apps/web/test/phrases-panel.test.tsx
git commit -m "feat(web): add PhrasesPanel admin CRUD component"
```

---

### Task 6: Frontend — `QuotesPanel.tsx`

**Files:**
- Create: `apps/web/components/admin/QuotesPanel.tsx`
- Test: Create `apps/web/test/quotes-panel.test.tsx`

**Interfaces:**
- Consumes: `listQuotes`, `createQuote`, `updateQuote`, `deleteQuote`, `type MindsetQuote` from `apps/web/lib/quotes-client.ts` (Task 4).
- Produces: `QuotesPanel` component, no props. Consumed by Task 8's combined admin page.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/quotes-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuotesPanel } from '../components/admin/QuotesPanel';
import * as quotesClient from '../lib/quotes-client';

const sampleQuotes = [
  { id: 'q1', quote: 'Estoy en mi mejor momento', author: 'La Tribu', active: true },
  { id: 'q2', quote: 'Sin autor', author: null, active: true },
];

describe('QuotesPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(quotesClient, 'listQuotes').mockResolvedValue(sampleQuotes);
  });

  it('renders the fetched quotes, with and without an author', async () => {
    render(<QuotesPanel />);
    await waitFor(() => expect(screen.getByText('Estoy en mi mejor momento')).toBeInTheDocument());
    expect(screen.getByText('— La Tribu')).toBeInTheDocument();
    expect(screen.getByText('Sin autor')).toBeInTheDocument();
  });

  it('creates a quote and refetches the list', async () => {
    const createSpy = vi.spyOn(quotesClient, 'createQuote').mockResolvedValue({
      id: 'q3',
      quote: 'Nueva quote',
      author: null,
      active: true,
    });
    render(<QuotesPanel />);
    await waitFor(() => expect(screen.getByText('Estoy en mi mejor momento')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Frase'), { target: { value: 'Nueva quote' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledWith('Nueva quote', null));
  });

  it('blocks creating a quote with empty text', async () => {
    const createSpy = vi.spyOn(quotesClient, 'createQuote');
    render(<QuotesPanel />);
    await waitFor(() => expect(screen.getByText('Estoy en mi mejor momento')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('deletes a quote', async () => {
    const deleteSpy = vi.spyOn(quotesClient, 'deleteQuote').mockResolvedValue(undefined);
    render(<QuotesPanel />);
    await waitFor(() => expect(screen.getByText('Estoy en mi mejor momento')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('q1'));
  });

  it('edits a quote', async () => {
    const updateSpy = vi.spyOn(quotesClient, 'updateQuote').mockResolvedValue({ ...sampleQuotes[0], quote: 'Editada' });
    render(<QuotesPanel />);
    await waitFor(() => expect(screen.getByText('Estoy en mi mejor momento')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.change(screen.getByLabelText('Frase'), { target: { value: 'Editada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('q1', { quote: 'Editada', author: 'La Tribu' }));
  });

  it('does not render an active/inactive toggle button', async () => {
    render(<QuotesPanel />);
    await waitFor(() => expect(screen.getByText('Estoy en mi mejor momento')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Activa|Inactiva/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/quotes-panel.test.tsx`
Expected: FAIL — `../components/admin/QuotesPanel` doesn't exist yet.

- [ ] **Step 3: Implement `QuotesPanel.tsx`**

Create `apps/web/components/admin/QuotesPanel.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { type MindsetQuote, listQuotes, createQuote, updateQuote, deleteQuote } from '../../lib/quotes-client';

export function QuotesPanel() {
  const [quotes, setQuotes] = useState<MindsetQuote[]>([]);
  const [newQuote, setNewQuote] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuote, setEditQuote] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const list = await listQuotes();
    setQuotes(list);
  }, []);

  useEffect(() => {
    refetch().catch((e: Error) => setError(e.message));
  }, [refetch]);

  async function handleCreate() {
    if (!newQuote.trim()) return;
    try {
      await createQuote(newQuote.trim(), newAuthor.trim() || null);
      setNewQuote('');
      setNewAuthor('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(quote: MindsetQuote) {
    setEditingId(quote.id);
    setEditQuote(quote.quote);
    setEditAuthor(quote.author || '');
  }

  async function handleSaveEdit(id: string) {
    try {
      await updateQuote(id, { quote: editQuote, author: editAuthor.trim() || null });
      setEditingId(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteQuote(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h2>Frases de mentalidad</h2>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="qt-new-quote">Frase</label>
      <textarea id="qt-new-quote" value={newQuote} onChange={(e) => setNewQuote(e.target.value)} />
      <label htmlFor="qt-new-author">Autor (opcional)</label>
      <input id="qt-new-author" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} />
      <button type="button" onClick={handleCreate}>
        Agregar
      </button>

      {quotes.length === 0 && <p>Aún no hay frases en la biblioteca.</p>}
      {quotes.map((quote) =>
        editingId === quote.id ? (
          <div key={quote.id}>
            <label htmlFor={`qt-edit-quote-${quote.id}`}>Frase</label>
            <textarea id={`qt-edit-quote-${quote.id}`} value={editQuote} onChange={(e) => setEditQuote(e.target.value)} />
            <label htmlFor={`qt-edit-author-${quote.id}`}>Autor (opcional)</label>
            <input id={`qt-edit-author-${quote.id}`} value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
            <button type="button" onClick={() => handleSaveEdit(quote.id)}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div key={quote.id}>
            <p>{quote.quote}</p>
            {quote.author && <div>— {quote.author}</div>}
            <button type="button" onClick={() => startEdit(quote)}>
              Editar
            </button>
            <button type="button" onClick={() => handleDelete(quote.id)}>
              Eliminar
            </button>
          </div>
        )
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/quotes-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/QuotesPanel.tsx apps/web/test/quotes-panel.test.tsx
git commit -m "feat(web): add QuotesPanel admin CRUD component"
```

---

### Task 7: Frontend — `app/admin/phrases/page.tsx`

**Files:**
- Create: `apps/web/app/admin/phrases/page.tsx`
- Test: Create `apps/web/test/admin-phrases-page.test.tsx`

**Interfaces:**
- Consumes: `PhrasesPanel` (Task 5), `QuotesPanel` (Task 6).
- Produces: the `/admin/phrases` route. Nothing downstream depends on this page's own exports (leaf page).

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/admin-phrases-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminPhrasesPage from '../app/admin/phrases/page';
import * as phrasesClient from '../lib/phrases-client';
import * as quotesClient from '../lib/quotes-client';

describe('AdminPhrasesPage', () => {
  it('renders both panels', async () => {
    vi.spyOn(phrasesClient, 'listPhrases').mockResolvedValue([]);
    vi.spyOn(quotesClient, 'listQuotes').mockResolvedValue([]);

    render(<AdminPhrasesPage />);

    expect(await screen.findByText('Frases Card RR.SS')).toBeInTheDocument();
    expect(screen.getByText('Frases de mentalidad')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run test/admin-phrases-page.test.tsx`
Expected: FAIL — `../app/admin/phrases/page` doesn't exist yet.

- [ ] **Step 3: Implement the page**

Create `apps/web/app/admin/phrases/page.tsx`:

```tsx
'use client';

import { PhrasesPanel } from '../../../components/admin/PhrasesPanel';
import { QuotesPanel } from '../../../components/admin/QuotesPanel';

export default function AdminPhrasesPage() {
  return (
    <div>
      <h1>Frases</h1>
      <QuotesPanel />
      <PhrasesPanel />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run test/admin-phrases-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/phrases/page.tsx apps/web/test/admin-phrases-page.test.tsx
git commit -m "feat(web): add combined /admin/phrases page"
```

---

### Task 8: Frontend — affirmation banner in `TrainingHome` + wiring in `TrainingShell`

**Files:**
- Modify: `apps/web/components/training/TrainingHome.tsx`
- Modify: `apps/web/components/training/TrainingShell.tsx`
- Test: Modify `apps/web/test/training-home.test.tsx`
- Test: Modify `apps/web/test/training-shell.test.tsx`

**Interfaces:**
- Consumes: `getQuoteOfTheDay(clientId: string): Promise<MindsetQuote | null>` and `type MindsetQuote` from `apps/web/lib/quotes-client.ts` (Task 4).
- Produces: `TrainingHome` gains a new prop `quote: MindsetQuote | null`.

- [ ] **Step 1: Write the failing test for `TrainingHome`**

Read the existing `apps/web/test/training-home.test.tsx` first for its exact render-call conventions, then add (and update every existing render call to also pass `quote={null}`, since it's a new required prop):

```tsx
it('renders the affirmation banner when a quote is present', () => {
  render(
    <TrainingHome
      trainingDays={2}
      exercises={[]}
      completions={[]}
      streak={null}
      quote={{ id: 'q1', quote: 'Estoy en mi mejor momento', author: 'La Tribu', active: true }}
      onOpenDay={vi.fn()}
      onUseProtector={vi.fn()}
      protectorPending={false}
    />
  );
  expect(screen.getByText(/Estoy en mi mejor momento/)).toBeInTheDocument();
  expect(screen.getByText(/La Tribu/)).toBeInTheDocument();
});

it('renders no banner when quote is null', () => {
  render(
    <TrainingHome
      trainingDays={2}
      exercises={[]}
      completions={[]}
      streak={null}
      quote={null}
      onOpenDay={vi.fn()}
      onUseProtector={vi.fn()}
      protectorPending={false}
    />
  );
  expect(screen.queryByText(/repite después de mí/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run test/training-home.test.tsx`
Expected: FAIL — `quote` prop doesn't exist yet / TypeScript error.

- [ ] **Step 3: Add the `quote` prop and banner to `TrainingHome.tsx`**

In `apps/web/components/training/TrainingHome.tsx`, add `MindsetQuote` to the imports and `quote` to the props type:

```tsx
import type { MindsetQuote } from '../../lib/quotes-client';
```

```tsx
export type TrainingHomeProps = {
  trainingDays: number;
  exercises: Exercise[];
  completions: TrainingCompletion[];
  streak: TrainingStreak | null;
  quote: MindsetQuote | null;
  onOpenDay: (day: number) => void;
  onUseProtector: () => void;
  protectorPending: boolean;
};
```

Update the function signature to destructure `quote`, and add the banner right after the opening `<h1>Entrenamiento</h1>`:

```tsx
export function TrainingHome({
  trainingDays,
  exercises,
  completions,
  streak,
  quote,
  onOpenDay,
  onUseProtector,
  protectorPending,
}: TrainingHomeProps) {
  // ...unchanged existing body...

  return (
    <div>
      <h1>Entrenamiento</h1>

      {quote && (
        <div>
          <p>repite después de mí: &quot;{quote.quote}&quot;</p>
          {quote.author && <p>— {quote.author}</p>}
        </div>
      )}

      {/* ...rest of the existing JSX, unchanged... */}
```

- [ ] **Step 4: Update every OTHER existing call site of `<TrainingHome`**

Grep the whole repo for `<TrainingHome` (not just this file) — there should be exactly one production call site (`TrainingShell.tsx`, updated in Step 5 below) plus test call sites in `training-home.test.tsx` (already updated in Step 1). Confirm there is no third call site.

- [ ] **Step 5: Write the failing test for `TrainingShell`**

`apps/web/test/training-shell.test.tsx` already uses `vi.mock('../lib/training-client')` (auto-mock) + `vi.mocked(trainingClient.fn).mockResolvedValue(...)` in its `beforeEach` — read the file first, then add a matching `vi.mock('../lib/quotes-client')` call alongside the existing one, and a default `vi.mocked(quotesClient.getQuoteOfTheDay).mockResolvedValue(null)` in the shared `beforeEach` (so every pre-existing test in this file keeps passing once `TrainingShell` starts calling this function). Then add:

```tsx
import * as quotesClient from '../lib/quotes-client';

vi.mock('../lib/quotes-client');
```

```tsx
it('fetches the quote of the day and passes it to TrainingHome, non-fatally on failure', async () => {
  vi.mocked(quotesClient.getQuoteOfTheDay).mockRejectedValueOnce(new Error('network'));
  // render TrainingShell here following this file's existing render/setup pattern
  // assert the page still renders TrainingHome content (e.g. "Entrenamiento")
  // without an alert/error being shown
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run test/training-shell.test.tsx`
Expected: FAIL — `getQuoteOfTheDay` is not called by `TrainingShell` yet.

- [ ] **Step 7: Wire `getQuoteOfTheDay` into `TrainingShell.tsx`**

In `apps/web/components/training/TrainingShell.tsx`:

Add the import:

```tsx
import { getQuoteOfTheDay, type MindsetQuote } from '../../lib/quotes-client';
```

Add state:

```tsx
const [quote, setQuote] = useState<MindsetQuote | null>(null);
```

In `load()`, add `getQuoteOfTheDay(clientId).catch(() => null)` to the existing `Promise.all` array and destructure/set it:

```tsx
const load = useCallback(async () => {
  const tz = clientTz();
  const [days, exerciseList, completionList, streakState, quoteOfTheDay] = await Promise.all([
    getClientTrainingDays(clientId),
    listExercises(clientId),
    listTrainingCompletions(clientId),
    getStreak(clientId, tz),
    getQuoteOfTheDay(clientId).catch(() => null),
  ]);
  setTrainingDays(days);
  setExercises(exerciseList);
  setCompletions(completionList);
  setStreak(streakState);
  setQuote(quoteOfTheDay);
}, [clientId]);
```

Pass `quote` to the `<TrainingHome>` render call at the bottom of the component:

```tsx
<TrainingHome
  trainingDays={trainingDays}
  exercises={exercises}
  completions={completions}
  streak={streak}
  quote={quote}
  onOpenDay={openDay}
  onUseProtector={handleUseProtector}
  protectorPending={protectorPending}
/>
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/training-home.test.tsx test/training-shell.test.tsx`
Expected: PASS.

- [ ] **Step 9: Run the full web suite to catch any missed `<TrainingHome` call site**

Run: `cd apps/web && npx vitest run`
Expected: PASS — a missed call site would surface as a TypeScript compile error across the suite.

- [ ] **Step 10: Commit**

```bash
git add apps/web/components/training/TrainingHome.tsx apps/web/components/training/TrainingShell.tsx apps/web/test/training-home.test.tsx apps/web/test/training-shell.test.tsx
git commit -m "feat(web): show the mindset-quote affirmation banner in TrainingHome"
```

---

### Task 9: Frontend — "Frase asignada" select in `AdminExercisePanel`

**Files:**
- Modify: `apps/web/components/training/AdminExercisePanel.tsx`
- Test: Modify `apps/web/test/exercise-form.test.tsx` — NO, this file tests `ExerciseForm`, not `AdminExercisePanel`; check whether an `admin-exercise-panel.test.tsx` file already exists (search the repo) and extend it — if none exists, create `apps/web/test/admin-exercise-panel.test.tsx`.

**Interfaces:**
- Consumes: `listQuotes`, `getClientAssignedQuoteId`, `assignQuote`, `type MindsetQuote` from `apps/web/lib/quotes-client.ts` (Task 4).
- Produces: nothing new downstream — this is the final integration point.

- [ ] **Step 1: Read the existing test file's conventions first**

`apps/web/test/admin-exercise-panel.test.tsx` already exists. Read it before writing anything — it uses `vi.mock('../lib/training-client')` (auto-mock) + `vi.mocked(trainingClient.fn).mockResolvedValue(...)` in a shared `beforeEach`, NOT `vi.spyOn`. Your new tests must follow this exact same style for `quotes-client` (add a second `vi.mock('../lib/quotes-client')` call and set its default mocks in the same `beforeEach`), not introduce `vi.spyOn` as a second, inconsistent mocking style in this file.

- [ ] **Step 2: Write the failing tests**

Add a new `vi.mock('../lib/quotes-client')` call alongside the existing `vi.mock('../lib/training-client')` at the top of the file, add default mocks for `listQuotes`/`getClientAssignedQuoteId` to the existing shared `beforeEach` (so every pre-existing test in this file keeps passing), then add a new `describe` block:

```tsx
import * as quotesClient from '../lib/quotes-client';

vi.mock('../lib/quotes-client');
```

In the existing `beforeEach`, add:

```tsx
vi.mocked(quotesClient.listQuotes).mockResolvedValue([
  { id: 'q1', quote: 'Frase corta', author: null, active: true },
  {
    id: 'q2',
    quote: 'Una frase muy larga que definitivamente supera los sesenta caracteres de límite visual',
    author: null,
    active: true,
  },
]);
vi.mocked(quotesClient.getClientAssignedQuoteId).mockResolvedValue(null);
```

New `describe` block:

```tsx
describe('AdminExercisePanel — Frase asignada', () => {
  it('renders the assigned-quote select with a random option and truncated long options', async () => {
    render(<AdminExercisePanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByLabelText('Frase asignada a este cliente')).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Aleatoria del pool general' })).toBeInTheDocument();
    expect(screen.getByText(/Una frase muy larga.*…/)).toBeInTheDocument();
  });

  it("pre-selects the client's currently assigned quote", async () => {
    vi.mocked(quotesClient.getClientAssignedQuoteId).mockResolvedValue('q1');
    render(<AdminExercisePanel clientId="client-1" />);
    const select = (await screen.findByLabelText('Frase asignada a este cliente')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('q1'));
  });

  it('calls assignQuote with the selected quote id', async () => {
    vi.mocked(quotesClient.assignQuote).mockResolvedValue(undefined);
    render(<AdminExercisePanel clientId="client-1" />);
    const select = await screen.findByLabelText('Frase asignada a este cliente');
    fireEvent.change(select, { target: { value: 'q1' } });
    await waitFor(() => expect(quotesClient.assignQuote).toHaveBeenCalledWith('client-1', 'q1'));
  });

  it('calls assignQuote with null when "Aleatoria del pool general" is selected', async () => {
    vi.mocked(quotesClient.getClientAssignedQuoteId).mockResolvedValue('q1');
    vi.mocked(quotesClient.assignQuote).mockResolvedValue(undefined);
    render(<AdminExercisePanel clientId="client-1" />);
    const select = await screen.findByLabelText('Frase asignada a este cliente');
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('q1'));
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(quotesClient.assignQuote).toHaveBeenCalledWith('client-1', null));
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/admin-exercise-panel.test.tsx`
Expected: FAIL — no "Frase asignada a este cliente" label exists yet.

- [ ] **Step 4: Add the select to `AdminExercisePanel.tsx`**

In `apps/web/components/training/AdminExercisePanel.tsx`, add the import:

```tsx
import { type MindsetQuote, listQuotes, getClientAssignedQuoteId, assignQuote } from '../../lib/quotes-client';
```

Add state:

```tsx
const [quotes, setQuotes] = useState<MindsetQuote[]>([]);
const [assignedQuoteId, setAssignedQuoteId] = useState<string | null>(null);
```

Extend `refetch` to also load quotes and the current assignment:

```tsx
const refetch = useCallback(async () => {
  const [days, list, quoteList, assignedId] = await Promise.all([
    getClientTrainingDays(clientId),
    listExercises(clientId),
    listQuotes(),
    getClientAssignedQuoteId(clientId),
  ]);
  setTrainingDays(days);
  setExercises(list);
  setQuotes(quoteList);
  setAssignedQuoteId(assignedId);
}, [clientId]);
```

Add the handler:

```tsx
async function handleAssignedQuoteChange(quoteId: string) {
  const value = quoteId || null;
  try {
    await assignQuote(clientId, value);
    setAssignedQuoteId(value);
  } catch (e) {
    setError((e as Error).message);
  }
}
```

Add the select in the JSX, right after the existing "Días de entrenamiento" `<select>`:

```tsx
<label htmlFor="assigned-quote">Frase asignada a este cliente</label>
<select id="assigned-quote" value={assignedQuoteId ?? ''} onChange={(e) => handleAssignedQuoteChange(e.target.value)}>
  <option value="">Aleatoria del pool general</option>
  {quotes.map((q) => (
    <option key={q.id} value={q.id}>
      {q.quote.length > 60 ? `${q.quote.slice(0, 60)}…` : q.quote}
    </option>
  ))}
</select>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/admin-exercise-panel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full web suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS — confirms `AdminExercisePanel`'s existing consumers (`admin/clients/[id]/page.tsx`) still work with the added state/fetches.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/training/AdminExercisePanel.tsx apps/web/test/admin-exercise-panel.test.tsx
git commit -m "feat(web): assign a mindset quote per client from AdminExercisePanel"
```

---

## Self-Review Notes

- **Spec coverage:** admin phrases CRUD (Task 1), `mindset_quotes` table + admin CRUD (Tasks 1-2), quote-of-the-day + assigned-quote endpoints (Task 3), frontend wrappers (Task 4), `PhrasesPanel`/`QuotesPanel` (Tasks 5-6), combined admin page (Task 7), client-facing banner (Task 8), per-client assignment UI (Task 9) — every section of the spec maps to at least one task.
- **Scope decisions honored:** no active/inactive toggle button in `QuotesPanel` (Task 6 explicitly tests its absence); no Zod schema for phrase `context` validation (Tasks 1/3 use manual validation, matching the existing `GET /training/phrase` precedent); `assigned-quote` is a dedicated admin-only endpoint, never added to `ClientUpdateInputSchema`.
- **Type consistency check:** `AdminPhrase`/`MindsetQuote` shapes are defined once (Task 4) and reused verbatim by every later task (5, 6, 8, 9) — no renamed fields across tasks. `updatePhrase`/`updateQuote` patch shapes match between service (Tasks 1-2), controller (Tasks 1-2), and client wrapper (Task 4).
- **Out of scope, confirmed absent from this plan:** Rest tools (sub-project #5), shared admin nav/layout (this page is reached by direct URL, matching `/training`'s existing pattern), production cutover.
