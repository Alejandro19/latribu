# Fundación — Migración Arquitectónica de LATRIBU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new stack (Next.js monorepo frontend + layered Express/TypeScript backend + Drizzle/Postgres + Zod + Vitest) in parallel to the existing `server.js`/`index.html`, with Auth and Clientes/Admin fully migrated end-to-end as the reference pattern for the remaining modules.

**Architecture:** npm workspaces monorepo (`apps/api`, `apps/web`, `packages/shared-types`) added alongside the untouched legacy root app. `apps/api` follows Routes → Controllers → Services → Models, talks to the same Supabase Postgres database directly via Drizzle (bypassing PostgREST), and validates all input with Zod schemas shared with `apps/web`. `apps/web` is a Next.js App Router SPA (`'use client'`-heavy, no public SSR content) that consumes `apps/api` over HTTP.

**Tech Stack:** TypeScript everywhere, Express 4, Drizzle ORM + `postgres` driver, Zod (+ `drizzle-zod`-style hand-written schemas), Next.js App Router, Vitest (+ Testing Library for `apps/web`), bcryptjs, jsonwebtoken, google-auth-library.

## Global Constraints

- No production cutover in this phase — `server.js` and `index.html` at the repo root keep running unchanged; the new stack is additive only (spec: "Fuera de alcance").
- Scope is limited to Auth + Clientes/Admin (`/api/clients*` CRUD + permission/status/client-type/renew-plan patches). Personal-info, anthropometrics, photos, InBody, and all other existing modules are explicitly out of scope.
- ORM: Drizzle, not Prisma. Validation: Zod. Auth: JWT + bcrypt (own implementation, no Auth.js/NextAuth). Testing: Vitest everywhere, against a dedicated test Postgres database — never mocks, never production (same principle as Fase 0's `test/helpers/setupTestEnv.js`).
- Storage stays on Supabase Storage — untouched by this plan.
- Repo structure: `apps/web`, `apps/api`, `packages/shared-types`, managed via npm workspaces from the existing root `package.json` (only a `workspaces` key is added to it — its existing `main`/`scripts` for `server.js` must not change).
- Every table `admin_notifications`/`clients`/`admins` in the real database has RLS enabled with a `deny_all` policy (schema.sql:515-531) — application code must connect as the Postgres role that bypasses RLS (the same role Supabase's "Connection string" in Database Settings uses), never through `anon`/`authenticated` roles. Task 3 verifies this explicitly.
- Never hardcode secrets. `JWT_SECRET` and `DATABASE_URL` must throw at startup if unset (same hardening as `server.js:23-28`).

## File Structure

```
latribu/
  package.json                        ← MODIFY: add "workspaces"
  tsconfig.base.json                  ← NEW: shared TS compiler options
  .gitignore                          ← MODIFY: add dist/, .next/
  packages/
    shared-types/
      package.json, tsconfig.json
      src/auth.ts                     ← Zod schemas for auth endpoints
      src/client.ts                   ← Zod schemas for client endpoints
      src/index.ts                    ← re-exports
      test/auth.test.ts, test/client.test.ts
  apps/
    api/
      package.json, tsconfig.json, vitest.config.ts, drizzle.config.ts
      .env.example, .env.test.example
      src/
        app.ts                        ← Express app factory (no listen)
        index.ts                      ← listens on PORT
        db/index.ts                   ← Drizzle + postgres-js connection
        models/schema.ts              ← admins, clients, admin_notifications tables
        services/auth.service.ts      ← bcrypt/jwt/isPlanExpired
        services/google-auth.service.ts
        services/admins.service.ts
        services/clients.service.ts
        middleware/auth.middleware.ts ← authMiddleware, adminOnly, ownerOrAdmin
        middleware/validate.ts        ← Zod body validator
        middleware/async-handler.ts   ← wraps async route handlers
        controllers/auth.controller.ts
        controllers/clients.controller.ts
        routes/auth.routes.ts
        routes/clients.routes.ts
      test/
        helpers/setupTestEnv.ts
        health.test.ts
        db-connection.test.ts
        auth.service.test.ts
        auth.middleware.test.ts
        auth.routes.test.ts
        clients.routes.test.ts
        clients.patches.test.ts
    web/
      package.json, tsconfig.json, next.config.ts, vitest.config.ts
      app/layout.tsx
      app/(auth)/login/page.tsx
      app/admin/clients/page.tsx
      lib/api-client.ts, lib/clients-client.ts
      test/setup.ts, test/login-page.test.tsx, test/admin-clients-page.test.tsx
```

Each domain (auth, clients) follows Routes → Controllers → Services → Models. `models/schema.ts` is the single source of truth for table shape; services are the only code that imports `db`; controllers only talk to services; routes only wire HTTP verbs + middleware to controllers.

---

### Task 1: Monorepo scaffold + `apps/api` skeleton with security middleware

**Files:**
- Modify: `package.json` (repo root)
- Create: `tsconfig.base.json`
- Modify: `.gitignore`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`
- Create: `apps/api/src/app.ts`, `apps/api/src/index.ts`
- Create: `apps/api/test/health.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` from `apps/api/src/app.ts`, used by every later test and by `index.ts`.

- [ ] **Step 1: Add workspaces to the root `package.json` without touching existing keys**

Read the current file first, then apply this exact change (add the `workspaces` array right after `"private": true,`, leave `main`, `scripts`, `dependencies`, `devDependencies`, `engines` untouched):

```json
{
  "name": "latribu-portal",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "main": "server.js",
  ...
}
```

- [ ] **Step 2: Add build output directories to `.gitignore`**

Append to the existing `.gitignore`:

```
dist/
.next/
```

- [ ] **Step 3: Create the shared TypeScript base config**

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create `apps/api/package.json`**

```json
{
  "name": "@latribu/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@latribu/shared-types": "*",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.6.1",
    "drizzle-orm": "^0.36.4",
    "express": "^4.19.2",
    "express-rate-limit": "^7.5.1",
    "google-auth-library": "^10.9.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "postgres": "^3.4.4",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "drizzle-kit": "^0.28.1",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 5: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
  },
});
```

- [ ] **Step 7: Write the failing health-check test**

`apps/api/test/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns success status', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: 'ok' });
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd apps/api && npm install && npx vitest run test/health.test.ts`
Expected: FAIL — `Cannot find module '../src/app.js'`

- [ ] **Step 9: Implement the Express app factory with security middleware**

`apps/api/src/app.ts`:

```ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

const ALLOWED_ORIGINS = ['https://latribu-oficial.vercel.app', 'http://localhost:3001'];

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));
  app.use(cors({ origin: ALLOWED_ORIGINS, methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ success: true, status: 'ok' });
  });

  return app;
}
```

- [ ] **Step 10: Implement the entrypoint**

`apps/api/src/index.ts`:

```ts
import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`API escuchando en el puerto ${PORT}`);
});
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `npx vitest run test/health.test.ts` (from `apps/api`)
Expected: PASS (1 test)

- [ ] **Step 12: Commit**

```bash
git add package.json .gitignore tsconfig.base.json apps/api
git commit -m "feat(fundacion): scaffold monorepo workspaces and apps/api skeleton"
```

---

### Task 2: `packages/shared-types` — Zod schemas for Auth and Clients

**Files:**
- Create: `packages/shared-types/package.json`, `packages/shared-types/tsconfig.json`
- Create: `packages/shared-types/src/auth.ts`, `packages/shared-types/src/client.ts`, `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/test/auth.test.ts`, `packages/shared-types/test/client.test.ts`

**Interfaces:**
- Produces: `LoginInputSchema`, `RegisterInputSchema`, `ChangePasswordInputSchema`, `GoogleAuthInputSchema` (+ inferred types `LoginInput`, `RegisterInput`, `ChangePasswordInput`, `GoogleAuthInput`) and `ClientCreateInputSchema`, `ClientUpdateInputSchema`, `PermissionsPatchSchema`, `StatusPatchSchema`, `ClientTypePatchSchema`, `RenewPlanPatchSchema`, `CLIENT_TYPES` (+ their inferred types), all exported from `@latribu/shared-types`. Consumed by `apps/api` (Tasks 6-9) and `apps/web` (Tasks 10-11).

- [ ] **Step 1: Create `packages/shared-types/package.json`**

```json
{
  "name": "@latribu/shared-types",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `packages/shared-types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing tests**

`packages/shared-types/test/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LoginInputSchema, RegisterInputSchema, ChangePasswordInputSchema, GoogleAuthInputSchema } from '../src/auth.js';

describe('auth schemas', () => {
  it('accepts a valid login input', () => {
    const result = LoginInputSchema.safeParse({ email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects a login input with an invalid email', () => {
    const result = LoginInputSchema.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid register input', () => {
    const result = RegisterInputSchema.safeParse({ name: 'Ana', email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects a register input missing the name', () => {
    const result = RegisterInputSchema.safeParse({ email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid change-password input', () => {
    const result = ChangePasswordInputSchema.safeParse({ currentPassword: 'old', newPassword: 'new' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid google auth input', () => {
    const result = GoogleAuthInputSchema.safeParse({ credential: 'a.b.c' });
    expect(result.success).toBe(true);
  });

  it('rejects a google auth input with an empty credential', () => {
    const result = GoogleAuthInputSchema.safeParse({ credential: '' });
    expect(result.success).toBe(false);
  });
});
```

`packages/shared-types/test/client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ClientCreateInputSchema,
  PermissionsPatchSchema,
  StatusPatchSchema,
  ClientTypePatchSchema,
  RenewPlanPatchSchema,
} from '../src/client.js';

describe('client schemas', () => {
  it('accepts a valid client creation input', () => {
    const result = ClientCreateInputSchema.safeParse({ name: 'Ana', email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects a client creation input with an invalid email', () => {
    const result = ClientCreateInputSchema.safeParse({ name: 'Ana', email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid permissions patch', () => {
    const result = PermissionsPatchSchema.safeParse({ permissions: { training: true, nutrition: false } });
    expect(result.success).toBe(true);
  });

  it('accepts a valid status patch', () => {
    const result = StatusPatchSchema.safeParse({ status: 'inactive' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status patch', () => {
    const result = StatusPatchSchema.safeParse({ status: 'banned' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid client-type patch', () => {
    const result = ClientTypePatchSchema.safeParse({ client_type: 'lead_wellness' });
    expect(result.success).toBe(true);
  });

  it('rejects a renew-plan patch with an invalid duration', () => {
    const result = RenewPlanPatchSchema.safeParse({ duration_days: 45 });
    expect(result.success).toBe(false);
  });

  it('accepts a renew-plan patch with explicit dates', () => {
    const result = RenewPlanPatchSchema.safeParse({ plan_start_date: '2026-01-01', plan_end_date: '2026-02-01' });
    expect(result.success).toBe(true);
  });

  it('accepts a renew-plan patch with duration_days as a string', () => {
    const result = RenewPlanPatchSchema.safeParse({ duration_days: '30' });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd packages/shared-types && npm install && npx vitest run`
Expected: FAIL — `Cannot find module '../src/auth.js'`

- [ ] **Step 5: Implement `packages/shared-types/src/auth.ts`**

```ts
import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const GoogleAuthInputSchema = z.object({
  credential: z.string().min(1),
});
export type GoogleAuthInput = z.infer<typeof GoogleAuthInputSchema>;
```

- [ ] **Step 6: Implement `packages/shared-types/src/client.ts`**

```ts
import { z } from 'zod';

export const ClientCreateInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  plan: z.string().optional(),
});
export type ClientCreateInput = z.infer<typeof ClientCreateInputSchema>;

// Campos que el propio dueño del registro o un admin pueden editar por esta
// ruta. status/permissions/client_type/plan-dates tienen sus propias rutas
// PATCH dedicadas (ver PermissionsPatchSchema y compañía) y no se aceptan aquí.
export const ClientUpdateInputSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  plan: z.string().optional(),
  trainingDays: z.number().int().min(1).max(7).optional(),
  assignedQuoteId: z.string().uuid().nullable().optional(),
  objetivos: z.record(z.string(), z.string()).optional(),
  inbodyCadenceType: z.enum(['mensual', 'bimestral', 'personalizado']).optional(),
  inbodyNextExpectedDate: z.string().nullable().optional(),
  inbodyReminderEnabled: z.boolean().optional(),
}).strict();
export type ClientUpdateInput = z.infer<typeof ClientUpdateInputSchema>;

export const PermissionsPatchSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
});
export type PermissionsPatch = z.infer<typeof PermissionsPatchSchema>;

export const StatusPatchSchema = z.object({
  status: z.enum(['active', 'inactive']),
});
export type StatusPatch = z.infer<typeof StatusPatchSchema>;

export const CLIENT_TYPES = ['coaching_1_1', 'coaching_online', 'lead_wellness'] as const;
export const ClientTypePatchSchema = z.object({
  client_type: z.enum(CLIENT_TYPES),
});
export type ClientTypePatch = z.infer<typeof ClientTypePatchSchema>;

export const RenewPlanPatchSchema = z.union([
  z.object({
    plan_start_date: z.string(),
    plan_end_date: z.string(),
  }),
  z.object({
    duration_days: z.coerce.number().refine((v) => v === 30 || v === 90, {
      message: 'Duración de plan inválida. Usa 30 o 90 días.',
    }),
  }),
]);
export type RenewPlanPatch = z.infer<typeof RenewPlanPatchSchema>;
```

- [ ] **Step 7: Implement `packages/shared-types/src/index.ts`**

```ts
export * from './auth.js';
export * from './client.js';
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run` (from `packages/shared-types`)
Expected: PASS (16 tests)

- [ ] **Step 9: Commit**

```bash
git add packages/shared-types
git commit -m "feat(fundacion): add shared Zod schemas for auth and clients"
```

---

### Task 3: Drizzle schema, database connection, and RLS-bypass verification

**Files:**
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/models/schema.ts`
- Create: `apps/api/src/db/index.ts`
- Create: `apps/api/test/helpers/setupTestEnv.ts`
- Create: `apps/api/test/db-connection.test.ts`
- Create: `apps/api/.env.example`, `apps/api/.env.test.example`
- Modify: `apps/api/vitest.config.ts` (add `setupFiles`)

**Interfaces:**
- Produces: `admins`, `clients`, `adminNotifications` Drizzle tables and `Admin`, `Client`, `NewClient` types from `src/models/schema.ts`; `db` (Drizzle instance) from `src/db/index.ts`. Consumed by every service in Tasks 4-9.

- [ ] **Step 1: Document the required environment variables**

`apps/api/.env.example`:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
JWT_SECRET=
JWT_EXPIRES_IN=8h
GOOGLE_CLIENT_ID=
PORT=3001
```

`apps/api/.env.test.example`:

```
TEST_DATABASE_URL=postgresql://postgres:[PASSWORD]@[TEST-HOST]:5432/postgres
JWT_SECRET=test-secret-do-not-use-in-production
JWT_EXPIRES_IN=8h
```

`DATABASE_URL`/`TEST_DATABASE_URL` must be the **direct Postgres connection string** from Supabase's Database Settings (the "Connection string" for the `postgres` role), not the `SUPABASE_URL`/anon or service-role REST credentials used by `server.js`. Every table has RLS enabled with a `deny_all` policy (`schema.sql:515-531`); only a role with `BYPASSRLS` — which is what that connection string authenticates as — can read or write. Copy `.env.example`/`.env.test.example` to `.env`/`.env.test` in `apps/api/` and fill in real values (the test one should point at the same dedicated test Supabase project Fase 0 uses, whose Postgres connection string is available in that project's Database Settings) before running anything below.

- [ ] **Step 2: Write the failing connection test**

`apps/api/test/db-connection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { admins } from '../src/models/schema.js';

describe('drizzle db connection', () => {
  it('connects to the test database', async () => {
    const result = await db.execute(sql`select 1 as ok`);
    expect(result[0].ok).toBe(1);
  });

  it('can select from a table protected by a deny_all RLS policy', async () => {
    // admins has RLS enabled with `CREATE POLICY deny_all ON admins USING (false)`.
    // This only succeeds if DATABASE_URL authenticates as a role that bypasses
    // RLS (Supabase's direct "postgres" connection string) — proving the same
    // app-level access-control model as server.js still applies end to end.
    await expect(db.select().from(admins)).resolves.toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/api && npx vitest run test/db-connection.test.ts`
Expected: FAIL — `Cannot find module '../src/db/index.js'`

- [ ] **Step 4: Implement the Drizzle schema**

`apps/api/src/models/schema.ts`:

```ts
import { pgTable, uuid, text, boolean, integer, date, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().default('Administrador'),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  googleId: text('google_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  status: text('status').notNull().default('active'),
  plan: text('plan').notNull().default('Miembro'),
  clientType: text('client_type').notNull().default('lead_wellness'),
  planDurationDays: integer('plan_duration_days'),
  planStartDate: date('plan_start_date'),
  planEndDate: date('plan_end_date'),
  permissions: jsonb('permissions').notNull().default({
    training: false,
    nutrition: false,
    supplementation: false,
    cortisol: false,
    community: true,
    evolution: true,
  }),
  trainingDays: integer('training_days'),
  assignedQuoteId: uuid('assigned_quote_id'),
  objetivos: jsonb('objetivos').notNull().default({}),
  inbodyCadenceType: text('inbody_cadence_type').notNull().default('mensual'),
  inbodyNextExpectedDate: date('inbody_next_expected_date'),
  inbodyReminderEnabled: boolean('inbody_reminder_enabled').notNull().default(true),
  inbodyReminderSentThisCycle: boolean('inbody_reminder_sent_this_cycle').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const adminNotifications = pgTable('admin_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('onboarding_complete'),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
```

`admins`, `clients`, and `admin_notifications` already exist in both the production and test databases (created by `schema.sql` for Fase 0) — this file is a code-level mirror of that existing shape, not a migration source. No `drizzle-kit generate`/`migrate` runs in this task; `drizzle.config.ts` (Step 6) exists so future schema *changes* can generate migrations against this baseline.

- [ ] **Step 5: Implement the database connection**

`apps/api/src/db/index.ts`:

```ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../models/schema.js';

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL no está configurada. Define esta variable de entorno antes ' +
      'de arrancar el servidor — nunca debe operar sin una conexión explícita.'
    );
  }
  return url;
}

const queryClient = postgres(requireDatabaseUrl(), { max: 10 });
export const db = drizzle(queryClient, { schema });
```

- [ ] **Step 6: Create `apps/api/drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/models/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 7: Write the test-environment loader**

`apps/api/test/helpers/setupTestEnv.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testEnvPath = path.join(__dirname, '../../.env.test');
const prodEnvPath = path.join(__dirname, '../../.env');

if (!fs.existsSync(testEnvPath)) {
  throw new Error(
    'Falta apps/api/.env.test — copia .env.test.example a .env.test y ' +
    'complétalo con la connection string de un proyecto de Supabase DEDICADO ' +
    'A PRUEBAS antes de correr los tests.'
  );
}

const testEnv = dotenv.parse(fs.readFileSync(testEnvPath));

if (!testEnv.TEST_DATABASE_URL || !testEnv.JWT_SECRET) {
  throw new Error('.env.test debe definir TEST_DATABASE_URL y JWT_SECRET.');
}

let prodEnv: Record<string, string> = {};
if (fs.existsSync(prodEnvPath)) {
  prodEnv = dotenv.parse(fs.readFileSync(prodEnvPath));
}

if (prodEnv.DATABASE_URL && testEnv.TEST_DATABASE_URL === prodEnv.DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL en .env.test es igual a DATABASE_URL de .env (producción). ' +
    'Los tests NUNCA deben correr contra la base de datos real.'
  );
}

for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] = value;
}
process.env.DATABASE_URL = testEnv.TEST_DATABASE_URL;
```

- [ ] **Step 8: Wire the loader into Vitest**

Modify `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/helpers/setupTestEnv.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 9: Run the connection test to verify it passes**

Run: `npx vitest run test/db-connection.test.ts` (from `apps/api`, after creating a real `.env.test` per Step 1)
Expected: PASS (2 tests)

- [ ] **Step 10: Commit**

```bash
git add apps/api/drizzle.config.ts apps/api/src/models apps/api/src/db apps/api/test apps/api/.env.example apps/api/.env.test.example apps/api/vitest.config.ts
git commit -m "feat(fundacion): add Drizzle schema, db connection, and RLS-bypass verification"
```

---

### Task 4: Auth service (bcrypt, JWT, plan-expiry)

**Files:**
- Create: `apps/api/src/services/auth.service.ts`
- Test: `apps/api/test/auth.service.test.ts`

**Interfaces:**
- Consumes: `Client` type from `../models/schema.js` (Task 3).
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`, `signToken(payload: TokenPayload): string`, `verifyToken(token: string): TokenPayload`, `isPlanExpired(client): boolean`, and the `TokenPayload` type (`{ id: string; role: 'admin' | 'cliente'; name: string; email: string; plan?: string }`). Consumed by Tasks 5-9.

- [ ] **Step 1: Write the failing tests**

`apps/api/test/auth.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  isPlanExpired,
} from '../src/services/auth.service.js';

describe('auth.service', () => {
  it('hashes and verifies a password round-trip', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('signs and verifies a token round-trip', () => {
    const token = signToken({ id: 'abc', role: 'admin', name: 'Ana', email: 'a@a.com' });
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ id: 'abc', role: 'admin', name: 'Ana', email: 'a@a.com' });
  });

  it('throws on an invalid token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });

  it('isPlanExpired returns false for a null client', () => {
    expect(isPlanExpired(null)).toBe(false);
  });

  it('isPlanExpired returns false for a lead_wellness client (no membership)', () => {
    expect(isPlanExpired({ clientType: 'lead_wellness', planEndDate: '2000-01-01' })).toBe(false);
  });

  it('isPlanExpired returns false when plan_end_date is null', () => {
    expect(isPlanExpired({ clientType: 'coaching_1_1', planEndDate: null })).toBe(false);
  });

  it('isPlanExpired returns true for a coaching client past their end date', () => {
    expect(isPlanExpired({ clientType: 'coaching_1_1', planEndDate: '2000-01-01' })).toBe(true);
  });

  it('isPlanExpired returns false for a coaching client before their end date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isPlanExpired({ clientType: 'coaching_online', planEndDate: future.toISOString().slice(0, 10) })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/auth.service.test.ts`
Expected: FAIL — `Cannot find module '../src/services/auth.service.js'`

- [ ] **Step 3: Implement the service**

`apps/api/src/services/auth.service.ts`:

```ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Client } from '../models/schema.js';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET no está configurada. Define esta variable de entorno antes ' +
      'de arrancar el servidor — nunca debe operar con un secreto por defecto.'
    );
  }
  return secret;
}

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];

export type TokenPayload = {
  id: string;
  role: 'admin' | 'cliente';
  name: string;
  email: string;
  plan?: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, requireJwtSecret()) as TokenPayload;
}

const ACTIVE_PLAN_TYPES = ['coaching_1_1', 'coaching_online'];

export function isPlanExpired(client: Pick<Client, 'clientType' | 'planEndDate'> | null): boolean {
  if (!client) return false;
  if (!ACTIVE_PLAN_TYPES.includes(client.clientType)) return false;
  if (!client.planEndDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today > client.planEndDate;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/auth.service.test.ts` (from `apps/api`)
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/auth.service.ts apps/api/test/auth.service.test.ts
git commit -m "feat(fundacion): add auth service (bcrypt, jwt, plan-expiry)"
```

---

### Task 5: Admins/clients finder services + auth middleware

**Files:**
- Create: `apps/api/src/services/admins.service.ts`
- Create: `apps/api/src/services/clients.service.ts` (finder functions only — CRUD comes in Task 8)
- Create: `apps/api/src/middleware/auth.middleware.ts`
- Test: `apps/api/test/auth.middleware.test.ts`

**Interfaces:**
- Consumes: `db`, `admins`, `clients` (Task 3); `verifyToken`, `isPlanExpired`, `TokenPayload` (Task 4).
- Produces: `findAdminByEmail`, `findAdminById` from `admins.service.ts`; `findClientByEmail`, `findClientById` from `clients.service.ts`; `authMiddleware`, `adminOnly`, `ownerOrAdmin` Express middleware from `auth.middleware.ts`, plus the `Express.Request` augmentation (`req.user`, `req.client`, `req.planExpired`). Consumed by Tasks 6-9.

- [ ] **Step 1: Implement the admins finder service**

`apps/api/src/services/admins.service.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { admins, type Admin } from '../models/schema.js';

export async function findAdminByEmail(email: string): Promise<Admin | null> {
  const rows = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findAdminById(id: string): Promise<Admin | null> {
  const rows = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateAdminPassword(id: string, passwordHash: string): Promise<void> {
  await db.update(admins).set({ passwordHash }).where(eq(admins.id, id));
}

export async function updateAdminGoogleId(id: string, googleId: string): Promise<void> {
  await db.update(admins).set({ googleId }).where(eq(admins.id, id));
}
```

- [ ] **Step 2: Implement the clients finder service**

`apps/api/src/services/clients.service.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, type Client } from '../models/schema.js';

export async function findClientByEmail(email: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findClientById(id: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 3: Write the failing middleware test**

`apps/api/test/auth.middleware.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../src/middleware/auth.middleware.js';

function buildTestApp() {
  const app = express();
  app.get('/admin-only', authMiddleware, adminOnly, (_req, res) => res.json({ success: true }));
  app.get('/owner/:id', authMiddleware, ownerOrAdmin, (_req, res) => res.json({ success: true }));
  return app;
}

describe('auth.middleware', () => {
  const email = `middleware-test-${Date.now()}@example.com`;
  let clientId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Test Client', email, passwordHash: 'x', status: 'active', clientType: 'coaching_1_1', planEndDate: '2000-01-01' })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects requests without a token', async () => {
    const res = await request(buildTestApp()).get('/admin-only');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin token on an admin-only route', async () => {
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin token on an admin-only route', async () => {
    const token = signToken({ id: 'any-admin-id', role: 'admin', name: 'Admin', email: 'admin@a.com' });
    const res = await request(buildTestApp()).get('/admin-only').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('blocks a client whose plan has expired from ownerOrAdmin routes', async () => {
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get(`/owner/${clientId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(402);
  });

  it('rejects a client accessing another client\'s owner route', async () => {
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get('/owner/some-other-id').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an inactive client entirely', async () => {
    await db.update(clients).set({ status: 'inactive' }).where(eq(clients.id, clientId));
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get(`/owner/${clientId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    await db.update(clients).set({ status: 'active' }).where(eq(clients.id, clientId));
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/auth.middleware.test.ts`
Expected: FAIL — `Cannot find module '../src/middleware/auth.middleware.js'`

- [ ] **Step 5: Implement the middleware**

`apps/api/src/middleware/auth.middleware.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients } from '../models/schema.js';
import { verifyToken, isPlanExpired, type TokenPayload } from '../services/auth.service.js';

type ClientAuthRow = {
  id: string;
  status: string;
  clientType: string;
  permissions: Record<string, boolean>;
  planEndDate: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      client?: ClientAuthRow;
      planExpired?: boolean;
    }
  }
}

function unauthorized(res: Response, message: string, status = 401) {
  return res.status(status).json({ success: false, error: message });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return unauthorized(res, 'Token requerido.');

  let payload: TokenPayload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    return unauthorized(res, 'Token inválido o expirado.');
  }

  if (payload.role === 'cliente') {
    const rows = await db
      .select({
        id: clients.id,
        status: clients.status,
        clientType: clients.clientType,
        permissions: clients.permissions,
        planEndDate: clients.planEndDate,
      })
      .from(clients)
      .where(eq(clients.id, payload.id))
      .limit(1);
    const client = rows[0] as ClientAuthRow | undefined;
    if (!client || client.status === 'inactive') {
      return unauthorized(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    }
    req.client = client;
    req.planExpired = isPlanExpired(client);
  }

  req.user = payload;
  next();
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return unauthorized(res, 'Acceso restringido a administradores.', 403);
  next();
}

export function ownerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (req.user?.id === req.params.id) {
    if (req.planExpired) return unauthorized(res, 'Tu plan ha vencido. Contacta a tu coach para renovarlo.', 402);
    return next();
  }
  return unauthorized(res, 'No tienes permiso para acceder a estos datos.', 403);
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run test/auth.middleware.test.ts` (from `apps/api`)
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/admins.service.ts apps/api/src/services/clients.service.ts apps/api/src/middleware/auth.middleware.ts apps/api/test/auth.middleware.test.ts
git commit -m "feat(fundacion): add auth middleware and admin/client finder services"
```

---

### Task 6: Auth routes — login, register, me, change-password

**Files:**
- Create: `apps/api/src/middleware/validate.ts`
- Create: `apps/api/src/middleware/async-handler.ts`
- Create: `apps/api/src/controllers/auth.controller.ts`
- Create: `apps/api/src/routes/auth.routes.ts`
- Modify: `apps/api/src/app.ts` (mount `/api/auth` + global error handler)
- Test: `apps/api/test/auth.routes.test.ts`

**Interfaces:**
- Consumes: `LoginInputSchema`, `RegisterInputSchema`, `ChangePasswordInputSchema` (Task 2); `hashPassword`, `verifyPassword`, `signToken`, `isPlanExpired` (Task 4); `findAdminByEmail`, `findAdminById`, `updateAdminPassword` (Task 5); `findClientByEmail`, `findClientById` (Task 5); `authMiddleware` (Task 5); `db`, `clients`, `adminNotifications` (Task 3).
- Produces: `validateBody(schema)` middleware, `asyncHandler(handler)` wrapper, `createInactiveClient`, `updateClientPassword` added to `clients.service.ts`, `authRouter` mounted at `/api/auth`. Consumed by Task 7 (extends `auth.controller.ts`/`auth.routes.ts`) and reused by Tasks 8-9.

- [ ] **Step 1: Implement the Zod body validator**

`apps/api/src/middleware/validate.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error.issues[0]?.message || 'Datos inválidos.' });
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 2: Implement the async route wrapper**

`apps/api/src/middleware/async-handler.ts`:

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler(handler: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
```

- [ ] **Step 3: Add client-creation and password-update helpers to `clients.service.ts`**

Append to `apps/api/src/services/clients.service.ts`:

```ts
import { adminNotifications } from '../models/schema.js';
import { hashPassword } from './auth.service.js';

export async function createInactiveClient(input: { name: string; email: string; password?: string; googleId?: string }): Promise<Client> {
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const [client] = await db
    .insert(clients)
    .values({ name: input.name, email: input.email, passwordHash, googleId: input.googleId, status: 'inactive' })
    .returning();
  const viaGoogle = Boolean(input.googleId);
  await db.insert(adminNotifications).values({
    clientId: client.id,
    type: 'new_registration',
    message: `${input.name} se registró ${viaGoogle ? 'con Google ' : ''}en la plataforma.`,
  });
  return client;
}

export async function updateClientPassword(id: string, passwordHash: string): Promise<void> {
  await db.update(clients).set({ passwordHash }).where(eq(clients.id, id));
}

export async function updateClientGoogleId(id: string, googleId: string): Promise<void> {
  await db.update(clients).set({ googleId }).where(eq(clients.id, id));
}
```

(Add `adminNotifications` and `hashPassword` to the existing top-of-file imports rather than re-importing `eq`/`db`/`clients`, which are already imported from Task 5.)

- [ ] **Step 4: Write the failing route tests**

`apps/api/test/auth.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, adminNotifications } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

describe('auth routes', () => {
  const app = createApp();
  const adminEmail = `auth-admin-${Date.now()}@example.com`;
  const clientEmail = `auth-client-${Date.now()}@example.com`;
  let adminId: string;
  let clientId: string;

  beforeAll(async () => {
    const [admin] = await db
      .insert(admins)
      .values({ name: 'Test Admin', email: adminEmail, passwordHash: await hashPassword('admin-pass') })
      .returning();
    adminId = admin.id;

    const [client] = await db
      .insert(clients)
      .values({ name: 'Test Client', email: clientEmail, passwordHash: await hashPassword('client-pass'), status: 'active' })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(adminNotifications).where(eq(adminNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  afterEach(async () => {
    await db.delete(clients).where(eq(clients.email, 'new-register@example.com'));
  });

  it('logs an admin in with the correct password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'admin-pass' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects a login with the wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('logs a client in and reports their permissions', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'client-pass' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('cliente');
    expect(res.body.permissions).toBeDefined();
  });

  it('rejects a login for an inactive client', async () => {
    await db.update(clients).set({ status: 'inactive' }).where(eq(clients.id, clientId));
    const res = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'client-pass' });
    expect(res.status).toBe(403);
    await db.update(clients).set({ status: 'active' }).where(eq(clients.id, clientId));
  });

  it('registers a new client as inactive and pending', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Register', email: 'new-register@example.com', password: 'secret' });
    expect(res.status).toBe(201);
    expect(res.body.pending).toBe(true);
  });

  it('rejects registering an email that already exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: adminEmail, password: 'secret' });
    expect(res.status).toBe(409);
  });

  it('returns the current admin on /me', async () => {
    const token = signToken({ id: adminId, role: 'admin', name: 'Test Admin', email: adminEmail });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(adminEmail);
  });

  it('changes the current user\'s password', async () => {
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email: clientEmail });
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'client-pass', newPassword: 'new-client-pass' });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'new-client-pass' });
    expect(loginRes.status).toBe(200);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/auth.routes.test.ts`
Expected: FAIL — `Cannot find module '../src/controllers/auth.controller.js'`

- [ ] **Step 6: Implement the auth controller**

`apps/api/src/controllers/auth.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { LoginInput, RegisterInput, ChangePasswordInput } from '@latribu/shared-types';
import * as authService from '../services/auth.service.js';
import * as clientsService from '../services/clients.service.js';
import * as adminsService from '../services/admins.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as LoginInput;
  const emailLower = email.toLowerCase().trim();

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    const valid = await authService.verifyPassword(password, admin.passwordHash);
    if (!valid) return err(res, 'Credenciales incorrectas.', 401);
    const token = authService.signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }

  const client = await clientsService.findClientByEmail(emailLower);
  if (!client) return err(res, 'Credenciales incorrectas.', 401);
  if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
  const valid = await authService.verifyPassword(password, client.passwordHash ?? '');
  if (!valid) return err(res, 'Credenciales incorrectas.', 401);

  const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan });
  return ok(res, {
    token,
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
  });
}

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body as RegisterInput;
  const emailLower = email.toLowerCase().trim();
  const [existingAdmin, existingClient] = await Promise.all([
    adminsService.findAdminByEmail(emailLower),
    clientsService.findClientByEmail(emailLower),
  ]);
  if (existingAdmin || existingClient) return err(res, 'Ese email ya está registrado.', 409);

  await clientsService.createInactiveClient({ name, email: emailLower, password });
  return ok(res, { pending: true, message: 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.' }, 201);
}

export async function me(req: Request, res: Response) {
  if (req.user?.role === 'admin') {
    const admin = await adminsService.findAdminById(req.user.id);
    if (!admin) return err(res, 'No encontrado.', 404);
    return ok(res, { role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }
  const client = await clientsService.findClientById(req.user!.id);
  if (!client) return err(res, 'No encontrado.', 404);
  return ok(res, {
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
  });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  const isAdmin = req.user?.role === 'admin';
  const account = isAdmin
    ? await adminsService.findAdminById(req.user!.id)
    : await clientsService.findClientById(req.user!.id);
  if (!account) return err(res, 'No encontrado.', 404);
  const currentHash = 'passwordHash' in account ? account.passwordHash ?? '' : '';
  const valid = await authService.verifyPassword(currentPassword, currentHash);
  if (!valid) return err(res, 'Contraseña actual incorrecta.', 401);
  const passwordHash = await authService.hashPassword(newPassword);
  if (isAdmin) {
    await adminsService.updateAdminPassword(account.id, passwordHash);
  } else {
    await clientsService.updateClientPassword(account.id, passwordHash);
  }
  return ok(res, { message: 'Contraseña actualizada.' });
}
```

- [ ] **Step 7: Implement the auth routes with the login rate limiter**

`apps/api/src/routes/auth.routes.ts`:

```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginInputSchema, RegisterInputSchema, ChangePasswordInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validateBody(LoginInputSchema), asyncHandler(authController.login));
authRouter.get('/me', authMiddleware, asyncHandler(authController.me));
authRouter.post('/register', validateBody(RegisterInputSchema), asyncHandler(authController.register));
authRouter.post('/change-password', authMiddleware, validateBody(ChangePasswordInputSchema), asyncHandler(authController.changePassword));
```

- [ ] **Step 8: Mount the auth router and the global error handler in `app.ts`**

Modify `apps/api/src/app.ts` — add these imports at the top:

```ts
import type { Request, Response, NextFunction } from 'express';
import { authRouter } from './routes/auth.routes.js';
```

And replace the `return app;` line at the end of `createApp` with:

```ts
  app.use('/api/auth', authRouter);

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  });

  return app;
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run test/auth.routes.test.ts` (from `apps/api`)
Expected: PASS (8 tests)

- [ ] **Step 10: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from Tasks 1-6)

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/middleware/validate.ts apps/api/src/middleware/async-handler.ts apps/api/src/controllers/auth.controller.ts apps/api/src/routes/auth.routes.ts apps/api/src/app.ts apps/api/src/services/clients.service.ts apps/api/test/auth.routes.test.ts
git commit -m "feat(fundacion): add auth routes (login, register, me, change-password)"
```

---

### Task 7: Google login

**Files:**
- Create: `apps/api/src/services/google-auth.service.ts`
- Modify: `apps/api/src/controllers/auth.controller.ts` (add `googleLogin`)
- Modify: `apps/api/src/routes/auth.routes.ts` (add `POST /google`)
- Test: `apps/api/test/auth.google.test.ts`

**Interfaces:**
- Consumes: `createInactiveClient`, `updateClientGoogleId`, `findClientByEmail` (Task 6/5); `updateAdminGoogleId`, `findAdminByEmail` (Task 5); `signToken`, `isPlanExpired` (Task 4); `GoogleAuthInputSchema` (Task 2).
- Produces: `verifyGoogleCredential(credential): Promise<GoogleTokenPayload | null>` and `setGoogleVerifierForTests(verifier | null)` from `google-auth.service.ts`, used only by this task's tests.

- [ ] **Step 1: Implement the Google verifier with a test seam**

`apps/api/src/services/google-auth.service.ts`:

```ts
import { OAuth2Client, type TokenPayload as GoogleTokenPayload } from 'google-auth-library';

export type GoogleVerifier = {
  verifyIdToken(params: { idToken: string; audience: string }): Promise<{ getPayload(): GoogleTokenPayload | undefined }>;
};

let verifierOverride: GoogleVerifier | null = null;

// Permite a los tests sustituir la verificación real contra Google (que
// requiere red y credenciales reales) por un doble de prueba determinista.
export function setGoogleVerifierForTests(verifier: GoogleVerifier | null): void {
  verifierOverride = verifier;
}

function getVerifier(clientId: string): GoogleVerifier {
  if (verifierOverride) return verifierOverride;
  return new OAuth2Client(clientId);
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleTokenPayload | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const verifier = getVerifier(clientId);
  try {
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience: clientId });
    return ticket.getPayload() ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write the failing tests**

`apps/api/test/auth.google.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, adminNotifications } from '../src/models/schema.js';
import { hashPassword } from '../src/services/auth.service.js';
import { setGoogleVerifierForTests } from '../src/services/google-auth.service.js';

function fakePayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'google-user@example.com',
    email_verified: true,
    sub: 'google-sub-123',
    name: 'Google User',
    ...overrides,
  };
}

describe('POST /api/auth/google', () => {
  const app = createApp();
  const adminEmail = `google-admin-${Date.now()}@example.com`;
  let adminId: string;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    const [admin] = await db.insert(admins).values({ name: 'Google Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
  });

  afterAll(async () => {
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  beforeEach(() => {
    setGoogleVerifierForTests(null);
  });

  afterEach(async () => {
    // Scoped to the one client this file creates — never delete by `type`
    // alone, since other test files also insert 'new_registration' rows and
    // may run concurrently against the same test database.
    const created = await db.select().from(clients).where(eq(clients.email, 'google-user@example.com'));
    if (created[0]) {
      await db.delete(adminNotifications).where(eq(adminNotifications.clientId, created[0].id));
      await db.delete(clients).where(eq(clients.id, created[0].id));
    }
  });

  it('rejects an unverified Google token', async () => {
    setGoogleVerifierForTests({
      verifyIdToken: async () => ({ getPayload: () => fakePayload({ email_verified: false }) }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(401);
  });

  it('logs an existing admin in by matching email', async () => {
    setGoogleVerifierForTests({
      verifyIdToken: async () => ({ getPayload: () => fakePayload({ email: adminEmail }) }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('creates a new inactive client when no account matches', async () => {
    setGoogleVerifierForTests({
      verifyIdToken: async () => ({ getPayload: () => fakePayload() }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(201);
    expect(res.body.pending).toBe(true);

    const created = await db.select().from(clients).where(eq(clients.email, 'google-user@example.com'));
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe('inactive');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/auth.google.test.ts`
Expected: FAIL — `authController.googleLogin` does not exist / route returns 404

- [ ] **Step 4: Add `googleLogin` to the auth controller**

Append to `apps/api/src/controllers/auth.controller.ts` (add `import * as googleAuthService from '../services/google-auth.service.js';` and `import type { GoogleAuthInput } from '@latribu/shared-types';` to the existing imports):

```ts
export async function googleLogin(req: Request, res: Response) {
  if (!process.env.GOOGLE_CLIENT_ID) return err(res, 'Login con Google no está configurado en el servidor.', 503);
  const { credential } = req.body as GoogleAuthInput;

  const payload = await googleAuthService.verifyGoogleCredential(credential);
  if (!payload || !payload.email_verified || !payload.email) {
    return err(res, 'Token de Google inválido.', 401);
  }

  const emailLower = payload.email.toLowerCase().trim();
  const googleId = payload.sub;
  const displayName = payload.name || emailLower;

  const admin = await adminsService.findAdminByEmail(emailLower);
  if (admin) {
    if (!admin.googleId) await adminsService.updateAdminGoogleId(admin.id, googleId);
    const token = authService.signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email });
    return ok(res, { token, role: 'admin', user: { id: admin.id, name: admin.name, email: admin.email } });
  }

  const client = await clientsService.findClientByEmail(emailLower);
  if (client) {
    if (client.status === 'inactive') return err(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    if (!client.googleId) await clientsService.updateClientGoogleId(client.id, googleId);
    const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan });
    return ok(res, {
      token,
      role: 'cliente',
      user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
      permissions: client.permissions,
      clientType: client.clientType,
      planExpired: authService.isPlanExpired(client),
      planEndDate: client.planEndDate,
    });
  }

  await clientsService.createInactiveClient({ name: displayName, email: emailLower, googleId });
  return ok(res, { pending: true, message: 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.' }, 201);
}
```

- [ ] **Step 5: Mount the route**

Modify `apps/api/src/routes/auth.routes.ts` — add `GoogleAuthInputSchema` to the existing `@latribu/shared-types` import, and append:

```ts
authRouter.post('/google', validateBody(GoogleAuthInputSchema), asyncHandler(authController.googleLogin));
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run test/auth.google.test.ts` (from `apps/api`)
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/google-auth.service.ts apps/api/src/controllers/auth.controller.ts apps/api/src/routes/auth.routes.ts apps/api/test/auth.google.test.ts
git commit -m "feat(fundacion): add Google login with a test-injectable verifier"
```

---

### Task 8: Clients CRUD (list, create, get, update, delete)

**Files:**
- Modify: `apps/api/src/services/clients.service.ts` (add CRUD functions + `ClientEmailTakenError`)
- Create: `apps/api/src/controllers/clients.controller.ts`
- Create: `apps/api/src/routes/clients.routes.ts`
- Modify: `apps/api/src/app.ts` (mount `/api/clients`)
- Test: `apps/api/test/clients.routes.test.ts`

**Interfaces:**
- Consumes: `ClientCreateInputSchema`, `ClientUpdateInputSchema` (Task 2); `authMiddleware`, `adminOnly`, `ownerOrAdmin` (Task 5); `asyncHandler`, `validateBody` (Task 6).
- Produces: `listClients()`, `createClient(input)`, `updateClient(id, patch)`, `deleteClient(id)` on `clients.service.ts`; `clientsRouter` mounted at `/api/clients`. Consumed by Task 9 (extends the same controller/router) and Task 11 (frontend).

- [ ] **Step 1: Add CRUD functions to `clients.service.ts`**

Append to `apps/api/src/services/clients.service.ts` (add `desc` to the existing `drizzle-orm` import):

```ts
export class ClientEmailTakenError extends Error {
  constructor() {
    super('Ese email ya está registrado.');
    this.name = 'ClientEmailTakenError';
  }
}

export async function listClients(): Promise<Client[]> {
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export type CreateClientInput = { name: string; email: string; password: string; plan?: string };

export async function createClient(input: CreateClientInput): Promise<Client> {
  const emailLower = input.email.toLowerCase().trim();
  const existing = await findClientByEmail(emailLower);
  if (existing) throw new ClientEmailTakenError();
  const passwordHash = await hashPassword(input.password);
  const [client] = await db
    .insert(clients)
    .values({ name: input.name, email: emailLower, passwordHash, plan: input.plan || 'Miembro' })
    .returning();
  return client;
}

export async function updateClient(id: string, patch: Record<string, unknown>): Promise<Client | null> {
  const [client] = await db
    .update(clients)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return client ?? null;
}

export async function deleteClient(id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
}
```

- [ ] **Step 2: Write the failing route tests**

`apps/api/test/clients.routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

describe('clients routes (CRUD)', () => {
  const app = createApp();
  const adminEmail = `clients-admin-${Date.now()}@example.com`;
  let adminId: string;
  let adminToken: string;
  let createdClientId: string;

  beforeAll(async () => {
    const [admin] = await db.insert(admins).values({ name: 'CRUD Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
    adminToken = signToken({ id: adminId, role: 'admin', name: 'CRUD Admin', email: adminEmail });
  });

  afterAll(async () => {
    if (createdClientId) await db.delete(clients).where(eq(clients.id, createdClientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  it('rejects a non-admin from listing clients', async () => {
    const fakeClientToken = signToken({ id: 'someone', role: 'cliente', name: 'X', email: 'x@x.com' });
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${fakeClientToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a client as admin', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'CRUD Client', email: `crud-client-${Date.now()}@example.com`, password: 'secret' });
    expect(res.status).toBe(201);
    expect(res.body.client.name).toBe('CRUD Client');
    createdClientId = res.body.client.id;
  });

  it('lists clients as admin, including the one just created', async () => {
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.clients.some((c: { id: string }) => c.id === createdClientId)).toBe(true);
  });

  it('gets a single client by id', async () => {
    const res = await request(app).get(`/api/clients/${createdClientId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.client.id).toBe(createdClientId);
  });

  it('updates a client', async () => {
    const res = await request(app)
      .put(`/api/clients/${createdClientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed Client' });
    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Renamed Client');
  });

  it('rejects creating a client with a duplicate email', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', email: adminEmail, password: 'secret' });
    expect(res.status).toBe(409);
  });

  it('deletes a client', async () => {
    const res = await request(app).delete(`/api/clients/${createdClientId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const remaining = await db.select().from(clients).where(eq(clients.id, createdClientId));
    expect(remaining).toHaveLength(0);
    createdClientId = '';
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/clients.routes.test.ts`
Expected: FAIL — 404s, `clients.controller.js` does not exist

- [ ] **Step 4: Implement the clients controller**

`apps/api/src/controllers/clients.controller.ts`:

```ts
import type { Request, Response } from 'express';
import type { ClientCreateInput, ClientUpdateInput } from '@latribu/shared-types';
import * as clientsService from '../services/clients.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listClients(_req: Request, res: Response) {
  const clients = await clientsService.listClients();
  return ok(res, { clients });
}

export async function createClient(req: Request, res: Response) {
  const input = req.body as ClientCreateInput;
  try {
    const client = await clientsService.createClient(input);
    return ok(res, { client }, 201);
  } catch (e) {
    if (e instanceof clientsService.ClientEmailTakenError) return err(res, e.message, 409);
    throw e;
  }
}

export async function getClient(req: Request, res: Response) {
  const client = await clientsService.findClientById(req.params.id);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function updateClient(req: Request, res: Response) {
  const patch = req.body as ClientUpdateInput;
  const client = await clientsService.updateClient(req.params.id, patch);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function deleteClient(req: Request, res: Response) {
  await clientsService.deleteClient(req.params.id);
  return ok(res, { message: 'Cliente eliminado.' });
}
```

- [ ] **Step 5: Implement the clients routes**

`apps/api/src/routes/clients.routes.ts`:

```ts
import { Router } from 'express';
import { ClientCreateInputSchema, ClientUpdateInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import * as clientsController from '../controllers/clients.controller.js';

export const clientsRouter = Router();

clientsRouter.get('/', authMiddleware, adminOnly, asyncHandler(clientsController.listClients));
clientsRouter.post('/', authMiddleware, adminOnly, validateBody(ClientCreateInputSchema), asyncHandler(clientsController.createClient));
clientsRouter.get('/:id', authMiddleware, ownerOrAdmin, asyncHandler(clientsController.getClient));
clientsRouter.put('/:id', authMiddleware, ownerOrAdmin, validateBody(ClientUpdateInputSchema), asyncHandler(clientsController.updateClient));
clientsRouter.delete('/:id', authMiddleware, adminOnly, asyncHandler(clientsController.deleteClient));
```

- [ ] **Step 6: Mount the router**

Modify `apps/api/src/app.ts` — add `import { clientsRouter } from './routes/clients.routes.js';` to the imports, and add this line right after `app.use('/api/auth', authRouter);`:

```ts
  app.use('/api/clients', clientsRouter);
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run test/clients.routes.test.ts` (from `apps/api`)
Expected: PASS (7 tests)

- [ ] **Step 8: Run the full suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from Tasks 1-8)

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/clients.service.ts apps/api/src/controllers/clients.controller.ts apps/api/src/routes/clients.routes.ts apps/api/src/app.ts apps/api/test/clients.routes.test.ts
git commit -m "feat(fundacion): add clients CRUD routes"
```

---

### Task 9: Clients patches — permissions, status, client-type, renew-plan

**Files:**
- Modify: `apps/api/src/services/clients.service.ts` (add patch functions)
- Modify: `apps/api/src/controllers/clients.controller.ts` (add patch handlers)
- Modify: `apps/api/src/routes/clients.routes.ts` (add patch routes)
- Test: `apps/api/test/clients.patches.test.ts`

**Interfaces:**
- Consumes: `PermissionsPatchSchema`, `StatusPatchSchema`, `ClientTypePatchSchema`, `RenewPlanPatchSchema`, `CLIENT_TYPES` (Task 2); `updateClient` (Task 8).
- Produces: `updatePermissions`, `updateStatus`, `updateClientType`, `renewPlan` on `clients.service.ts`, and four new mounted routes. No further consumers within this plan.

- [ ] **Step 1: Add patch functions to `clients.service.ts`**

Append to `apps/api/src/services/clients.service.ts`:

```ts
export async function updatePermissions(id: string, permissions: Record<string, boolean>): Promise<Client | null> {
  return updateClient(id, { permissions });
}

export async function updateStatus(id: string, status: 'active' | 'inactive'): Promise<Client | null> {
  return updateClient(id, { status });
}

export async function updateClientType(id: string, clientType: string): Promise<Client | null> {
  const existing = await findClientById(id);
  if (!existing) return null;
  const patch: Record<string, unknown> = { clientType };
  if (clientType === 'lead_wellness') {
    patch.permissions = { ...(existing.permissions as Record<string, boolean>), cortisol: true, community: true };
  }
  return updateClient(id, patch);
}

export async function renewPlan(id: string, input: { plan_start_date: string; plan_end_date: string } | { duration_days: number }): Promise<Client | null> {
  if ('plan_start_date' in input) {
    if (input.plan_end_date <= input.plan_start_date) {
      throw new InvalidPlanDatesError();
    }
    const days = Math.round((new Date(input.plan_end_date).getTime() - new Date(input.plan_start_date).getTime()) / 86400000);
    return updateClient(id, {
      planDurationDays: days,
      planStartDate: input.plan_start_date,
      planEndDate: input.plan_end_date,
    });
  }
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + input.duration_days);
  return updateClient(id, {
    planDurationDays: input.duration_days,
    planStartDate: today.toISOString().slice(0, 10),
    planEndDate: endDate.toISOString().slice(0, 10),
  });
}

export class InvalidPlanDatesError extends Error {
  constructor() {
    super('La fecha de vencimiento debe ser posterior a la de inicio.');
    this.name = 'InvalidPlanDatesError';
  }
}
```

- [ ] **Step 2: Write the failing patch tests**

`apps/api/test/clients.patches.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

describe('clients patch routes', () => {
  const app = createApp();
  const adminEmail = `patches-admin-${Date.now()}@example.com`;
  let adminId: string;
  let adminToken: string;
  let clientId: string;

  beforeAll(async () => {
    const [admin] = await db.insert(admins).values({ name: 'Patch Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
    adminToken = signToken({ id: adminId, role: 'admin', name: 'Patch Admin', email: adminEmail });

    const [client] = await db
      .insert(clients)
      .values({ name: 'Patch Client', email: `patch-client-${Date.now()}@example.com`, passwordHash: 'x' })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  it('updates permissions', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: { training: true, nutrition: false, supplementation: false, cortisol: false, community: true, evolution: true } });
    expect(res.status).toBe(200);
    expect(res.body.client.permissions.training).toBe(true);
  });

  it('updates status', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.client.status).toBe('inactive');
    await request(app).patch(`/api/clients/${clientId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'active' });
  });

  it('classifying as lead_wellness bumps cortisol and community permissions', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/client-type`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ client_type: 'lead_wellness' });
    expect(res.status).toBe(200);
    expect(res.body.client.clientType).toBe('lead_wellness');
    expect(res.body.client.permissions.cortisol).toBe(true);
    expect(res.body.client.permissions.community).toBe(true);
  });

  it('rejects an invalid client type', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/client-type`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ client_type: 'not-a-real-type' });
    expect(res.status).toBe(400);
  });

  it('renews a plan with an explicit duration_days', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/renew-plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ duration_days: 30 });
    expect(res.status).toBe(200);
    expect(res.body.client.planDurationDays).toBe(30);
  });

  it('renews a plan with explicit start/end dates', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/renew-plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan_start_date: '2026-01-01', plan_end_date: '2026-02-01' });
    expect(res.status).toBe(200);
    expect(res.body.client.planEndDate).toBe('2026-02-01');
  });

  it('rejects a renew-plan with an end date before the start date', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/renew-plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan_start_date: '2026-02-01', plan_end_date: '2026-01-01' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/api && npx vitest run test/clients.patches.test.ts`
Expected: FAIL — 404s, patch handlers do not exist

- [ ] **Step 4: Add patch handlers to the clients controller**

Append to `apps/api/src/controllers/clients.controller.ts` (add `PermissionsPatch, StatusPatch, ClientTypePatch, RenewPlanPatch` to the existing `@latribu/shared-types` import):

```ts
export async function updatePermissions(req: Request, res: Response) {
  const { permissions } = req.body as PermissionsPatch;
  const client = await clientsService.updatePermissions(req.params.id, permissions);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = req.body as StatusPatch;
  const client = await clientsService.updateStatus(req.params.id, status);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function updateClientType(req: Request, res: Response) {
  const { client_type } = req.body as ClientTypePatch;
  const client = await clientsService.updateClientType(req.params.id, client_type);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function renewPlan(req: Request, res: Response) {
  const input = req.body as RenewPlanPatch;
  try {
    const client = await clientsService.renewPlan(req.params.id, input);
    if (!client) return err(res, 'Cliente no encontrado.', 404);
    return ok(res, { client });
  } catch (e) {
    if (e instanceof clientsService.InvalidPlanDatesError) return err(res, e.message, 400);
    throw e;
  }
}
```

- [ ] **Step 5: Mount the patch routes**

Append to `apps/api/src/routes/clients.routes.ts` (add `PermissionsPatchSchema, StatusPatchSchema, ClientTypePatchSchema, RenewPlanPatchSchema` to the existing `@latribu/shared-types` import):

```ts
clientsRouter.patch('/:id/permissions', authMiddleware, adminOnly, validateBody(PermissionsPatchSchema), asyncHandler(clientsController.updatePermissions));
clientsRouter.patch('/:id/status', authMiddleware, adminOnly, validateBody(StatusPatchSchema), asyncHandler(clientsController.updateStatus));
clientsRouter.patch('/:id/client-type', authMiddleware, adminOnly, validateBody(ClientTypePatchSchema), asyncHandler(clientsController.updateClientType));
clientsRouter.patch('/:id/renew-plan', authMiddleware, adminOnly, validateBody(RenewPlanPatchSchema), asyncHandler(clientsController.renewPlan));
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run test/clients.patches.test.ts` (from `apps/api`)
Expected: PASS (7 tests)

- [ ] **Step 7: Run the full `apps/api` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from Tasks 1-9)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/clients.service.ts apps/api/src/controllers/clients.controller.ts apps/api/src/routes/clients.routes.ts apps/api/test/clients.patches.test.ts
git commit -m "feat(fundacion): add clients permission/status/client-type/renew-plan patches"
```

---

### Task 10: `apps/web` scaffold + login page

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/vitest.config.ts`
- Create: `apps/web/app/layout.tsx`, `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/lib/api-client.ts`
- Test: `apps/web/test/setup.ts`, `apps/web/test/login-page.test.tsx`

**Interfaces:**
- Produces: `loginRequest(email, password): Promise<LoginResult>`, `saveSession(token)`, `getSessionToken()` from `lib/api-client.ts`. Consumed by Task 11.

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@latribu/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "@latribu/shared-types": "*",
    "next": "^15.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

Next.js's App Router needs its own tsconfig shape (`jsx: preserve`, `moduleResolution: bundler`, the `next` plugin) — it intentionally does not extend `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
```

`apps/web/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Create the root layout**

`apps/web/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'LA TRIBU',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create the API client**

`apps/web/lib/api-client.ts`:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export type LoginResult = {
  success: boolean;
  token?: string;
  role?: 'admin' | 'cliente';
  user?: { id: string; name: string; email: string };
  error?: string;
};

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export function saveSession(token: string): void {
  window.localStorage.setItem('latribu_token', token);
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('latribu_token');
}
```

- [ ] **Step 7: Write the failing login page tests**

`apps/web/test/login-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../app/(auth)/login/page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('redirects to /admin/clients on successful login', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, token: 'abc.def.ghi', role: 'admin', user: { id: '1', name: 'Admin', email: 'a@a.com' } }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/clients'));
  });

  it('shows an error message on failed login', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: false, error: 'Credenciales incorrectas.' }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas.');
  });
});
```

- [ ] **Step 8: Run to verify it fails**

Run: `cd apps/web && npm install && npx vitest run test/login-page.test.tsx`
Expected: FAIL — `Cannot find module '../app/(auth)/login/page'`

- [ ] **Step 9: Implement the login page**

`apps/web/app/(auth)/login/page.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loginRequest, saveSession } from '../../../lib/api-client';

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

- [ ] **Step 10: Run to verify it passes**

Run: `npx vitest run test/login-page.test.tsx` (from `apps/web`)
Expected: PASS (2 tests)

- [ ] **Step 11: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/vitest.config.ts apps/web/app apps/web/lib apps/web/test
git commit -m "feat(fundacion): scaffold apps/web and add the login page"
```

---

### Task 11: Admin clients page (reference end-to-end module)

**Files:**
- Create: `apps/web/lib/clients-client.ts`
- Create: `apps/web/app/admin/clients/page.tsx`
- Test: `apps/web/test/admin-clients-page.test.tsx`

**Interfaces:**
- Consumes: `getSessionToken` (Task 10).

- [ ] **Step 1: Write the failing test**

`apps/web/test/admin-clients-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminClientsPage from '../app/admin/clients/page';

vi.mock('../lib/clients-client', () => ({
  fetchClients: vi.fn(async () => [
    { id: '1', name: 'Ana Pérez', email: 'ana@example.com', plan: 'Miembro', status: 'active', clientType: 'coaching_1_1' },
  ]),
}));

describe('AdminClientsPage', () => {
  it('renders the fetched clients in a table', async () => {
    render(<AdminClientsPage />);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run test/admin-clients-page.test.tsx`
Expected: FAIL — `Cannot find module '../lib/clients-client'` / `'../app/admin/clients/page'`

- [ ] **Step 3: Implement the clients API client**

`apps/web/lib/clients-client.ts`:

```ts
import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export type ClientSummary = {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  clientType: string;
};

export async function fetchClients(): Promise<ClientSummary[]> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al listar clientes.');
  return body.clients;
}
```

- [ ] **Step 4: Implement the admin clients page**

`apps/web/app/admin/clients/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
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
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <tr key={client.id}>
            <td>{client.name}</td>
            <td>{client.email}</td>
            <td>{client.plan}</td>
            <td>{client.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/admin-clients-page.test.tsx` (from `apps/web`)
Expected: PASS (1 test)

- [ ] **Step 6: Run the full `apps/web` suite to check for regressions**

Run: `npx vitest run`
Expected: PASS (all tests from Tasks 10-11)

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/clients-client.ts apps/web/app/admin/clients apps/web/test/admin-clients-page.test.tsx
git commit -m "feat(fundacion): add the admin clients page as the Auth+Clients reference module"
```
