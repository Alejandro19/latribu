# Descanso — Herramientas para Dormir (Rest Tools) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy's global (not per-client) "Herramientas para dormir" bank: admin CRUD with audio upload, and a client-facing experience with a countdown timer, an inline audio player, or an ephemeral journal, depending on the tool's type.

**Architecture:** A new `rest_tools` table with a service/controller/routes layer mirroring the existing `phrases`/`mindset_quotes` admin-CRUD pattern, plus a new `deleteFile` helper in the existing storage module for audio cleanup. Two new, independent frontend pages: `/admin/rest-tools` (global admin CRUD, no client selector since this isn't a per-client resource) and `/rest` (client-facing tool list + interactions).

**Tech Stack:** Express + TypeScript (`apps/api`), Next.js App Router + React (`apps/web`), Drizzle/Postgres, Supabase Storage, Vitest (both packages, jsdom for web).

## Global Constraints

- `rest_tools` is a **global bank, not scoped to any client** — no `clientId` column, no `:id` client param on any route.
- `GET /api/rest-tools` requires only `authMiddleware` (any authenticated client) — no `ownerOrAdmin`, no `requirePermission`. Descanso is self-service, open to all 3 client types (unlike Entrenamiento).
- Auto-seed: the first time `GET /api/rest-tools` (or `GET /api/admin/rest-tools`, via the same service function) finds an empty table, it inserts exactly these 3 rows (verbatim from the legacy, `server.js:1091-1095`), then re-queries:
  ```
  { name: 'Sonidos para dormir', meta: 'Ruido blanco + respiración guiada · 20 min', action: 'play', minutes: 20, seconds: null }
  { name: 'NSDR · Descanso profundo sin dormir', meta: '10 min · para siestas o resets a media tarde', action: 'play', minutes: 10, seconds: null }
  { name: 'Diario de descarga mental', meta: 'Escribe lo que ronda tu cabeza antes de apagar la luz', action: 'write', minutes: null, seconds: null }
  ```
- The ephemeral "write" journal on the client side NEVER calls any backend endpoint — its text is local component state only, discarded on close.
- `active`/`sortOrder` filtering: `GET /api/rest-tools` (client) returns only `active: true` rows, ordered by `sortOrder` ascending. `GET /api/admin/rest-tools` returns ALL rows (active and inactive), same ordering.
- No production cutover — must not touch `server.js` or `index.html`.

---

### Task 1: Backend — `rest_tools` schema + `deleteFile` storage helper + CRUD service/controller/routes

**Files:**
- Modify: `apps/api/src/models/schema.ts` — add `restTools` table + `RestTool` type.
- Modify: `apps/api/src/storage/index.ts` — add `deleteFile`.
- Create: `apps/api/src/services/rest-tools.service.ts`
- Create: `apps/api/src/controllers/rest-tools.controller.ts`
- Create: `apps/api/src/routes/rest-tools.routes.ts`
- Modify: `apps/api/src/app.ts` — mount the new router.
- Test: Create `apps/api/test/rest-tools.routes.test.ts`

**Interfaces:**
- Consumes: `uploadFile` (already exported from `apps/api/src/storage/index.ts`); `authMiddleware`, `adminOnly` from `../middleware/auth.middleware.js`; `asyncHandler` from `../middleware/async-handler.js`.
- Produces: `deleteFile(publicUrl: string): Promise<void>` (exported from `storage/index.ts`, consumed by Task 2). `restTools`/`RestTool` exported from `schema.ts`. `listActiveForClient(): Promise<RestTool[]>`, `listAllForAdmin(): Promise<RestTool[]>`, `createTool(input: { name: string; meta: string | null; action: string; minutes: number | null; seconds: number | null }): Promise<RestTool>`, `updateTool(id: string, patch: Partial<{ name: string; meta: string | null; action: string; minutes: number | null; seconds: number | null; active: boolean; audioUrl: string | null; audioName: string | null }>): Promise<RestTool | null>`, `deleteTool(id: string): Promise<void>` — all exported from `rest-tools.service.ts`, all consumed by Task 2's `uploadAudio` addition to the same file and by the frontend indirectly via the routes.

- [ ] **Step 1: Add the `rest_tools` table to the schema**

In `apps/api/src/models/schema.ts`, append after the existing `MindsetQuote` type export at the end of the file:

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

- [ ] **Step 2: Add `deleteFile` to the storage module**

In `apps/api/src/storage/index.ts`, add after `uploadFile`:

```ts
export async function deleteFile(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length));
  try {
    await storageClient.storage.from(BUCKET).remove([path]);
  } catch {
    // Best-effort cleanup — mismo comportamiento no-fatal que el legacy
    // (server.js:36-42): un archivo huérfano no debe romper la operación
    // principal (guardar/eliminar la herramienta).
  }
}
```

- [ ] **Step 3: Write the failing tests**

Create `apps/api/test/rest-tools.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, restTools } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('rest-tools routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientToken: string;
  let clientId: string;

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
    const [client] = await db
      .insert(clients)
      .values({ name: 'Rest Tools Client', email: `resttools-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterEach(async () => {
    await db.delete(restTools);
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('seeds the 3 default tools on first GET /rest-tools when the table is empty, and does not duplicate on a second call', async () => {
    const first = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(first.status).toBe(200);
    expect(first.body.tools).toHaveLength(3);
    expect(first.body.tools.map((t: { name: string }) => t.name)).toEqual([
      'Sonidos para dormir',
      'NSDR · Descanso profundo sin dormir',
      'Diario de descarga mental',
    ]);

    const second = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(second.status).toBe(200);
    expect(second.body.tools).toHaveLength(3);
  });

  it('any authenticated client can read GET /rest-tools (no ownerOrAdmin/permission gate)', async () => {
    const res = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /rest-tools only returns active tools, ordered by sortOrder', async () => {
    await db.insert(restTools).values([
      { name: 'Inactiva', action: 'play', active: false, sortOrder: 0 },
      { name: 'Segunda', action: 'play', active: true, sortOrder: 2 },
      { name: 'Primera', action: 'play', active: true, sortOrder: 1 },
    ]);
    const res = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tools.map((t: { name: string }) => t.name)).toEqual(['Primera', 'Segunda']);
  });

  it('GET /admin/rest-tools returns all tools including inactive ones', async () => {
    await db.insert(restTools).values([
      { name: 'Activa', action: 'play', active: true, sortOrder: 0 },
      { name: 'Inactiva', action: 'play', active: false, sortOrder: 1 },
    ]);
    const res = await request(app).get('/api/admin/rest-tools').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(2);
  });

  it('rejects a client on every /admin/rest-tools route', async () => {
    const getRes = await request(app).get('/api/admin/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.status).toBe(403);
    const postRes = await request(app)
      .post('/api/admin/rest-tools')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ name: 'x', action: 'write' });
    expect(postRes.status).toBe(403);
  });

  it('creates, updates, and deletes a tool', async () => {
    const createRes = await request(app)
      .post('/api/admin/rest-tools')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Respiración 4-7-8', meta: 'Técnica de respiración', action: 'play', minutes: 5, seconds: 30 });
    expect(createRes.status).toBe(201);
    const toolId = createRes.body.tool.id;
    expect(createRes.body.tool.minutes).toBe(5);
    expect(createRes.body.tool.seconds).toBe(30);

    const updateRes = await request(app)
      .put(`/api/admin/rest-tools/${toolId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Respiración 4-7-8 (actualizada)', active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tool.name).toBe('Respiración 4-7-8 (actualizada)');
    expect(updateRes.body.tool.active).toBe(false);

    const deleteRes = await request(app).delete(`/api/admin/rest-tools/${toolId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    const listRes = await request(app).get('/api/admin/rest-tools').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.tools.some((t: { id: string }) => t.id === toolId)).toBe(false);
  });

  it('PUT with audioUrl: null clears the audio fields (and best-effort cleans up storage)', async () => {
    const [tool] = await db
      .insert(restTools)
      .values({ name: 'Con audio', action: 'play', audioUrl: 'https://x.supabase.co/storage/v1/object/public/latribu-files/rest-tools/abc/song.mp3', audioName: 'song.mp3' })
      .returning();

    const updateRes = await request(app)
      .put(`/api/admin/rest-tools/${tool.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ audioUrl: null, audioName: null });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tool.audioUrl).toBeNull();
    expect(updateRes.body.tool.audioName).toBeNull();
  });

  it('deleting a tool with audio does not throw even if the file is already gone', async () => {
    const [tool] = await db
      .insert(restTools)
      .values({ name: 'Con audio a borrar', action: 'play', audioUrl: 'https://x.supabase.co/storage/v1/object/public/latribu-files/rest-tools/xyz/gone.mp3', audioName: 'gone.mp3' })
      .returning();
    const res = await request(app).delete(`/api/admin/rest-tools/${tool.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd apps/api && npx vitest run test/rest-tools.routes.test.ts`
Expected: FAIL — none of the routes exist yet.

- [ ] **Step 5: Implement `rest-tools.service.ts`**

Create `apps/api/src/services/rest-tools.service.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { restTools, type RestTool } from '../models/schema.js';
import { deleteFile } from '../storage/index.js';

const DEFAULT_REST_TOOLS = [
  { name: 'Sonidos para dormir', meta: 'Ruido blanco + respiración guiada · 20 min', action: 'play', minutes: 20, seconds: null },
  { name: 'NSDR · Descanso profundo sin dormir', meta: '10 min · para siestas o resets a media tarde', action: 'play', minutes: 10, seconds: null },
  { name: 'Diario de descarga mental', meta: 'Escribe lo que ronda tu cabeza antes de apagar la luz', action: 'write', minutes: null, seconds: null },
];

async function seedIfEmpty(): Promise<void> {
  const existing = await db.select().from(restTools).limit(1);
  if (existing.length > 0) return;
  await Promise.all(DEFAULT_REST_TOOLS.map((t, i) => db.insert(restTools).values({ ...t, sortOrder: i })));
}

export async function listActiveForClient(): Promise<RestTool[]> {
  await seedIfEmpty();
  return db.select().from(restTools).where(eq(restTools.active, true)).orderBy(asc(restTools.sortOrder));
}

export async function listAllForAdmin(): Promise<RestTool[]> {
  await seedIfEmpty();
  return db.select().from(restTools).orderBy(asc(restTools.sortOrder));
}

export async function createTool(input: {
  name: string;
  meta?: string | null;
  action: string;
  minutes?: number | null;
  seconds?: number | null;
}): Promise<RestTool> {
  const [created] = await db.insert(restTools).values(input).returning();
  return created;
}

export async function updateTool(
  id: string,
  patch: Partial<{
    name: string;
    meta: string | null;
    action: string;
    minutes: number | null;
    seconds: number | null;
    active: boolean;
    audioUrl: string | null;
    audioName: string | null;
  }>
): Promise<RestTool | null> {
  if (patch.audioUrl === null) {
    const [existing] = await db.select().from(restTools).where(eq(restTools.id, id)).limit(1);
    if (existing) await deleteFile(existing.audioUrl);
  }
  const [updated] = await db
    .update(restTools)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(restTools.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteTool(id: string): Promise<void> {
  const [existing] = await db.select().from(restTools).where(eq(restTools.id, id)).limit(1);
  await db.delete(restTools).where(eq(restTools.id, id));
  if (existing) await deleteFile(existing.audioUrl);
}
```

- [ ] **Step 6: Create the controller**

Create `apps/api/src/controllers/rest-tools.controller.ts`:

```ts
import type { Request, Response } from 'express';
import * as restToolsService from '../services/rest-tools.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listActiveForClient(_req: Request, res: Response) {
  const tools = await restToolsService.listActiveForClient();
  return ok(res, { tools });
}

export async function listAllForAdmin(_req: Request, res: Response) {
  const tools = await restToolsService.listAllForAdmin();
  return ok(res, { tools });
}

export async function createTool(req: Request, res: Response) {
  const { name, meta, action, minutes, seconds } = req.body as {
    name?: string;
    meta?: string | null;
    action?: string;
    minutes?: number | null;
    seconds?: number | null;
  };
  if (!name || !name.trim()) return err(res, 'Escribe un nombre.');
  if (action !== 'play' && action !== 'write') return err(res, 'Tipo inválido.');
  const tool = await restToolsService.createTool({ name: name.trim(), meta: meta ?? null, action, minutes: minutes ?? null, seconds: seconds ?? null });
  return ok(res, { tool }, 201);
}

export async function updateTool(req: Request, res: Response) {
  const { name, meta, action, minutes, seconds, active, audioUrl, audioName } = req.body as {
    name?: string;
    meta?: string | null;
    action?: string;
    minutes?: number | null;
    seconds?: number | null;
    active?: boolean;
    audioUrl?: string | null;
    audioName?: string | null;
  };
  if (action !== undefined && action !== 'play' && action !== 'write') return err(res, 'Tipo inválido.');
  const patch: Parameters<typeof restToolsService.updateTool>[1] = {};
  if (name !== undefined) patch.name = name.trim();
  if (meta !== undefined) patch.meta = meta;
  if (action !== undefined) patch.action = action;
  if (minutes !== undefined) patch.minutes = minutes;
  if (seconds !== undefined) patch.seconds = seconds;
  if (active !== undefined) patch.active = active;
  if (audioUrl !== undefined) patch.audioUrl = audioUrl;
  if (audioName !== undefined) patch.audioName = audioName;
  const tool = await restToolsService.updateTool(req.params.id, patch);
  if (!tool) return err(res, 'Herramienta no encontrada.', 404);
  return ok(res, { tool });
}

export async function deleteTool(req: Request, res: Response) {
  await restToolsService.deleteTool(req.params.id);
  return ok(res, { message: 'Herramienta eliminada.' });
}
```

- [ ] **Step 7: Create the routes**

Create `apps/api/src/routes/rest-tools.routes.ts`:

```ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import * as restToolsController from '../controllers/rest-tools.controller.js';

export const restToolsRouter = Router();

restToolsRouter.get('/rest-tools', authMiddleware, asyncHandler(restToolsController.listActiveForClient));
restToolsRouter.get('/admin/rest-tools', authMiddleware, adminOnly, asyncHandler(restToolsController.listAllForAdmin));
restToolsRouter.post('/admin/rest-tools', authMiddleware, adminOnly, asyncHandler(restToolsController.createTool));
restToolsRouter.put('/admin/rest-tools/:id', authMiddleware, adminOnly, asyncHandler(restToolsController.updateTool));
restToolsRouter.delete('/admin/rest-tools/:id', authMiddleware, adminOnly, asyncHandler(restToolsController.deleteTool));
```

Note: the `POST /admin/rest-tools/:id/upload-audio` route is added in Task 2, to this same file.

- [ ] **Step 8: Mount the router in `app.ts`**

In `apps/api/src/app.ts`, add the import:

```ts
import { restToolsRouter } from './routes/rest-tools.routes.js';
```

and mount it alongside the other root-mounted routers:

```ts
app.use('/api', restToolsRouter);
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd apps/api && npx vitest run test/rest-tools.routes.test.ts`
Expected: PASS. The "PUT with audioUrl: null calls deleteFile" test verifies behaviorally (the update succeeds and clears the fields) rather than asserting the mock was called — `deleteFile` is a best-effort side effect, not something the response shape reveals directly; this is acceptable per the spec's non-fatal error-handling requirement.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/models/schema.ts apps/api/src/storage/index.ts apps/api/src/services/rest-tools.service.ts apps/api/src/controllers/rest-tools.controller.ts apps/api/src/routes/rest-tools.routes.ts apps/api/src/app.ts apps/api/test/rest-tools.routes.test.ts
git commit -m "feat(api): add rest_tools table, auto-seed, and admin CRUD"
```

---

### Task 2: Backend — audio upload/replace endpoint

**Files:**
- Modify: `apps/api/src/services/rest-tools.service.ts` — add `uploadAudio`.
- Modify: `apps/api/src/controllers/rest-tools.controller.ts` — add `uploadAudio` handler.
- Modify: `apps/api/src/routes/rest-tools.routes.ts` — add the route with multer.
- Test: Modify `apps/api/test/rest-tools.routes.test.ts` — add an `upload-audio` describe block.

**Interfaces:**
- Consumes: `uploadFile(pathPrefix: string, buffer: Buffer, contentType: string, originalName: string): Promise<string>` (already exported from `apps/api/src/storage/index.ts`); `deleteFile` (Task 1); `restTools`/`RestTool` (Task 1).
- Produces: `uploadAudio(id: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<RestTool>` added to `rest-tools.service.ts`. `POST /api/admin/rest-tools/:id/upload-audio` (multipart, field name `audio`).

- [ ] **Step 1: Write the failing test**

Add to `apps/api/test/rest-tools.routes.test.ts`, inside the existing `describe('rest-tools routes', ...)` block:

```ts
describe('POST /admin/rest-tools/:id/upload-audio', () => {
  it('rejects a client', async () => {
    const [tool] = await db.insert(restTools).values({ name: 'Para audio', action: 'play' }).returning();
    const res = await request(app)
      .post(`/api/admin/rest-tools/${tool.id}/upload-audio`)
      .set('Authorization', `Bearer ${clientToken}`)
      .attach('audio', Buffer.from('fake-audio-bytes'), 'clip.mp3');
    expect(res.status).toBe(403);
  });

  it('rejects a request with no file attached', async () => {
    const [tool] = await db.insert(restTools).values({ name: 'Para audio', action: 'play' }).returning();
    const res = await request(app).post(`/api/admin/rest-tools/${tool.id}/upload-audio`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('uploads audio and updates audioUrl/audioName', async () => {
    const [tool] = await db.insert(restTools).values({ name: 'Para audio', action: 'play' }).returning();
    const res = await request(app)
      .post(`/api/admin/rest-tools/${tool.id}/upload-audio`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('audio', Buffer.from('fake-audio-bytes'), 'clip.mp3');
    expect(res.status).toBe(200);
    expect(res.body.tool.audioUrl).toEqual(expect.stringContaining('http'));
    expect(res.body.tool.audioName).toBe('clip.mp3');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npx vitest run test/rest-tools.routes.test.ts -t "upload-audio"`
Expected: FAIL — the route doesn't exist yet.

- [ ] **Step 3: Add `uploadAudio` to the service**

In `apps/api/src/services/rest-tools.service.ts`, add the `uploadFile` import to the existing storage import line, then add:

```ts
export async function uploadAudio(
  id: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<RestTool> {
  const [existing] = await db.select().from(restTools).where(eq(restTools.id, id)).limit(1);
  const audioUrl = await uploadFile(`rest-tools/${id}`, file.buffer, file.mimetype, file.originalname);
  const [updated] = await db
    .update(restTools)
    .set({ audioUrl, audioName: file.originalname, updatedAt: new Date() })
    .where(eq(restTools.id, id))
    .returning();
  if (existing?.audioUrl) await deleteFile(existing.audioUrl);
  return updated;
}
```

- [ ] **Step 4: Add the controller handler**

In `apps/api/src/controllers/rest-tools.controller.ts`, add:

```ts
export async function uploadAudio(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún audio.');
  const tool = await restToolsService.uploadAudio(req.params.id, req.file);
  return ok(res, { tool });
}
```

- [ ] **Step 5: Add the route**

In `apps/api/src/routes/rest-tools.routes.ts`, add the imports:

```ts
import multer from 'multer';
```

and, at the top of the file after the router is created, define:

```ts
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
```

then add the route:

```ts
restToolsRouter.post(
  '/admin/rest-tools/:id/upload-audio',
  authMiddleware,
  adminOnly,
  upload.single('audio'),
  asyncHandler(restToolsController.uploadAudio)
);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/api && npx vitest run test/rest-tools.routes.test.ts`
Expected: PASS (full file).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/rest-tools.service.ts apps/api/src/controllers/rest-tools.controller.ts apps/api/src/routes/rest-tools.routes.ts apps/api/test/rest-tools.routes.test.ts
git commit -m "feat(api): add rest-tools audio upload/replace endpoint"
```

---

### Task 3: Frontend — `lib/rest-tools-client.ts`

**Files:**
- Create: `apps/web/lib/rest-tools-client.ts`
- Test: Create `apps/web/test/rest-tools-client.test.ts`

**Interfaces:**
- Consumes: `getSessionToken` from `./api-client` (copy the `authorizedRequest<T>` pattern with `FormData` support, exactly as used in `apps/web/lib/onboarding-client.ts` — reproduced below).
- Produces: `type RestTool = { id: string; name: string; meta: string | null; action: string; minutes: number | null; seconds: number | null; audioUrl: string | null; audioName: string | null; active: boolean; sortOrder: number }`; `listRestTools(): Promise<RestTool[]>`; `listAllRestTools(): Promise<RestTool[]>`; `createRestTool(input: { name: string; meta?: string | null; action: string; minutes?: number | null; seconds?: number | null }): Promise<RestTool>`; `updateRestTool(id: string, patch: Partial<{ name: string; meta: string | null; action: string; minutes: number | null; seconds: number | null; active: boolean }>): Promise<RestTool>`; `deleteRestTool(id: string): Promise<void>`; `uploadRestToolAudio(id: string, file: File): Promise<RestTool>`; `removeRestToolAudio(id: string): Promise<RestTool>`. Tasks 4 and 5 consume these by these exact names.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/rest-tools-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listRestTools,
  listAllRestTools,
  createRestTool,
  updateRestTool,
  deleteRestTool,
  uploadRestToolAudio,
  removeRestToolAudio,
} from '../lib/rest-tools-client';

const sampleTool = {
  id: 't1',
  name: 'Sonidos para dormir',
  meta: 'Ruido blanco',
  action: 'play',
  minutes: 20,
  seconds: null,
  audioUrl: null,
  audioName: null,
  active: true,
  sortOrder: 0,
};

describe('rest-tools-client', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('lists active tools', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tools: [sampleTool] }),
    });
    const result = await listRestTools();
    expect(result).toEqual([sampleTool]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rest-tools'), expect.objectContaining({ method: 'GET' }));
  });

  it('lists all tools for admin', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tools: [sampleTool] }),
    });
    const result = await listAllRestTools();
    expect(result).toEqual([sampleTool]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/rest-tools'), expect.objectContaining({ method: 'GET' }));
  });

  it('creates a tool', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, id: 't2', name: 'Nueva' } }),
    });
    const result = await createRestTool({ name: 'Nueva', action: 'write' });
    expect(result.id).toBe('t2');
  });

  it('updates a tool', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, active: false } }),
    });
    const result = await updateRestTool('t1', { active: false });
    expect(result.active).toBe(false);
  });

  it('deletes a tool', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    await expect(deleteRestTool('t1')).resolves.toBeUndefined();
  });

  it('uploads audio via FormData', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, audioUrl: 'https://x/y.mp3', audioName: 'y.mp3' } }),
    });
    const file = new File(['fake'], 'y.mp3', { type: 'audio/mpeg' });
    const result = await uploadRestToolAudio('t1', file);
    expect(result.audioUrl).toBe('https://x/y.mp3');
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/api/admin/rest-tools/t1/upload-audio');
    expect(call[1].body).toBeInstanceOf(FormData);
  });

  it('removes audio by updating with null fields', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, tool: { ...sampleTool, audioUrl: null, audioName: null } }),
    });
    const result = await removeRestToolAudio('t1');
    expect(result.audioUrl).toBeNull();
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ audioUrl: null, audioName: null });
  });

  it('throws when the backend reports failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ json: () => Promise.resolve({ success: false, error: 'Escribe un nombre.' }) });
    await expect(createRestTool({ name: '', action: 'write' })).rejects.toThrow('Escribe un nombre.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/rest-tools-client.test.ts`
Expected: FAIL — `../lib/rest-tools-client` doesn't exist yet.

- [ ] **Step 3: Implement `rest-tools-client.ts`**

Create `apps/web/lib/rest-tools-client.ts`:

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

export type RestTool = {
  id: string;
  name: string;
  meta: string | null;
  action: string;
  minutes: number | null;
  seconds: number | null;
  audioUrl: string | null;
  audioName: string | null;
  active: boolean;
  sortOrder: number;
};

export async function listRestTools(): Promise<RestTool[]> {
  const body = await authorizedRequest<{ success: boolean; tools: RestTool[]; error?: string }>('/api/rest-tools', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las herramientas para dormir.');
  return body.tools;
}

export async function listAllRestTools(): Promise<RestTool[]> {
  const body = await authorizedRequest<{ success: boolean; tools: RestTool[]; error?: string }>('/api/admin/rest-tools', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las herramientas para dormir.');
  return body.tools;
}

export async function createRestTool(input: {
  name: string;
  meta?: string | null;
  action: string;
  minutes?: number | null;
  seconds?: number | null;
}): Promise<RestTool> {
  const body = await authorizedRequest<{ success: boolean; tool: RestTool; error?: string }>('/api/admin/rest-tools', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear la herramienta.');
  return body.tool;
}

export async function updateRestTool(
  id: string,
  patch: Partial<{
    name: string;
    meta: string | null;
    action: string;
    minutes: number | null;
    seconds: number | null;
    active: boolean;
    audioUrl: string | null;
    audioName: string | null;
  }>
): Promise<RestTool> {
  const body = await authorizedRequest<{ success: boolean; tool: RestTool; error?: string }>(`/api/admin/rest-tools/${id}`, 'PUT', patch);
  if (!body.success) throw new Error(body.error || 'Error al actualizar la herramienta.');
  return body.tool;
}

export async function deleteRestTool(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/rest-tools/${id}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la herramienta.');
}

export async function uploadRestToolAudio(id: string, file: File): Promise<RestTool> {
  const formData = new FormData();
  formData.append('audio', file);
  const body = await authorizedRequest<{ success: boolean; tool: RestTool; error?: string }>(
    `/api/admin/rest-tools/${id}/upload-audio`,
    'POST',
    formData
  );
  if (!body.success) throw new Error(body.error || 'Error al subir el audio.');
  return body.tool;
}

export async function removeRestToolAudio(id: string): Promise<RestTool> {
  return updateRestTool(id, { audioUrl: null, audioName: null });
}
```

Note: `updateRestTool`'s patch type includes `audioUrl`/`audioName` (not just `name/meta/action/minutes/seconds/active`) specifically so `removeRestToolAudio` can call it directly without a type-widening workaround.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/rest-tools-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/rest-tools-client.ts apps/web/test/rest-tools-client.test.ts
git commit -m "feat(web): add rest-tools-client API wrapper"
```

---

### Task 4: Frontend — `RestToolsAdminPanel.tsx`

**Files:**
- Create: `apps/web/components/rest/RestToolsAdminPanel.tsx`
- Test: Create `apps/web/test/rest-tools-admin-panel.test.tsx`

**Interfaces:**
- Consumes: `listAllRestTools`, `createRestTool`, `updateRestTool`, `deleteRestTool`, `uploadRestToolAudio`, `removeRestToolAudio`, `type RestTool` from `apps/web/lib/rest-tools-client.ts` (Task 3).
- Produces: `RestToolsAdminPanel` component, no props. Consumed by Task 6's `/admin/rest-tools` page.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/rest-tools-admin-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RestToolsAdminPanel } from '../components/rest/RestToolsAdminPanel';
import * as restToolsClient from '../lib/rest-tools-client';

const sampleTools = [
  { id: 't1', name: 'Sonidos para dormir', meta: 'Ruido blanco', action: 'play', minutes: 20, seconds: 0, audioUrl: null, audioName: null, active: true, sortOrder: 0 },
  { id: 't2', name: 'Diario', meta: null, action: 'write', minutes: null, seconds: null, audioUrl: 'https://x/y.mp3', audioName: 'y.mp3', active: true, sortOrder: 1 },
];

describe('RestToolsAdminPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(restToolsClient, 'listAllRestTools').mockResolvedValue(sampleTools);
  });

  it('renders the fetched tools', async () => {
    render(<RestToolsAdminPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    expect(screen.getByText('Diario')).toBeInTheDocument();
  });

  it('creates a tool and refetches', async () => {
    const createSpy = vi.spyOn(restToolsClient, 'createRestTool').mockResolvedValue({
      id: 't3', name: 'Nueva', meta: '', action: 'write', minutes: null, seconds: null, audioUrl: null, audioName: null, active: true, sortOrder: 2,
    });
    render(<RestToolsAdminPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar herramienta' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy.mock.calls[0][0]).toMatchObject({ name: 'Nueva' });
  });

  it('blocks creating a tool with empty name', async () => {
    const createSpy = vi.spyOn(restToolsClient, 'createRestTool');
    render(<RestToolsAdminPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar herramienta' }));
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('deletes a tool', async () => {
    const deleteSpy = vi.spyOn(restToolsClient, 'deleteRestTool').mockResolvedValue(undefined);
    render(<RestToolsAdminPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('t1'));
  });

  it('edits a tool', async () => {
    const updateSpy = vi.spyOn(restToolsClient, 'updateRestTool').mockResolvedValue({ ...sampleTools[0], name: 'Editada' });
    render(<RestToolsAdminPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Editada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
  });

  it('uploads audio for a tool being edited', async () => {
    const uploadSpy = vi.spyOn(restToolsClient, 'uploadRestToolAudio').mockResolvedValue({ ...sampleTools[0], audioUrl: 'https://x/z.mp3', audioName: 'z.mp3' });
    render(<RestToolsAdminPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    const file = new File(['fake'], 'z.mp3', { type: 'audio/mpeg' });
    const fileInput = screen.getByLabelText('Audio propio') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir audio' }));

    await waitFor(() => expect(uploadSpy).toHaveBeenCalledWith('t1', file));
  });

  it('removes audio for a tool with an existing audio', async () => {
    const removeSpy = vi.spyOn(restToolsClient, 'removeRestToolAudio').mockResolvedValue({ ...sampleTools[1], audioUrl: null, audioName: null });
    render(<RestToolsAdminPanel />);
    await waitFor(() => expect(screen.getByText('Diario')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar audio' }));
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith('t2'));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/rest-tools-admin-panel.test.tsx`
Expected: FAIL — `../components/rest/RestToolsAdminPanel` doesn't exist yet.

- [ ] **Step 3: Implement `RestToolsAdminPanel.tsx`**

Create `apps/web/components/rest/RestToolsAdminPanel.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  type RestTool,
  listAllRestTools,
  createRestTool,
  updateRestTool,
  deleteRestTool,
  uploadRestToolAudio,
  removeRestToolAudio,
} from '../../lib/rest-tools-client';

export function RestToolsAdminPanel() {
  const [tools, setTools] = useState<RestTool[]>([]);
  const [newName, setNewName] = useState('');
  const [newMeta, setNewMeta] = useState('');
  const [newAction, setNewAction] = useState('play');
  const [newMinutes, setNewMinutes] = useState('');
  const [newSeconds, setNewSeconds] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMeta, setEditMeta] = useState('');
  const [editAction, setEditAction] = useState('play');
  const [editMinutes, setEditMinutes] = useState('');
  const [editSeconds, setEditSeconds] = useState('');
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const list = await listAllRestTools();
    setTools(list);
  }, []);

  useEffect(() => {
    refetch().catch((e: Error) => setError(e.message));
  }, [refetch]);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createRestTool({
        name: newName.trim(),
        meta: newMeta,
        action: newAction,
        minutes: newAction === 'play' ? (newMinutes ? Number(newMinutes) : null) : null,
        seconds: newAction === 'play' ? (newSeconds ? Number(newSeconds) : null) : null,
      });
      setNewName('');
      setNewMeta('');
      setNewMinutes('');
      setNewSeconds('');
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(tool: RestTool) {
    setEditingId(tool.id);
    setEditName(tool.name);
    setEditMeta(tool.meta || '');
    setEditAction(tool.action);
    setEditMinutes(tool.minutes != null ? String(tool.minutes) : '');
    setEditSeconds(tool.seconds != null ? String(tool.seconds) : '');
    setEditAudioFile(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      await updateRestTool(id, {
        name: editName.trim(),
        meta: editMeta,
        action: editAction,
        minutes: editAction === 'play' ? (editMinutes ? Number(editMinutes) : null) : null,
        seconds: editAction === 'play' ? (editSeconds ? Number(editSeconds) : null) : null,
      });
      setEditingId(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRestTool(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUploadAudio(id: string) {
    if (!editAudioFile) return;
    try {
      await uploadRestToolAudio(id, editAudioFile);
      setEditAudioFile(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRemoveAudio(id: string) {
    try {
      await removeRestToolAudio(id);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h2>Herramientas para dormir</h2>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="rt-new-name">Nombre</label>
      <input id="rt-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
      <label htmlFor="rt-new-action">Tipo</label>
      <select id="rt-new-action" value={newAction} onChange={(e) => setNewAction(e.target.value)}>
        <option value="play">Reproducir (con temporizador)</option>
        <option value="write">Escribir (diario)</option>
      </select>
      {newAction === 'play' && (
        <>
          <label htmlFor="rt-new-minutes">Minutos</label>
          <input id="rt-new-minutes" type="number" value={newMinutes} onChange={(e) => setNewMinutes(e.target.value)} />
          <label htmlFor="rt-new-seconds">Segundos</label>
          <input id="rt-new-seconds" type="number" value={newSeconds} onChange={(e) => setNewSeconds(e.target.value)} />
        </>
      )}
      <label htmlFor="rt-new-meta">Descripción</label>
      <input id="rt-new-meta" value={newMeta} onChange={(e) => setNewMeta(e.target.value)} />
      <button type="button" onClick={handleCreate}>
        + Agregar herramienta
      </button>

      {tools.length === 0 && <p>Aún no hay herramientas.</p>}
      {tools.map((tool) =>
        editingId === tool.id ? (
          <div key={tool.id}>
            <label htmlFor="rt-edit-name">Nombre</label>
            <input id="rt-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <label htmlFor="rt-edit-action">Tipo</label>
            <select id="rt-edit-action" value={editAction} onChange={(e) => setEditAction(e.target.value)}>
              <option value="play">Reproducir (con temporizador)</option>
              <option value="write">Escribir (diario)</option>
            </select>
            {editAction === 'play' && (
              <>
                <label htmlFor="rt-edit-minutes">Minutos</label>
                <input id="rt-edit-minutes" type="number" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} />
                <label htmlFor="rt-edit-seconds">Segundos</label>
                <input id="rt-edit-seconds" type="number" value={editSeconds} onChange={(e) => setEditSeconds(e.target.value)} />
              </>
            )}
            <label htmlFor="rt-edit-meta">Descripción</label>
            <input id="rt-edit-meta" value={editMeta} onChange={(e) => setEditMeta(e.target.value)} />

            <label htmlFor="rt-edit-audio">Audio propio</label>
            {tool.audioUrl && (
              <div>
                <audio controls src={tool.audioUrl} />
                <span>{tool.audioName}</span>
                <button type="button" onClick={() => handleRemoveAudio(tool.id)}>
                  Quitar audio
                </button>
              </div>
            )}
            <input
              id="rt-edit-audio"
              type="file"
              accept="audio/*"
              onChange={(e) => setEditAudioFile(e.target.files?.[0] ?? null)}
            />
            <button type="button" onClick={() => handleUploadAudio(tool.id)}>
              {tool.audioUrl ? 'Reemplazar audio' : 'Subir audio'}
            </button>

            <button type="button" onClick={() => handleSaveEdit(tool.id)}>
              Guardar
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div key={tool.id}>
            <strong>{tool.name}</strong>
            <span>{tool.meta}</span>
            <button type="button" onClick={() => startEdit(tool)}>
              Editar
            </button>
            <button type="button" onClick={() => handleDelete(tool.id)}>
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

Run: `cd apps/web && npx vitest run test/rest-tools-admin-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/rest/RestToolsAdminPanel.tsx apps/web/test/rest-tools-admin-panel.test.tsx
git commit -m "feat(web): add RestToolsAdminPanel component"
```

---

### Task 5: Frontend — `RestToolsClientPanel.tsx`

**Files:**
- Create: `apps/web/components/rest/RestToolsClientPanel.tsx`
- Test: Create `apps/web/test/rest-tools-client-panel.test.tsx`

**Interfaces:**
- Consumes: `listRestTools`, `type RestTool` from `apps/web/lib/rest-tools-client.ts` (Task 3).
- Produces: `RestToolsClientPanel` component, no props. Consumed by Task 7's `/rest` page.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/rest-tools-client-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RestToolsClientPanel } from '../components/rest/RestToolsClientPanel';
import * as restToolsClient from '../lib/rest-tools-client';

const tools = [
  { id: 't1', name: 'Sonidos para dormir', meta: 'Ruido blanco', action: 'play', minutes: 0, seconds: 2, audioUrl: null, audioName: null, active: true, sortOrder: 0 },
  { id: 't2', name: 'Con audio propio', meta: null, action: 'play', minutes: null, seconds: null, audioUrl: 'https://x/song.mp3', audioName: 'song.mp3', active: true, sortOrder: 1 },
  { id: 't3', name: 'Diario', meta: null, action: 'write', minutes: null, seconds: null, audioUrl: null, audioName: null, active: true, sortOrder: 2 },
];

describe('RestToolsClientPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.spyOn(restToolsClient, 'listRestTools').mockResolvedValue(tools);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the fetched tools', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    expect(screen.getByText('Con audio propio')).toBeInTheDocument();
    expect(screen.getByText('Diario')).toBeInTheDocument();
  });

  it('a "write" tool opens an ephemeral journal that never calls the network', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Diario')).toBeInTheDocument());
    const writeButtons = screen.getAllByRole('button', { name: 'Escribir' });
    fireEvent.click(writeButtons[0]);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'lo que ronda mi cabeza' } });
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('a "play" tool without audioUrl starts a countdown timer and stops at 0', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    const playButtons = screen.getAllByRole('button', { name: 'Reproducir' });
    fireEvent.click(playButtons[0]);
    expect(screen.getByText('0:02')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('0:01')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Detener' })).not.toBeInTheDocument();
  });

  it('a "play" tool with audioUrl toggles an inline audio player', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Con audio propio')).toBeInTheDocument());
    const toggleButtons = screen.getAllByRole('button', { name: 'Reproducir' });
    // The second tool ('Con audio propio') has audio, sortOrder 1 -> second play button
    fireEvent.click(toggleButtons[1]);
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/web && npx vitest run test/rest-tools-client-panel.test.tsx`
Expected: FAIL — `../components/rest/RestToolsClientPanel` doesn't exist yet.

- [ ] **Step 3: Implement `RestToolsClientPanel.tsx`**

Create `apps/web/components/rest/RestToolsClientPanel.tsx`:

```tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { type RestTool, listRestTools } from '../../lib/rest-tools-client';

export function RestToolsClientPanel() {
  const [tools, setTools] = useState<RestTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [journalOpenId, setJournalOpenId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [timerToolId, setTimerToolId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hasCountdown, setHasCountdown] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listRestTools()
      .then(setTools)
      .catch((e: Error) => setError(e.message));
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setTimerToolId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startTimer(tool: RestTool) {
    stopTimer();
    setPlayingAudioId(null);
    const total = (tool.minutes || 0) * 60 + (tool.seconds || 0);
    setHasCountdown(total > 0);
    setSecondsLeft(total);
    setTimerToolId(tool.id);
    if (total > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }

  function toggleJournal(id: string) {
    setJournalOpenId((prev) => (prev === id ? null : id));
  }

  function toggleAudio(id: string) {
    stopTimer();
    setPlayingAudioId((prev) => (prev === id ? null : id));
  }

  if (error) return <p role="alert">{error}</p>;

  return (
    <section>
      <h2>Herramientas para dormir</h2>
      {tools.length === 0 && <p>Aún no hay herramientas.</p>}
      {tools.map((tool) => (
        <div key={tool.id}>
          <strong>{tool.name}</strong>
          <span>{tool.meta}</span>
          {tool.action === 'write' && (
            <button type="button" onClick={() => toggleJournal(tool.id)}>
              Escribir
            </button>
          )}
          {tool.action === 'play' && tool.audioUrl && (
            <button type="button" onClick={() => toggleAudio(tool.id)}>
              {playingAudioId === tool.id ? 'Ocultar' : 'Reproducir'}
            </button>
          )}
          {tool.action === 'play' && !tool.audioUrl && (
            <button type="button" onClick={() => startTimer(tool)}>
              Reproducir
            </button>
          )}
          {playingAudioId === tool.id && tool.audioUrl && <audio controls autoPlay src={tool.audioUrl} />}
          {journalOpenId === tool.id && (
            <div>
              <label htmlFor={`rt-journal-${tool.id}`}>
                Escribe lo que ronda tu cabeza — no se guarda, es solo para vaciar la mente antes de dormir.
              </label>
              <textarea id={`rt-journal-${tool.id}`} rows={4} />
              <button type="button" onClick={() => toggleJournal(tool.id)}>
                Listo
              </button>
            </div>
          )}
          {timerToolId === tool.id && (
            <div>
              {hasCountdown ? (
                <p>
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </p>
              ) : (
                <p>Reproduciendo…</p>
              )}
              <button type="button" onClick={stopTimer}>
                Detener
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/web && npx vitest run test/rest-tools-client-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/rest/RestToolsClientPanel.tsx apps/web/test/rest-tools-client-panel.test.tsx
git commit -m "feat(web): add RestToolsClientPanel component"
```

---

### Task 6: Frontend — `/admin/rest-tools` page

**Files:**
- Create: `apps/web/app/admin/rest-tools/page.tsx`
- Test: Create `apps/web/test/admin-rest-tools-page.test.tsx`

**Interfaces:**
- Consumes: `RestToolsAdminPanel` (Task 4).
- Produces: the `/admin/rest-tools` route.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/admin-rest-tools-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminRestToolsPage from '../app/admin/rest-tools/page';
import * as restToolsClient from '../lib/rest-tools-client';

describe('AdminRestToolsPage', () => {
  it('renders the admin panel', async () => {
    vi.spyOn(restToolsClient, 'listAllRestTools').mockResolvedValue([]);
    render(<AdminRestToolsPage />);
    expect(await screen.findByText('Herramientas para dormir')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run test/admin-rest-tools-page.test.tsx`
Expected: FAIL — `../app/admin/rest-tools/page` doesn't exist yet.

- [ ] **Step 3: Implement the page**

Create `apps/web/app/admin/rest-tools/page.tsx`:

```tsx
'use client';

import { RestToolsAdminPanel } from '../../../components/rest/RestToolsAdminPanel';

export default function AdminRestToolsPage() {
  return (
    <div>
      <h1>Herramientas para dormir</h1>
      <RestToolsAdminPanel />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run test/admin-rest-tools-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/rest-tools/page.tsx apps/web/test/admin-rest-tools-page.test.tsx
git commit -m "feat(web): add /admin/rest-tools page"
```

---

### Task 7: Frontend — `/rest` page

**Files:**
- Create: `apps/web/app/rest/page.tsx`
- Test: Create `apps/web/test/rest-page.test.tsx`

**Interfaces:**
- Consumes: `RestToolsClientPanel` (Task 5).
- Produces: the `/rest` route.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/rest-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RestPage from '../app/rest/page';
import * as restToolsClient from '../lib/rest-tools-client';

describe('RestPage', () => {
  it('renders the client panel', async () => {
    vi.spyOn(restToolsClient, 'listRestTools').mockResolvedValue([]);
    render(<RestPage />);
    expect(await screen.findByText('Herramientas para dormir')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run test/rest-page.test.tsx`
Expected: FAIL — `../app/rest/page` doesn't exist yet.

- [ ] **Step 3: Implement the page**

Create `apps/web/app/rest/page.tsx`:

```tsx
'use client';

import { RestToolsClientPanel } from '../../components/rest/RestToolsClientPanel';

export default function RestPage() {
  return (
    <div>
      <h1>Descanso</h1>
      <RestToolsClientPanel />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run test/rest-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full web and api suites**

Run: `cd apps/web && npx vitest run` and `cd apps/api && npx vitest run` — both must be 100% green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/rest/page.tsx apps/web/test/rest-page.test.tsx
git commit -m "feat(web): add /rest page"
```

---

## Self-Review Notes

- **Spec coverage:** `rest_tools` schema + auto-seed + admin CRUD (Task 1), audio upload/replace (Task 2), frontend API wrapper (Task 3), admin panel with audio management (Task 4), client panel with the 3 interaction modes — write/play-no-audio/play-with-audio (Task 5), the two new pages (Tasks 6-7) — every spec section maps to a task.
- **Scope decisions honored:** auto-seed ported exactly (Task 1's global constraint + test); no client-scoping anywhere (`GET /rest-tools` has no `:id`, no `ownerOrAdmin`); the ephemeral journal never calls the network (Task 5's test explicitly asserts `fetch` was never called); sleep-log and sleep-protocol are untouched by every task.
- **Type consistency check:** `RestTool` is defined once in Task 3 and reused verbatim by Tasks 4, 5, 6, 7. `updateRestTool`'s patch type was corrected in Task 3 itself (Step 3's note) to include `audioUrl`/`audioName` before `removeRestToolAudio` needs them — no downstream task encounters a type mismatch.
- **Out of scope, confirmed absent from this plan:** sleep-log widget, sleep-protocol (personalized/generic), any shared admin nav/layout, production cutover — no task touches `server.js`, `index.html`, or any sleep-log/sleep-protocol table or endpoint.
