# Información Personal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the "Información Personal" module (profile, anthropometrics, progress photos, InBody records, file uploads, OCR) from `server.js` to the layered `apps/api`/`apps/web` stack established by the Fundación migration, as sub-project 2.

**Architecture:** Same Routes→Controllers→Services→Models layering as Fundación, Drizzle over the existing Postgres tables (no schema changes), a new thin Storage wrapper over `supabase-js` for file uploads (Supabase Storage stays untouched as a service), and a dependency-injection seam for the Google Vision OCR call so tests never hit Google's real API.

**Tech Stack:** Same as Fundación — Express+TypeScript, Drizzle ORM, Zod (via `@latribu/shared-types`), Next.js App Router, Vitest against a dedicated test database and test Storage bucket. New dependencies: `@supabase/supabase-js` (Storage only, never for DB access), `multer` (already used by the legacy stack for the same purpose), `nodemailer`, `pdf-parse`.

## Global Constraints

- No production cutover — `server.js`/`index.html` keep running unchanged; this module is additive only, same HTTP routes as the legacy server so it's a drop-in replacement when the cutover eventually happens.
- Same 4 tables already in the database (`personal_info`, `anthropometric_records`, `progress_photos`, `bio_inbody_records`) — no migration, `models/schema.ts` mirrors existing columns only.
- Only services touch `db` directly (the Fundación final review enforced this invariant — do not regress it).
- Storage stays on Supabase Storage, accessed only through the new `src/storage/index.ts` wrapper — never mixed into the Postgres/Drizzle connection.
- The onboarding wizard's free-form fields (`onboarding_report`) are validated as an opaque `z.record(z.string(), z.unknown())` — do not attempt to type the ~70 wizard fields in this plan; that's a separate future spec.
- The admin client-detail page in `apps/web` is read-only — no edit/save UI in this plan.
- Tests never call the real Google Vision API — use the dependency-injection seam (same pattern as Fundación's `setGoogleVerifierForTests`). `pdf-parse` tests use a real local PDF fixture (no network).

---

## File Structure

```
apps/
  api/
    src/
      storage/
        index.ts                          ← NUEVO: wrapper sobre supabase-js Storage
      middleware/
        block-for-lead-wellness.ts         ← NUEVO
      services/
        personal-info.service.ts           ← NUEVO
        anthropometrics.service.ts          ← NUEVO
        photos.service.ts                   ← NUEVO
        inbody.service.ts                   ← NUEVO
        ocr.service.ts                       ← NUEVO
      controllers/
        personal-info.controller.ts
        anthropometrics.controller.ts
        photos.controller.ts
        inbody.controller.ts
        ocr.controller.ts
      routes/
        personal-info.routes.ts            ← monta las 4 áreas + ocr, todas bajo /api/clients
      models/schema.ts                     ← MODIFICAR: agregar 4 tablas
      app.ts                               ← MODIFICAR: montar personalInfoRouter
      db/index.ts                          ← sin cambios (ya existe)
    test/
      helpers/setupTestEnv.ts              ← MODIFICAR: exigir vars de Storage
      storage.test.ts
      personal-info.routes.test.ts
      anthropometrics.routes.test.ts
      photos.routes.test.ts
      inbody.routes.test.ts
      ocr.routes.test.ts
      fixtures/sample.pdf                  ← PDF real de prueba para pdf-parse
    .env.example / .env.test.example       ← MODIFICAR: agregar vars de Supabase Storage
  web/
    app/admin/clients/
      page.tsx                             ← MODIFICAR: agregar enlace "Ver detalle"
      [id]/page.tsx                        ← NUEVO
    lib/personal-info-client.ts            ← NUEVO
    test/client-detail-page.test.tsx       ← NUEVO
packages/
  shared-types/
    src/personal-info.ts                   ← NUEVO
    test/personal-info.test.ts             ← NUEVO
```

---

### Task 1: Drizzle schema + Storage module + bucket verification

**Files:**
- Modify: `apps/api/src/models/schema.ts`
- Create: `apps/api/src/storage/index.ts`
- Modify: `apps/api/test/helpers/setupTestEnv.ts`
- Modify: `apps/api/.env.example`, `apps/api/.env.test.example`
- Create: `apps/api/test/storage.test.ts`
- Modify: `apps/api/package.json` (add `@supabase/supabase-js`)

**Interfaces:**
- Produces: `personalInfo`, `anthropometricRecords`, `progressPhotos`, `bioInbodyRecords` Drizzle tables + `PersonalInfo`, `AnthropometricRecord`, `ProgressPhoto`, `BioInbodyRecord` types from `schema.ts`; `uploadFile(pathPrefix: string, buffer: Buffer, contentType: string, originalName: string): Promise<string>` from `storage/index.ts`. Consumed by every later task.

- [ ] **Step 1: Add the Supabase Storage env vars to the example files**

Append to `apps/api/.env.example`:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=latribu-files
```

Append the same three lines to `apps/api/.env.test.example`.

`apps/api/.env.test` (gitignored, real values) must be updated to add these
three keys before running this task's tests — reuse the exact
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` already in the repo root's
`.env.test` (same dedicated test Supabase project Fundación already uses,
just accessed via its REST/service-role credentials instead of the direct
Postgres connection this time), plus `SUPABASE_BUCKET=latribu-files`.

- [ ] **Step 2: Add `@supabase/supabase-js` to `apps/api/package.json`**

Add to the `dependencies` object (alphabetical order, matching the existing style):

```json
    "@supabase/supabase-js": "2.103.0",
```

Run `npm install` from the repo root afterward (npm workspaces).

- [ ] **Step 3: Write the failing Storage test**

`apps/api/test/storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { uploadFile } from '../src/storage/index.js';

describe('storage', () => {
  it('uploads a file to Supabase Storage and returns a public URL', async () => {
    const url = await uploadFile('test-uploads', Buffer.from('hello world'), 'text/plain', 'sample.txt');
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain('sample.txt');
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd apps/api && npx vitest run test/storage.test.ts`
Expected: FAIL — `Cannot find module '../src/storage/index.js'`

- [ ] **Step 5: Extend the Drizzle schema**

Add to `apps/api/src/models/schema.ts` (keep the existing `admins`/`clients`/`adminNotifications` tables and their imports untouched — only add to the import list and append these exports):

Add `numeric` to the existing `drizzle-orm/pg-core` import at the top of the file, so it reads:

```ts
import { pgTable, uuid, text, boolean, integer, date, jsonb, timestamp, numeric } from 'drizzle-orm/pg-core';
```

Append at the end of the file (after the existing `NewClient` type export):

```ts
export const personalInfo = pgTable('personal_info', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().unique().references(() => clients.id, { onDelete: 'cascade' }),
  birthdate: date('birthdate'),
  gender: text('gender'),
  occupation: text('occupation'),
  country: text('country'),
  city: text('city'),
  phoneCode: text('phone_code').default('+52'),
  phoneNumber: text('phone_number'),
  maritalStatus: text('marital_status'),
  weight: numeric('weight', { precision: 5, scale: 1, mode: 'number' }),
  height: numeric('height', { precision: 5, scale: 1, mode: 'number' }),
  bodyFat: numeric('body_fat', { precision: 4, scale: 1, mode: 'number' }),
  onboardingReport: jsonb('onboarding_report').default({}),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const anthropometricRecords = pgTable('anthropometric_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull().defaultNow(),
  semana: integer('semana'),
  mesNum: integer('mes_num'),
  peso: numeric('peso', { precision: 5, scale: 1, mode: 'number' }),
  cintura: numeric('cintura', { precision: 5, scale: 1, mode: 'number' }),
  brazos: numeric('brazos', { precision: 5, scale: 1, mode: 'number' }),
  hombros: numeric('hombros', { precision: 5, scale: 1, mode: 'number' }),
  piernas: numeric('piernas', { precision: 5, scale: 1, mode: 'number' }),
  gluteo: numeric('gluteo', { precision: 5, scale: 1, mode: 'number' }),
  notas: text('notas'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const progressPhotos = pgTable('progress_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  anthropometricRecordId: uuid('anthropometric_record_id').references(() => anthropometricRecords.id, { onDelete: 'cascade' }),
  angle: text('angle'),
  photoUrl: text('photo_url').notNull(),
  fecha: date('fecha').notNull().defaultNow(),
  mesNum: integer('mes_num'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const bioInbodyRecords = pgTable('bio_inbody_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fecha: date('fecha'),
  version: text('version'),
  pesoTotal: numeric('peso_total', { precision: 5, scale: 1, mode: 'number' }),
  smm: numeric('smm', { precision: 5, scale: 1, mode: 'number' }),
  grasaPct: numeric('grasa_pct', { precision: 4, scale: 1, mode: 'number' }),
  imc: numeric('imc', { precision: 4, scale: 1, mode: 'number' }),
  pesoObjetivo: numeric('peso_objetivo', { precision: 5, scale: 1, mode: 'number' }),
  grasaVisceral: numeric('grasa_visceral', { precision: 4, scale: 1, mode: 'number' }),
  bmr: numeric('bmr', { precision: 6, scale: 0, mode: 'number' }),
  anguloFase: numeric('angulo_fase', { precision: 4, scale: 2, mode: 'number' }),
  ecwTbw: numeric('ecw_tbw', { precision: 5, scale: 3, mode: 'number' }),
  masaOsea: numeric('masa_osea', { precision: 4, scale: 2, mode: 'number' }),
  altura: numeric('altura', { precision: 5, scale: 1, mode: 'number' }),
  mesNum: integer('mes_num'),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type PersonalInfo = typeof personalInfo.$inferSelect;
export type AnthropometricRecord = typeof anthropometricRecords.$inferSelect;
export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type BioInbodyRecord = typeof bioInbodyRecords.$inferSelect;
```

- [ ] **Step 6: Implement the Storage wrapper**

`apps/api/src/storage/index.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function requireSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_URL no está configurada. Es necesaria para subir archivos a Supabase Storage.'
    );
  }
  return url;
}

function requireSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está configurada. Es necesaria para subir archivos a Supabase Storage.'
    );
  }
  return key;
}

const BUCKET = process.env.SUPABASE_BUCKET || 'latribu-files';

const storageClient = createClient(requireSupabaseUrl(), requireSupabaseServiceRoleKey(), {
  auth: { persistSession: false },
});

export async function uploadFile(
  pathPrefix: string,
  buffer: Buffer,
  contentType: string,
  originalName: string
): Promise<string> {
  const filename = `${pathPrefix}/${randomUUID()}_${originalName}`;
  const { error } = await storageClient.storage.from(BUCKET).upload(filename, buffer, { contentType });
  if (error) throw error;
  const { data } = storageClient.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}
```

- [ ] **Step 7: Require the Storage env vars in the test-environment loader**

Modify `apps/api/test/helpers/setupTestEnv.ts` — change the existing required-vars check from:

```ts
if (!testEnv.TEST_DATABASE_URL || !testEnv.JWT_SECRET) {
  throw new Error('.env.test debe definir TEST_DATABASE_URL y JWT_SECRET.');
}
```

to:

```ts
if (!testEnv.TEST_DATABASE_URL || !testEnv.JWT_SECRET) {
  throw new Error('.env.test debe definir TEST_DATABASE_URL y JWT_SECRET.');
}
if (!testEnv.SUPABASE_URL || !testEnv.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('.env.test debe definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (para subir archivos de prueba a Supabase Storage).');
}
```

The rest of the file (the prod/test `TEST_DATABASE_URL` equality guard and the `for...of` loop copying `testEnv` into `process.env`) already copies every key present in `.env.test` — no other change needed, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_BUCKET` will reach `process.env` automatically.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run test/storage.test.ts` (from `apps/api`, after `apps/api/.env.test` has the 3 new keys per Step 1)
Expected: PASS (1 test)

- [ ] **Step 9: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from the Fundación migration plus this task's new test)

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/models/schema.ts apps/api/src/storage apps/api/test/helpers/setupTestEnv.ts apps/api/test/storage.test.ts apps/api/.env.example apps/api/.env.test.example apps/api/package.json
git commit -m "feat(info-personal): add Drizzle schema, Storage wrapper, and bucket verification"
```

---

### Task 2: Shared-types Zod schemas

**Files:**
- Create: `packages/shared-types/src/personal-info.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/test/personal-info.test.ts`

**Interfaces:**
- Produces: `PersonalInfoUpdateSchema`/`PersonalInfoUpdateInput`, `AnthropometricRecordInputSchema`/`AnthropometricRecordInput`, `PhotoUploadMetadataSchema`/`PhotoUploadMetadata`, `InbodyRecordInputSchema`/`InbodyRecordInput`, `OcrInputSchema`/`OcrInput`. Consumed by Tasks 3-7.

- [ ] **Step 1: Write the failing tests**

`packages/shared-types/test/personal-info.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PersonalInfoUpdateSchema,
  AnthropometricRecordInputSchema,
  PhotoUploadMetadataSchema,
  InbodyRecordInputSchema,
  OcrInputSchema,
} from '../src/personal-info.js';

describe('personal-info schemas', () => {
  it('accepts a partial personal-info update', () => {
    const result = PersonalInfoUpdateSchema.safeParse({ country: 'México', weight: 70.5, complete: true });
    expect(result.success).toBe(true);
  });

  it('accepts an empty personal-info update', () => {
    const result = PersonalInfoUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts onboarding_report as an opaque object', () => {
    const result = PersonalInfoUpdateSchema.safeParse({ onboarding_report: { work_hours: '8', proteins: ['Pollo', 'Huevo'] } });
    expect(result.success).toBe(true);
  });

  it('accepts a valid anthropometric record input', () => {
    const result = AnthropometricRecordInputSchema.safeParse({ fecha: '2026-01-01', peso: 70, mes_num: 1 });
    expect(result.success).toBe(true);
  });

  it('coerces numeric anthropometric fields from strings', () => {
    const result = AnthropometricRecordInputSchema.safeParse({ peso: '70.5' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.peso).toBe(70.5);
  });

  it('accepts a valid photo upload metadata input', () => {
    const result = PhotoUploadMetadataSchema.safeParse({ angle: 'frente', mes_num: 2 });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid photo angle', () => {
    const result = PhotoUploadMetadataSchema.safeParse({ angle: 'arriba' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid InBody record input', () => {
    const result = InbodyRecordInputSchema.safeParse({ fecha: '2026-01-01', peso_total: 70, smm: 30, grasa_pct: 15 });
    expect(result.success).toBe(true);
  });

  it('accepts a valid OCR input', () => {
    const result = OcrInputSchema.safeParse({ base64: 'JVBERi0xLjQK' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty OCR input', () => {
    const result = OcrInputSchema.safeParse({ base64: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/shared-types && npx vitest run test/personal-info.test.ts`
Expected: FAIL — `Cannot find module '../src/personal-info.js'`

- [ ] **Step 3: Implement `packages/shared-types/src/personal-info.ts`**

```ts
import { z } from 'zod';

export const PersonalInfoUpdateSchema = z.object({
  birthdate: z.string().date().optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  phone_code: z.string().optional(),
  phone_number: z.string().optional(),
  marital_status: z.string().optional(),
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  body_fat: z.coerce.number().optional(),
  onboarding_report: z.record(z.string(), z.unknown()).optional(),
  complete: z.boolean().optional(),
});
export type PersonalInfoUpdateInput = z.infer<typeof PersonalInfoUpdateSchema>;

export const AnthropometricRecordInputSchema = z.object({
  fecha: z.string().date().optional(),
  semana: z.coerce.number().int().optional(),
  mes_num: z.coerce.number().int().positive().optional(),
  peso: z.coerce.number().optional(),
  cintura: z.coerce.number().optional(),
  brazos: z.coerce.number().optional(),
  hombros: z.coerce.number().optional(),
  piernas: z.coerce.number().optional(),
  gluteo: z.coerce.number().optional(),
  notas: z.string().optional(),
});
export type AnthropometricRecordInput = z.infer<typeof AnthropometricRecordInputSchema>;

export const PhotoUploadMetadataSchema = z.object({
  angle: z.enum(['frente', 'lado_derecho', 'lado_izquierdo', 'espalda']).optional(),
  anthropometric_record_id: z.string().uuid().optional(),
  fecha: z.string().date().optional(),
  mes_num: z.coerce.number().int().positive().optional(),
});
export type PhotoUploadMetadata = z.infer<typeof PhotoUploadMetadataSchema>;

export const InbodyRecordInputSchema = z.object({
  fecha: z.string().date().optional(),
  version: z.string().optional(),
  peso_total: z.coerce.number().optional(),
  smm: z.coerce.number().optional(),
  grasa_pct: z.coerce.number().optional(),
  imc: z.coerce.number().optional(),
  peso_objetivo: z.coerce.number().optional(),
  grasa_visceral: z.coerce.number().optional(),
  bmr: z.coerce.number().optional(),
  angulo_fase: z.coerce.number().optional(),
  ecw_tbw: z.coerce.number().optional(),
  masa_osea: z.coerce.number().optional(),
  altura: z.coerce.number().optional(),
  mes_num: z.coerce.number().int().positive().optional(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
});
export type InbodyRecordInput = z.infer<typeof InbodyRecordInputSchema>;

export const OcrInputSchema = z.object({
  base64: z.string().min(1),
});
export type OcrInput = z.infer<typeof OcrInputSchema>;
```

- [ ] **Step 4: Re-export from the package index**

Modify `packages/shared-types/src/index.ts` to add a third line:

```ts
export * from './auth.js';
export * from './client.js';
export * from './personal-info.js';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run` (from `packages/shared-types`)
Expected: PASS (27 tests — 17 existing + 10 new)

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types
git commit -m "feat(info-personal): add shared Zod schemas for personal info, anthropometrics, photos, InBody, OCR"
```

---

### Task 3: `blockForLeadWellness` middleware + personal-info service/controller/routes

**Files:**
- Create: `apps/api/src/middleware/block-for-lead-wellness.ts`
- Create: `apps/api/src/services/personal-info.service.ts`
- Create: `apps/api/src/controllers/personal-info.controller.ts`
- Create: `apps/api/src/routes/personal-info.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/package.json` (add `multer`, `nodemailer`)
- Test: `apps/api/test/personal-info.routes.test.ts`

**Interfaces:**
- Consumes: `personalInfo`, `adminNotifications`, `Client` (Task 1); `PersonalInfoUpdateSchema`/`PersonalInfoUpdateInput` (Task 2); `authMiddleware`, `ownerOrAdmin` (Fundación); `findClientById` (Fundación's `clients.service.ts`); `uploadFile` (Task 1); `asyncHandler`, `validateBody` (Fundación).
- Produces: `blockForLeadWellness` middleware; `getPersonalInfoByClientId`, `upsertPersonalInfo`, `uploadCheckupFile`, `InvalidFileTypeError` from `personal-info.service.ts`. `personalInfoRouter` mounted at `/api/clients`. Later tasks (4-7) add their own routers mounted at the same prefix, and reuse `blockForLeadWellness`.

- [ ] **Step 1: Add `nodemailer` and `multer` to `apps/api/package.json`**

Add to `dependencies`:

```json
    "multer": "^2.2.0",
    "nodemailer": "^6.9.4",
```

Add to `devDependencies`:

```json
    "@types/multer": "^1.4.12",
    "@types/nodemailer": "^6.4.16",
```

Run `npm install` from the repo root.

- [ ] **Step 2: Implement the middleware**

`apps/api/src/middleware/block-for-lead-wellness.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';

// Información Personal (el onboarding de 9 módulos, incluida la composición
// corporal) requiere ser cliente de coaching — lead_wellness no tiene acceso.
export function blockForLeadWellness(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (req.client && req.client.clientType === 'lead_wellness') {
    return res.status(403).json({ success: false, error: 'Este módulo no está disponible para tu tipo de cuenta.' });
  }
  next();
}
```

- [ ] **Step 3: Write the failing route tests**

`apps/api/test/personal-info.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, adminNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('personal-info routes', () => {
  const app = createApp();
  let coachingClientId: string;
  let leadWellnessClientId: string;
  let coachingToken: string;
  let leadWellnessToken: string;

  beforeAll(async () => {
    const [coachingClient] = await db
      .insert(clients)
      .values({ name: 'Coaching Client', email: `coaching-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    coachingClientId = coachingClient.id;
    coachingToken = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching Client', email: coachingClient.email });

    const [leadClient] = await db
      .insert(clients)
      .values({ name: 'Lead Client', email: `lead-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'lead_wellness' })
      .returning();
    leadWellnessClientId = leadClient.id;
    leadWellnessToken = signToken({ id: leadWellnessClientId, role: 'cliente', name: 'Lead Client', email: leadClient.email });
  });

  afterAll(async () => {
    await db.delete(adminNotifications).where(eq(adminNotifications.clientId, coachingClientId));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    await db.delete(clients).where(eq(clients.id, coachingClientId));
    await db.delete(clients).where(eq(clients.id, leadWellnessClientId));
  });

  it('blocks a lead_wellness client from reading personal-info', async () => {
    const res = await request(app)
      .get(`/api/clients/${leadWellnessClientId}/personal-info`)
      .set('Authorization', `Bearer ${leadWellnessToken}`);
    expect(res.status).toBe(403);
  });

  it('returns an empty object when a coaching client has no personal-info row yet', async () => {
    const res = await request(app)
      .get(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`);
    expect(res.status).toBe(200);
    expect(res.body.personalInfo).toEqual({});
  });

  it('creates personal-info on first PUT and inserts an admin notification when complete', async () => {
    const res = await request(app)
      .put(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .send({ country: 'México', city: 'CDMX', weight: 70, complete: true });
    expect(res.status).toBe(200);
    expect(res.body.personalInfo.country).toBe('México');
    expect(res.body.personalInfo.completedAt).not.toBeNull();

    const notifications = await db.select().from(adminNotifications).where(eq(adminNotifications.clientId, coachingClientId));
    expect(notifications.some((n) => n.type === 'onboarding_complete')).toBe(true);
  });

  it('does not insert a second admin notification when already complete', async () => {
    await request(app)
      .put(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .send({ city: 'Guadalajara', complete: true });

    const notifications = await db
      .select()
      .from(adminNotifications)
      .where(eq(adminNotifications.clientId, coachingClientId));
    expect(notifications.filter((n) => n.type === 'onboarding_complete')).toHaveLength(1);
  });

  it('uploads a checkup file and merges its URL into onboarding_report', async () => {
    const res = await request(app)
      .post(`/api/clients/${coachingClientId}/personal-info-file`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .attach('checkup_file', Buffer.from('%PDF-1.4 fake'), { filename: 'checkup.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.file_url).toMatch(/^https:\/\//);

    const [info] = await db.select().from(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    expect((info.onboardingReport as Record<string, unknown>).checkup_file_url).toBe(res.body.file_url);
  });

  it('rejects a checkup file with an invalid mimetype', async () => {
    const res = await request(app)
      .post(`/api/clients/${coachingClientId}/personal-info-file`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .attach('checkup_file', Buffer.from('not a real gif'), { filename: 'checkup.gif', contentType: 'image/gif' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/personal-info.routes.test.ts`
Expected: FAIL — 404s, `personal-info.controller.js` does not exist

- [ ] **Step 5: Implement the personal-info service**

`apps/api/src/services/personal-info.service.ts`:

```ts
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { db } from '../db/index.js';
import { personalInfo, adminNotifications, type PersonalInfo } from '../models/schema.js';
import { findClientById } from './clients.service.js';
import { uploadFile } from '../storage/index.js';
import type { PersonalInfoUpdateInput } from '@latribu/shared-types';

export async function getPersonalInfoByClientId(clientId: string): Promise<PersonalInfo | null> {
  const rows = await db.select().from(personalInfo).where(eq(personalInfo.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

async function sendClientNotification(clientId: string, info: Pick<PersonalInfo, 'country' | 'city' | 'weight' | 'height'>): Promise<void> {
  const EMAIL_HOST = process.env.EMAIL_HOST;
  const EMAIL_PORT = process.env.EMAIL_PORT;
  const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;
  const EMAIL_FROM = process.env.NOTIFICATION_FROM || 'no-reply@latribu.com';
  const EMAIL_TO = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_TO || 'g619alejandro@gmail.com';

  const subject = `La Tribu: onboarding completado cliente ${clientId}`;
  const summary = [`<strong>ID:</strong> ${clientId}`];
  if (info.country) summary.push(`<strong>País:</strong> ${info.country}`);
  if (info.city) summary.push(`<strong>Ciudad:</strong> ${info.city}`);
  if (info.weight) summary.push(`<strong>Peso:</strong> ${info.weight}`);
  if (info.height) summary.push(`<strong>Altura:</strong> ${info.height}`);
  const html = `<p>El cliente ha completado el proceso de onboarding personal.</p><p>${summary.join('<br>')}</p>`;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.log('sendClientNotification: email config no disponible, se omite el envío.', { clientId });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT),
      secure: EMAIL_SECURE,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    await transporter.sendMail({ from: EMAIL_FROM, to: EMAIL_TO, subject, html });
  } catch (e) {
    console.error('sendClientNotification error', e);
  }
}

export async function upsertPersonalInfo(clientId: string, input: PersonalInfoUpdateInput): Promise<PersonalInfo> {
  const existing = await getPersonalInfoByClientId(clientId);
  const wasAlreadyComplete = !!(existing && existing.completedAt);

  // Zod (packages/shared-types) usa el mismo wire format snake_case que el
  // legacy (phone_code, body_fat, onboarding_report...); Drizzle espera las
  // propiedades camelCase declaradas en schema.ts. El mapeo debe ser
  // explícito — spreadear `input` directamente insertaría columnas nulas.
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.birthdate !== undefined) patch.birthdate = input.birthdate;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.occupation !== undefined) patch.occupation = input.occupation;
  if (input.country !== undefined) patch.country = input.country;
  if (input.city !== undefined) patch.city = input.city;
  if (input.phone_code !== undefined) patch.phoneCode = input.phone_code;
  if (input.phone_number !== undefined) patch.phoneNumber = input.phone_number;
  if (input.marital_status !== undefined) patch.maritalStatus = input.marital_status;
  if (input.weight !== undefined) patch.weight = input.weight;
  if (input.height !== undefined) patch.height = input.height;
  if (input.body_fat !== undefined) patch.bodyFat = input.body_fat;
  if (input.onboarding_report !== undefined) patch.onboardingReport = input.onboarding_report;
  if (input.complete) patch.completedAt = new Date();

  const [info] = await db
    .insert(personalInfo)
    .values({ clientId, ...patch })
    .onConflictDoUpdate({ target: personalInfo.clientId, set: patch })
    .returning();

  if (complete) {
    await sendClientNotification(clientId, info);
    if (!wasAlreadyComplete) {
      const client = await findClientById(clientId);
      await db.insert(adminNotifications).values({
        clientId,
        type: 'onboarding_complete',
        message: `${client ? client.name : 'Un cliente'} completó su información personal.`,
      });
    }
  }

  return info;
}

export class InvalidFileTypeError extends Error {
  constructor() {
    super('Formato inválido. Usa PDF o JPG/PNG.');
    this.name = 'InvalidFileTypeError';
  }
}

const ALLOWED_CHECKUP_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export async function uploadCheckupFile(
  clientId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string },
  onboardingReportRaw: unknown
): Promise<{ file_url: string; file_name: string; uploaded_at: string }> {
  if (!ALLOWED_CHECKUP_MIMETYPES.includes(file.mimetype)) {
    throw new InvalidFileTypeError();
  }
  const fileUrl = await uploadFile(`${clientId}/checkups`, file.buffer, file.mimetype, file.originalname);

  let report: Record<string, unknown> = {};
  if (onboardingReportRaw && typeof onboardingReportRaw === 'object') {
    report = onboardingReportRaw as Record<string, unknown>;
  } else if (typeof onboardingReportRaw === 'string') {
    try {
      report = JSON.parse(onboardingReportRaw);
    } catch {
      report = {};
    }
  }

  const uploadedAt = new Date().toISOString();
  const mergedReport = { ...report, checkup_file_url: fileUrl, checkup_file_name: file.originalname, checkup_uploaded_at: uploadedAt };

  await db
    .insert(personalInfo)
    .values({ clientId, onboardingReport: mergedReport })
    .onConflictDoUpdate({ target: personalInfo.clientId, set: { onboardingReport: mergedReport, updatedAt: new Date() } });

  return { file_url: fileUrl, file_name: file.originalname, uploaded_at: uploadedAt };
}
```

- [ ] **Step 6: Implement the personal-info controller**

`apps/api/src/controllers/personal-info.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { PersonalInfoUpdateInput } from '@latribu/shared-types';
import * as personalInfoService from '../services/personal-info.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function getPersonalInfo(req: Request, res: Response) {
  const info = await personalInfoService.getPersonalInfoByClientId(req.params.id);
  return ok(res, { personalInfo: info || {} });
}

export async function putPersonalInfo(req: Request, res: Response) {
  const input = req.body as PersonalInfoUpdateInput;
  const info = await personalInfoService.upsertPersonalInfo(req.params.id, input);
  return ok(res, { personalInfo: info });
}

export async function uploadPersonalInfoFile(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  try {
    const result = await personalInfoService.uploadCheckupFile(req.params.id, req.file, req.body.onboarding_report);
    return ok(res, result);
  } catch (e) {
    if (e instanceof personalInfoService.InvalidFileTypeError) return err(res, e.message, 400);
    throw e;
  }
}
```

- [ ] **Step 7: Implement the personal-info routes**

`apps/api/src/routes/personal-info.routes.ts`:

```ts
import { Router } from 'express';
import multer from 'multer';
import { PersonalInfoUpdateSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { blockForLeadWellness } from '../middleware/block-for-lead-wellness.js';
import * as personalInfoController from '../controllers/personal-info.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const personalInfoRouter = Router();

personalInfoRouter.get(
  '/:id/personal-info',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(personalInfoController.getPersonalInfo)
);

personalInfoRouter.put(
  '/:id/personal-info',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(PersonalInfoUpdateSchema),
  asyncHandler(personalInfoController.putPersonalInfo)
);

personalInfoRouter.post(
  '/:id/personal-info-file',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  upload.single('checkup_file'),
  asyncHandler(personalInfoController.uploadPersonalInfoFile)
);
```

- [ ] **Step 8: Mount the router in `app.ts`**

Modify `apps/api/src/app.ts` — add `import { personalInfoRouter } from './routes/personal-info.routes.js';` to the imports, and add this line right after `app.use('/api/clients', clientsRouter);`:

```ts
  app.use('/api/clients', personalInfoRouter);
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run test/personal-info.routes.test.ts` (from `apps/api`)
Expected: PASS (6 tests)

- [ ] **Step 10: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from Fundación plus Tasks 1-3 of this plan)

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/middleware/block-for-lead-wellness.ts apps/api/src/services/personal-info.service.ts apps/api/src/controllers/personal-info.controller.ts apps/api/src/routes/personal-info.routes.ts apps/api/src/app.ts apps/api/package.json apps/api/test/personal-info.routes.test.ts
git commit -m "feat(info-personal): add personal-info routes with file upload and completion notifications"
```

---

### Task 4: Anthropometrics routes

**Files:**
- Create: `apps/api/src/services/anthropometrics.service.ts`
- Create: `apps/api/src/controllers/anthropometrics.controller.ts`
- Modify: `apps/api/src/routes/personal-info.routes.ts`
- Test: `apps/api/test/anthropometrics.routes.test.ts`

**Interfaces:**
- Consumes: `anthropometricRecords`, `AnthropometricRecord` (Task 1); `AnthropometricRecordInputSchema`/`AnthropometricRecordInput` (Task 2); `authMiddleware`, `ownerOrAdmin`, `blockForLeadWellness` (Task 3).
- Produces: `listAnthropometrics`, `createOrUpdateAnthropometric`, `deleteAnthropometric` on `anthropometrics.service.ts`. No further consumers within this plan.

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/anthropometrics.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, anthropometricRecords } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('anthropometrics routes', () => {
  const app = createApp();
  let clientId: string;
  let token: string;
  let firstRecordId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Anthro Client', email: `anthro-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    token = signToken({ id: clientId, role: 'cliente', name: 'Anthro Client', email: client.email });
  });

  afterAll(async () => {
    await db.delete(anthropometricRecords).where(eq(anthropometricRecords.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('creates a new anthropometric record', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/anthropometrics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-01-01', peso: 70, cintura: 80, mes_num: 1 });
    expect(res.status).toBe(201);
    expect(res.body.record.peso).toBe(70);
    firstRecordId = res.body.record.id;
  });

  it('updates the same month instead of creating a duplicate', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/anthropometrics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-01-15', peso: 69, mes_num: 1 });
    expect(res.status).toBe(200);
    expect(res.body.record.id).toBe(firstRecordId);
    expect(res.body.record.peso).toBe(69);
  });

  it('creates a separate record for a different month', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/anthropometrics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-02-01', peso: 68, mes_num: 2 });
    expect(res.status).toBe(201);
    expect(res.body.record.id).not.toBe(firstRecordId);
  });

  it('lists all anthropometric records for a client', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/anthropometrics`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
  });

  it('deletes a record', async () => {
    const res = await request(app).delete(`/api/clients/${clientId}/anthropometrics/${firstRecordId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const remaining = await db.select().from(anthropometricRecords).where(eq(anthropometricRecords.id, firstRecordId));
    expect(remaining).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/anthropometrics.routes.test.ts`
Expected: FAIL — 404s

- [ ] **Step 3: Implement the anthropometrics service**

`apps/api/src/services/anthropometrics.service.ts`:

```ts
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { anthropometricRecords, type AnthropometricRecord } from '../models/schema.js';
import type { AnthropometricRecordInput } from '@latribu/shared-types';

export async function listAnthropometrics(clientId: string): Promise<AnthropometricRecord[]> {
  return db
    .select()
    .from(anthropometricRecords)
    .where(eq(anthropometricRecords.clientId, clientId))
    .orderBy(asc(anthropometricRecords.fecha));
}

export async function createOrUpdateAnthropometric(
  clientId: string,
  input: AnthropometricRecordInput
): Promise<{ record: AnthropometricRecord; status: 200 | 201 }> {
  const fecha = input.fecha || new Date().toISOString().slice(0, 10);
  const fields = {
    fecha,
    semana: input.semana,
    peso: input.peso,
    cintura: input.cintura,
    brazos: input.brazos,
    hombros: input.hombros,
    piernas: input.piernas,
    gluteo: input.gluteo,
    notas: input.notas,
  };

  if (input.mes_num !== undefined) {
    const existingRows = await db
      .select()
      .from(anthropometricRecords)
      .where(and(eq(anthropometricRecords.clientId, clientId), eq(anthropometricRecords.mesNum, input.mes_num)))
      .limit(1);
    const existing = existingRows[0];
    if (existing) {
      const [updated] = await db
        .update(anthropometricRecords)
        .set(fields)
        .where(eq(anthropometricRecords.id, existing.id))
        .returning();
      return { record: updated, status: 200 };
    }
  }

  const [inserted] = await db
    .insert(anthropometricRecords)
    .values({ clientId, mesNum: input.mes_num, ...fields })
    .returning();
  return { record: inserted, status: 201 };
}

export async function deleteAnthropometric(recordId: string): Promise<void> {
  await db.delete(anthropometricRecords).where(eq(anthropometricRecords.id, recordId));
}
```

- [ ] **Step 4: Implement the anthropometrics controller**

`apps/api/src/controllers/anthropometrics.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { AnthropometricRecordInput } from '@latribu/shared-types';
import * as anthropometricsService from '../services/anthropometrics.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function listAnthropometrics(req: Request, res: Response) {
  const records = await anthropometricsService.listAnthropometrics(req.params.id);
  return ok(res, { records });
}

export async function createOrUpdateAnthropometric(req: Request, res: Response) {
  const input = req.body as AnthropometricRecordInput;
  const { record, status } = await anthropometricsService.createOrUpdateAnthropometric(req.params.id, input);
  return ok(res, { record }, status);
}

export async function deleteAnthropometric(req: Request, res: Response) {
  await anthropometricsService.deleteAnthropometric(req.params.recordId);
  return ok(res, { message: 'Registro eliminado.' });
}
```

- [ ] **Step 5: Append the anthropometrics routes**

Append to `apps/api/src/routes/personal-info.routes.ts` (add `AnthropometricRecordInputSchema` to the existing `@latribu/shared-types` import, and `import * as anthropometricsController from '../controllers/anthropometrics.controller.js';`):

```ts
personalInfoRouter.get(
  '/:id/anthropometrics',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(anthropometricsController.listAnthropometrics)
);

personalInfoRouter.post(
  '/:id/anthropometrics',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(AnthropometricRecordInputSchema),
  asyncHandler(anthropometricsController.createOrUpdateAnthropometric)
);

personalInfoRouter.delete(
  '/:id/anthropometrics/:recordId',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(anthropometricsController.deleteAnthropometric)
);
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run test/anthropometrics.routes.test.ts` (from `apps/api`)
Expected: PASS (5 tests)

- [ ] **Step 7: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/anthropometrics.service.ts apps/api/src/controllers/anthropometrics.controller.ts apps/api/src/routes/personal-info.routes.ts apps/api/test/anthropometrics.routes.test.ts
git commit -m "feat(info-personal): add anthropometrics routes"
```

---

### Task 5: Photos routes

**Files:**
- Create: `apps/api/src/services/photos.service.ts`
- Create: `apps/api/src/controllers/photos.controller.ts`
- Modify: `apps/api/src/routes/personal-info.routes.ts`
- Test: `apps/api/test/photos.routes.test.ts`

**Interfaces:**
- Consumes: `progressPhotos`, `ProgressPhoto` (Task 1); `PhotoUploadMetadataSchema`/`PhotoUploadMetadata` (Task 2); `uploadFile` (Task 1); `authMiddleware`, `ownerOrAdmin`, `blockForLeadWellness` (Task 3).
- Produces: `listPhotos`, `createPhoto` on `photos.service.ts`. No further consumers within this plan.

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/photos.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, progressPhotos } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('photos routes', () => {
  const app = createApp();
  let clientId: string;
  let token: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Photo Client', email: `photo-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    token = signToken({ id: clientId, role: 'cliente', name: 'Photo Client', email: client.email });
  });

  afterAll(async () => {
    await db.delete(progressPhotos).where(eq(progressPhotos.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('uploads a progress photo', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .field('angle', 'frente')
      .field('fecha', '2026-01-01')
      .attach('photo', Buffer.from('fake image bytes'), { filename: 'front.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.photo.photoUrl).toMatch(/^https:\/\//);
    expect(res.body.photo.angle).toBe('frente');
  });

  it('rejects an upload with no file', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .field('angle', 'frente');
    expect(res.status).toBe(400);
  });

  it('lists photos for a client', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/photos`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.photos.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/photos.routes.test.ts`
Expected: FAIL — 404s

- [ ] **Step 3: Implement the photos service**

`apps/api/src/services/photos.service.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { progressPhotos, type ProgressPhoto } from '../models/schema.js';
import { uploadFile } from '../storage/index.js';
import type { PhotoUploadMetadata } from '@latribu/shared-types';

export async function listPhotos(clientId: string): Promise<ProgressPhoto[]> {
  return db.select().from(progressPhotos).where(eq(progressPhotos.clientId, clientId)).orderBy(desc(progressPhotos.fecha));
}

export async function createPhoto(
  clientId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string },
  metadata: PhotoUploadMetadata
): Promise<ProgressPhoto> {
  const photoUrl = await uploadFile(`${clientId}/photos`, file.buffer, file.mimetype, file.originalname);
  const [photo] = await db
    .insert(progressPhotos)
    .values({
      clientId,
      anthropometricRecordId: metadata.anthropometric_record_id ?? null,
      angle: metadata.angle || 'frente',
      photoUrl,
      fecha: metadata.fecha || new Date().toISOString().slice(0, 10),
      mesNum: metadata.mes_num,
    })
    .returning();
  return photo;
}
```

- [ ] **Step 4: Implement the photos controller**

`apps/api/src/controllers/photos.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { PhotoUploadMetadata } from '@latribu/shared-types';
import * as photosService from '../services/photos.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listPhotos(req: Request, res: Response) {
  const photos = await photosService.listPhotos(req.params.id);
  return ok(res, { photos });
}

export async function createPhoto(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ninguna foto.');
  const metadata = req.body as PhotoUploadMetadata;
  const photo = await photosService.createPhoto(req.params.id, req.file, metadata);
  return ok(res, { photo }, 201);
}
```

- [ ] **Step 5: Append the photos routes**

Append to `apps/api/src/routes/personal-info.routes.ts` (add `PhotoUploadMetadataSchema` to the existing `@latribu/shared-types` import, `import * as photosController from '../controllers/photos.controller.js';`):

```ts
personalInfoRouter.post(
  '/:id/photos',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  upload.single('photo'),
  validateBody(PhotoUploadMetadataSchema),
  asyncHandler(photosController.createPhoto)
);

personalInfoRouter.get(
  '/:id/photos',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(photosController.listPhotos)
);
```

Multer runs before `validateBody` so that `req.body`'s text fields (populated by `multer` from the multipart form) are present when Zod validates them.

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run test/photos.routes.test.ts` (from `apps/api`)
Expected: PASS (3 tests)

- [ ] **Step 7: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/photos.service.ts apps/api/src/controllers/photos.controller.ts apps/api/src/routes/personal-info.routes.ts apps/api/test/photos.routes.test.ts
git commit -m "feat(info-personal): add progress photos routes"
```

---

### Task 6: InBody routes

**Files:**
- Create: `apps/api/src/services/inbody.service.ts`
- Create: `apps/api/src/controllers/inbody.controller.ts`
- Modify: `apps/api/src/routes/personal-info.routes.ts`
- Test: `apps/api/test/inbody.routes.test.ts`

**Interfaces:**
- Consumes: `bioInbodyRecords`, `BioInbodyRecord` (Task 1); `InbodyRecordInputSchema`/`InbodyRecordInput` (Task 2); `uploadFile` (Task 1); `findClientById`, `updateClient` (Fundación's `clients.service.ts`); `authMiddleware`, `ownerOrAdmin`, `blockForLeadWellness` (Task 3).
- Produces: `listInbodyRecords`, `createInbodyRecord`, `uploadInbodyFile` on `inbody.service.ts`. No further consumers within this plan.

- [ ] **Step 1: Write the failing route tests**

`apps/api/test/inbody.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, bioInbodyRecords } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('inbody routes', () => {
  const app = createApp();
  let clientId: string;
  let token: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Inbody Client',
        email: `inbody-${Date.now()}@example.com`,
        passwordHash: 'x',
        clientType: 'coaching_1_1',
        inbodyCadenceType: 'mensual',
      })
      .returning();
    clientId = client.id;
    token = signToken({ id: clientId, role: 'cliente', name: 'Inbody Client', email: client.email });
  });

  afterAll(async () => {
    await db.delete(bioInbodyRecords).where(eq(bioInbodyRecords.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('uploads an InBody file', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/inbody-upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake pdf bytes'), { filename: 'inbody.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.file_url).toMatch(/^https:\/\//);
  });

  it('creates an InBody record and recalculates the next expected date for a mensual cadence', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/inbody-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-01-01', peso_total: 70, smm: 30, grasa_pct: 15 });
    expect(res.status).toBe(201);
    expect(res.body.record.pesoTotal).toBe(70);

    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(updatedClient.inbodyNextExpectedDate).toBe('2026-02-01');
    expect(updatedClient.inbodyReminderSentThisCycle).toBe(false);
  });

  it('lists InBody records for a client', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/inbody-records`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/inbody.routes.test.ts`
Expected: FAIL — 404s

- [ ] **Step 3: Implement the InBody service**

`apps/api/src/services/inbody.service.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bioInbodyRecords, type BioInbodyRecord } from '../models/schema.js';
import { findClientById, updateClient } from './clients.service.js';
import { uploadFile } from '../storage/index.js';
import type { InbodyRecordInput } from '@latribu/shared-types';

export async function listInbodyRecords(clientId: string): Promise<BioInbodyRecord[]> {
  return db.select().from(bioInbodyRecords).where(eq(bioInbodyRecords.clientId, clientId)).orderBy(asc(bioInbodyRecords.fecha));
}

export async function createInbodyRecord(clientId: string, input: InbodyRecordInput): Promise<BioInbodyRecord> {
  const fecha = input.fecha || new Date().toISOString().slice(0, 10);

  // Zod (packages/shared-types) usa el mismo wire format snake_case que el
  // legacy (peso_total, grasa_pct, ecw_tbw...); Drizzle espera las
  // propiedades camelCase declaradas en schema.ts. El mapeo debe ser
  // explícito — spreadear `input` directamente insertaría columnas nulas.
  const [record] = await db
    .insert(bioInbodyRecords)
    .values({
      clientId,
      fecha,
      version: input.version,
      pesoTotal: input.peso_total,
      smm: input.smm,
      grasaPct: input.grasa_pct,
      imc: input.imc,
      pesoObjetivo: input.peso_objetivo,
      grasaVisceral: input.grasa_visceral,
      bmr: input.bmr,
      anguloFase: input.angulo_fase,
      ecwTbw: input.ecw_tbw,
      masaOsea: input.masa_osea,
      altura: input.altura,
      mesNum: input.mes_num,
      fileUrl: input.file_url,
      fileName: input.file_name,
    })
    .returning();

  // Recalcula la próxima fecha esperada y reinicia el aviso de recordatorio
  // solo para cadencias regulares — "personalizado" no tiene un intervalo
  // fijo, así que el admin la ajusta a mano en la ficha del cliente.
  const client = await findClientById(clientId);
  if (client && (client.inbodyCadenceType === 'mensual' || client.inbodyCadenceType === 'bimestral')) {
    const monthsToAdd = client.inbodyCadenceType === 'bimestral' ? 2 : 1;
    const nextDate = new Date(`${fecha}T00:00:00`);
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    await updateClient(clientId, {
      inbodyNextExpectedDate: nextDate.toISOString().slice(0, 10),
      inbodyReminderSentThisCycle: false,
    });
  }

  return record;
}

export async function uploadInbodyFile(
  clientId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<{ file_url: string; file_name: string }> {
  const fileUrl = await uploadFile(`${clientId}/inbody`, file.buffer, file.mimetype, file.originalname);
  return { file_url: fileUrl, file_name: file.originalname };
}
```

- [ ] **Step 4: Implement the InBody controller**

`apps/api/src/controllers/inbody.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { InbodyRecordInput } from '@latribu/shared-types';
import * as inbodyService from '../services/inbody.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listInbodyRecords(req: Request, res: Response) {
  const records = await inbodyService.listInbodyRecords(req.params.id);
  return ok(res, { records });
}

export async function createInbodyRecord(req: Request, res: Response) {
  const input = req.body as InbodyRecordInput;
  const record = await inbodyService.createInbodyRecord(req.params.id, input);
  return ok(res, { record }, 201);
}

export async function uploadInbodyFile(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  const result = await inbodyService.uploadInbodyFile(req.params.id, req.file);
  return ok(res, result);
}
```

- [ ] **Step 5: Append the InBody routes**

Append to `apps/api/src/routes/personal-info.routes.ts` (add `InbodyRecordInputSchema` to the existing `@latribu/shared-types` import, `import * as inbodyController from '../controllers/inbody.controller.js';`):

```ts
personalInfoRouter.get(
  '/:id/inbody-records',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(inbodyController.listInbodyRecords)
);

personalInfoRouter.post(
  '/:id/inbody-records',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(InbodyRecordInputSchema),
  asyncHandler(inbodyController.createInbodyRecord)
);

personalInfoRouter.post(
  '/:id/inbody-upload',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  upload.single('file'),
  asyncHandler(inbodyController.uploadInbodyFile)
);
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run test/inbody.routes.test.ts` (from `apps/api`)
Expected: PASS (3 tests)

- [ ] **Step 7: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/inbody.service.ts apps/api/src/controllers/inbody.controller.ts apps/api/src/routes/personal-info.routes.ts apps/api/test/inbody.routes.test.ts
git commit -m "feat(info-personal): add InBody records routes with cadence recalculation"
```

---

### Task 7: OCR routes

**Files:**
- Create: `apps/api/src/services/ocr.service.ts`
- Create: `apps/api/src/controllers/ocr.controller.ts`
- Modify: `apps/api/src/routes/personal-info.routes.ts`
- Modify: `apps/api/package.json` (add `pdf-parse`)
- Test: `apps/api/test/ocr.routes.test.ts`
- Test fixture: `apps/api/test/fixtures/sample.pdf`

**Interfaces:**
- Consumes: `OcrInputSchema`/`OcrInput` (Task 2); `authMiddleware`, `ownerOrAdmin`, `blockForLeadWellness` (Task 3).
- Produces: `extractText(base64): Promise<{text: string; source: 'vision' | 'pdf-parse'}>` and `setVisionCallerForTests(caller | null)` from `ocr.service.ts`. No further consumers within this plan.

- [ ] **Step 1: Add `pdf-parse` to `apps/api/package.json`**

Add to `dependencies`:

```json
    "pdf-parse": "^1.1.1",
```

Add to `devDependencies`:

```json
    "@types/pdf-parse": "^1.1.4",
```

Run `npm install` from the repo root.

- [ ] **Step 2: Create a real one-page test PDF fixture**

`apps/api/test/fixtures/sample.pdf` must be a real, valid, tiny PDF containing extractable text (e.g. the single line "INBODY TEST REPORT"). Generate one from the command line rather than hand-authoring binary content:

Run:
```bash
cd apps/api
node -e "
const { PDFDocument, StandardFonts } = require('pdf-lib');
(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 100]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('INBODY TEST REPORT', { x: 10, y: 50, size: 12, font });
  const bytes = await doc.save();
  require('fs').writeFileSync('test/fixtures/sample.pdf', bytes);
})();
"
```

This one-off script needs `pdf-lib` as a temporary devDependency to generate
the fixture: run `npm install --no-save pdf-lib` from `apps/api` first, run
the script above, then confirm `test/fixtures/sample.pdf` exists and is a
few KB. `pdf-lib` does not need to stay in `package.json` — it was only a
fixture-generation tool, not a runtime or test dependency.

- [ ] **Step 3: Write the failing OCR tests**

`apps/api/test/ocr.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import { setVisionCallerForTests } from '../src/services/ocr.service.js';

// Módulos ESM no tienen __dirname — mismo patrón que test/helpers/setupTestEnv.ts.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePdfBase64 = fs.readFileSync(path.join(__dirname, 'fixtures/sample.pdf')).toString('base64');

describe('POST /api/clients/:id/ocr-vision', () => {
  const app = createApp();
  let clientId: string;
  let token: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'OCR Client', email: `ocr-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    token = signToken({ id: clientId, role: 'cliente', name: 'OCR Client', email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  beforeEach(() => {
    setVisionCallerForTests(null);
  });

  it('extracts text from a PDF using pdf-parse, never calling Vision', async () => {
    setVisionCallerForTests(async () => {
      throw new Error('Vision API should not be called when pdf-parse succeeds');
    });
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: samplePdfBase64 });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('pdf-parse');
    expect(res.body.text).toContain('INBODY TEST REPORT');
  });

  it('calls the injected Vision caller for a non-PDF image and returns its text', async () => {
    process.env.GOOGLE_VISION_API_KEY = 'test-key';
    setVisionCallerForTests(async () => 'texto extraído de la imagen');
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: 'aW1hZ2Vub3RhcGRm' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('vision');
    expect(res.body.text).toBe('texto extraído de la imagen');
    delete process.env.GOOGLE_VISION_API_KEY;
  });

  it('returns 501 for a non-PDF image when Vision is not configured', async () => {
    delete process.env.GOOGLE_VISION_API_KEY;
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: 'aW1hZ2Vub3RhcGRm' });
    expect(res.status).toBe(501);
  });

  it('rejects an empty base64 payload', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: '' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/ocr.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/services/ocr.service.js'`

- [ ] **Step 5: Implement the OCR service**

`apps/api/src/services/ocr.service.ts`:

```ts
import pdfParse from 'pdf-parse';

export type VisionCaller = (base64: string, apiKey: string) => Promise<string>;

let visionCallerOverride: VisionCaller | null = null;

// Permite a los tests sustituir la llamada real a Google Vision (que
// requiere red y una API key real) por un doble de prueba determinista.
export function setVisionCallerForTests(caller: VisionCaller | null): void {
  visionCallerOverride = caller;
}

async function callVisionApi(base64: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }],
    }),
  });
  const parsed = await res.json();
  if (res.status === 401) throw new Error('AUTH_ERROR');
  if (res.status === 403) throw new Error('FORBIDDEN: Cloud Vision API no habilitada o sin permiso.');
  if (res.status !== 200) {
    const msg = parsed.error?.message || parsed.error?.status || `Vision API error ${res.status}`;
    if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('api key')) {
      throw new Error(`API_KEY_ERROR: ${msg}`);
    }
    throw new Error(msg);
  }
  return parsed.responses?.[0]?.fullTextAnnotation?.text || '';
}

async function pdfFallback(base64: string): Promise<string> {
  const buf = Buffer.from(base64, 'base64');
  const versions = ['v1.10.100', 'v1.9.426', 'default'] as const;
  let lastErr: unknown;
  for (const version of versions) {
    try {
      const data = await pdfParse(buf, { version });
      if (data.text && data.text.trim()) return data.text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No se pudo extraer texto del PDF.');
}

export type OcrResult = { text: string; source: 'vision' | 'pdf-parse' };

export class FileTooLargeError extends Error {
  constructor() {
    super('La imagen excede 8 MB. Comprime la foto antes de subirla.');
    this.name = 'FileTooLargeError';
  }
}
export class ApiKeyError extends Error {
  constructor() {
    super('Google Vision API key vencida o inválida.');
    this.name = 'ApiKeyError';
  }
}
export class VisionApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisionApiError';
  }
}
export class VisionNotConfiguredError extends Error {
  constructor() {
    super('GOOGLE_VISION_API_KEY no está configurada en el servidor.');
    this.name = 'VisionNotConfiguredError';
  }
}

export async function extractText(base64: string): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  const isPdf = base64.startsWith('JVBERi0');
  const sizeKB = Math.round((base64.length * 0.75) / 1024);
  if (sizeKB > 8000) throw new FileTooLargeError();

  if (isPdf) {
    try {
      const quickText = await pdfFallback(base64);
      if (quickText && quickText.trim()) return { text: quickText, source: 'pdf-parse' };
    } catch {
      // sigue a Vision API
    }
  }

  if (apiKey) {
    try {
      const caller = visionCallerOverride ?? callVisionApi;
      const text = await caller(base64, apiKey);
      if (text && text.trim()) return { text, source: 'vision' };
      if (!isPdf) return { text: '', source: 'vision' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.startsWith('API_KEY_ERROR')) throw new ApiKeyError();
      const fallbackable =
        isPdf && (msg === 'AUTH_ERROR' || msg === 'TIMEOUT' || msg.includes('BILLING') || msg.includes('QUOTA') || msg.includes('RESOURCE_EXHAUSTED'));
      if (!fallbackable) throw new VisionApiError(msg || 'Error al procesar el archivo.');
    }
  } else if (!isPdf) {
    throw new VisionNotConfiguredError();
  }

  const text = await pdfFallback(base64);
  return { text, source: 'pdf-parse' };
}
```

- [ ] **Step 6: Implement the OCR controller**

`apps/api/src/controllers/ocr.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { OcrInput } from '@latribu/shared-types';
import * as ocrService from '../services/ocr.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function ocrVision(req: Request, res: Response) {
  const { base64 } = req.body as OcrInput;
  try {
    const result = await ocrService.extractText(base64);
    return ok(res, result);
  } catch (e) {
    if (e instanceof ocrService.FileTooLargeError) return err(res, e.message, 413);
    if (e instanceof ocrService.ApiKeyError) return err(res, e.message, 401);
    if (e instanceof ocrService.VisionNotConfiguredError) return err(res, e.message, 501);
    if (e instanceof ocrService.VisionApiError) return err(res, e.message, 500);
    throw e;
  }
}
```

- [ ] **Step 7: Append the OCR route**

Append to `apps/api/src/routes/personal-info.routes.ts` (add `OcrInputSchema` to the existing `@latribu/shared-types` import, `import * as ocrController from '../controllers/ocr.controller.js';`):

```ts
personalInfoRouter.post(
  '/:id/ocr-vision',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(OcrInputSchema),
  asyncHandler(ocrController.ocrVision)
);
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run test/ocr.routes.test.ts` (from `apps/api`)
Expected: PASS (4 tests)

- [ ] **Step 9: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from Fundación plus all 7 tasks of this plan)

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/services/ocr.service.ts apps/api/src/controllers/ocr.controller.ts apps/api/src/routes/personal-info.routes.ts apps/api/package.json apps/api/test/ocr.routes.test.ts apps/api/test/fixtures/sample.pdf
git commit -m "feat(info-personal): add OCR routes with a test-injectable Vision caller"
```

---

### Task 8: Admin client-detail page

**Files:**
- Create: `apps/web/lib/personal-info-client.ts`
- Create: `apps/web/app/admin/clients/[id]/page.tsx`
- Modify: `apps/web/app/admin/clients/page.tsx`
- Test: `apps/web/test/client-detail-page.test.tsx`

**Interfaces:**
- Consumes: `getSessionToken` (Fundación's `lib/api-client.ts`).

- [ ] **Step 1: Write the failing test**

`apps/web/test/client-detail-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientDetailPage from '../app/admin/clients/[id]/page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'client-1' }),
}));

vi.mock('../lib/personal-info-client', () => ({
  getPersonalInfo: vi.fn(async () => ({ country: 'México', city: 'CDMX', weight: 70, height: 175 })),
  getAnthropometrics: vi.fn(async () => [{ id: 'a1', fecha: '2026-01-01', peso: 70, cintura: 80 }]),
  getPhotos: vi.fn(async () => []),
  getInbodyRecords: vi.fn(async () => [{ id: 'i1', fecha: '2026-01-01', pesoTotal: 70, grasaPct: 15 }]),
}));

describe('ClientDetailPage', () => {
  it('renders personal info, anthropometric history, and InBody records', async () => {
    render(<ClientDetailPage />);
    expect(await screen.findByText('México')).toBeInTheDocument();
    expect(screen.getByText('CDMX')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run test/client-detail-page.test.tsx`
Expected: FAIL — `Cannot find module '../lib/personal-info-client'` / `'../app/admin/clients/[id]/page'`

- [ ] **Step 3: Implement the personal-info API client**

`apps/web/lib/personal-info-client.ts`:

```ts
import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export type PersonalInfo = {
  country: string | null;
  city: string | null;
  weight: number | null;
  height: number | null;
};

export type AnthropometricRecord = {
  id: string;
  fecha: string;
  peso: number | null;
  cintura: number | null;
};

export type ProgressPhoto = {
  id: string;
  angle: string | null;
  photoUrl: string;
  fecha: string;
};

export type InbodyRecord = {
  id: string;
  fecha: string | null;
  pesoTotal: number | null;
  grasaPct: number | null;
};

async function authorizedGet<T>(path: string): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function getPersonalInfo(clientId: string): Promise<PersonalInfo> {
  const body = await authorizedGet<{ success: boolean; personalInfo: PersonalInfo; error?: string }>(`/api/clients/${clientId}/personal-info`);
  if (!body.success) throw new Error(body.error || 'Error al obtener información personal.');
  return body.personalInfo;
}

export async function getAnthropometrics(clientId: string): Promise<AnthropometricRecord[]> {
  const body = await authorizedGet<{ success: boolean; records: AnthropometricRecord[]; error?: string }>(`/api/clients/${clientId}/anthropometrics`);
  if (!body.success) throw new Error(body.error || 'Error al obtener medidas.');
  return body.records;
}

export async function getPhotos(clientId: string): Promise<ProgressPhoto[]> {
  const body = await authorizedGet<{ success: boolean; photos: ProgressPhoto[]; error?: string }>(`/api/clients/${clientId}/photos`);
  if (!body.success) throw new Error(body.error || 'Error al obtener fotos.');
  return body.photos;
}

export async function getInbodyRecords(clientId: string): Promise<InbodyRecord[]> {
  const body = await authorizedGet<{ success: boolean; records: InbodyRecord[]; error?: string }>(`/api/clients/${clientId}/inbody-records`);
  if (!body.success) throw new Error(body.error || 'Error al obtener registros InBody.');
  return body.records;
}
```

- [ ] **Step 4: Implement the client-detail page**

`apps/web/app/admin/clients/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getPersonalInfo,
  getAnthropometrics,
  getPhotos,
  getInbodyRecords,
  type PersonalInfo,
  type AnthropometricRecord,
  type ProgressPhoto,
  type InbodyRecord,
} from '../../../../lib/personal-info-client';

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [anthropometrics, setAnthropometrics] = useState<AnthropometricRecord[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [inbodyRecords, setInbodyRecords] = useState<InbodyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPersonalInfo(clientId), getAnthropometrics(clientId), getPhotos(clientId), getInbodyRecords(clientId)])
      .then(([info, records, photoList, inbody]) => {
        setPersonalInfo(info);
        setAnthropometrics(records);
        setPhotos(photoList);
        setInbodyRecords(inbody);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p>Cargando detalle del cliente...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <div>
      <h1>Detalle del cliente</h1>

      <section>
        <h2>Perfil</h2>
        <p>País: {personalInfo?.country || '—'}</p>
        <p>Ciudad: {personalInfo?.city || '—'}</p>
        <p>Peso: {personalInfo?.weight ?? '—'}</p>
        <p>Altura: {personalInfo?.height ?? '—'}</p>
      </section>

      <section>
        <h2>Historial antropométrico</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Peso</th>
              <th>Cintura</th>
            </tr>
          </thead>
          <tbody>
            {anthropometrics.map((record) => (
              <tr key={record.id}>
                <td>{record.fecha}</td>
                <td>{record.peso ?? '—'}</td>
                <td>{record.cintura ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Fotos de progreso</h2>
        {photos.map((photo) => (
          <img key={photo.id} src={photo.photoUrl} alt={photo.angle || 'foto de progreso'} width={120} />
        ))}
      </section>

      <section>
        <h2>Registros InBody</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Peso total</th>
              <th>% Grasa</th>
            </tr>
          </thead>
          <tbody>
            {inbodyRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.fecha}</td>
                <td>{record.pesoTotal ?? '—'}</td>
                <td>{record.grasaPct ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Link to the detail page from the clients list**

Modify `apps/web/app/admin/clients/page.tsx` — add `import Link from 'next/link';` to the imports, add a header cell, and add a link cell. The full updated file:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchClients, type ClientSummary } from '../../../lib/clients-client';

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando clientes...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Plan</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <tr key={client.id}>
            <td>{client.name}</td>
            <td>{client.email}</td>
            <td>{client.plan}</td>
            <td>{client.status}</td>
            <td>
              <Link href={`/admin/clients/${client.id}`}>Ver detalle</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run test/client-detail-page.test.tsx` (from `apps/web`)
Expected: PASS (1 test)

- [ ] **Step 7: Run the full `apps/web` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from Fundación plus this task's new test)

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/personal-info-client.ts "apps/web/app/admin/clients/[id]/page.tsx" apps/web/app/admin/clients/page.tsx apps/web/test/client-detail-page.test.tsx
git commit -m "feat(info-personal): add the admin client-detail page"
```
