# Wizard de Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the client-facing onboarding wizard (9 steps, ~70 fields + module 3's antropometría/fotos/InBody/OCR flow) in `apps/web`, consuming the already-migrated Información Personal backend, as the first client-facing surface of the new stack.

**Architecture:** Config-driven rendering for the 8 text/option modules (`WIZARD_MODULES` + `WizardField`), a bespoke component for module 3 (antropometría/objetivos/OCR), a small backend addition (`onboardingComplete` on `/api/auth/login` and `/api/auth/me`) and a new public geo module (`/api/countries`, `/api/cities/:iso`) in `apps/api`. Nothing already migrated changes behavior.

**Tech Stack:** Next.js App Router (React 19), Zod (`packages/shared-types`), Express + TS (`apps/api`), Drizzle/Postgres, Vitest + Testing Library.

## Global Constraints

- Sin corte de producción: `server.js`/`index.html` no se tocan en este plan.
- `packages/shared-types`'s `dist/` es gitignored — correr `npx tsc -p packages/shared-types/tsconfig.json` después de cualquier cambio ahí y antes de correr tests de `apps/api`/`apps/web`.
- `apps/api` tests corren contra una base de datos de pruebas real vía `apps/api/.env.test` (ver `apps/api/test/helpers/setupTestEnv.ts`) — nunca mocks para lo que se puede probar de verdad.
- `apps/web` tests usan Vitest + Testing Library (`jsdom`), mockeando los módulos `lib/*-client.ts` — nunca llamadas de red reales.
- Node ≥20, TypeScript strict (heredado de `tsconfig.base.json`).
- `country-state-city@^3.2.1` es la versión ya usada por `server.js` — usar la misma en `apps/api`.
- Todas las rutas HTTP nuevas deben coincidir exactamente con las que ya usa `server.js` (mismo path, mismo método) — este backend es un reemplazo directo a futuro, no una API distinta.
- Estilo de marcado en `apps/web`: HTML semántico simple con `<label htmlFor>` (sin CSS ni framework de diseño), igual que `app/admin/clients/[id]/page.tsx` y `app/(auth)/login/page.tsx` — no introducir Tailwind ni CSS-in-JS.

---

### Task 1: Config Zod-driven wizard validation helpers

**Files:**
- Create: `packages/shared-types/src/wizard.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/test/wizard.test.ts`

**Interfaces:**
- Produces: `WizardFieldType`, `WizardFieldConfig`, `WizardModuleConfig`, `ConditionalRule` (types); `computeHiddenFieldIds(rules: ConditionalRule[], data: Record<string, unknown>): Set<string>`; `validateWizardModule(fields: WizardFieldConfig[], data: Record<string, unknown>, hiddenFieldIds: Set<string>): string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared-types/test/wizard.test.ts
import { describe, it, expect } from 'vitest';
import { computeHiddenFieldIds, validateWizardModule, type WizardFieldConfig, type ConditionalRule } from '../src/wizard.js';

describe('computeHiddenFieldIds', () => {
  it('hides the target field when the controlling value does not match', () => {
    const rules: ConditionalRule[] = [{ id: 'condition', value: 'Otra', target: 'condition_other' }];
    const hidden = computeHiddenFieldIds(rules, { condition: 'Ninguna' });
    expect(hidden.has('condition_other')).toBe(true);
  });

  it('shows the target field when the controlling value matches', () => {
    const rules: ConditionalRule[] = [{ id: 'condition', value: 'Otra', target: 'condition_other' }];
    const hidden = computeHiddenFieldIds(rules, { condition: 'Otra' });
    expect(hidden.has('condition_other')).toBe(false);
  });

  it('supports a `values` list (any-of) rule', () => {
    const rules: ConditionalRule[] = [{ id: 'snacks', values: ['A veces', 'Siempre'], target: 'snacks_qty' }];
    expect(computeHiddenFieldIds(rules, { snacks: 'Nunca' }).has('snacks_qty')).toBe(true);
    expect(computeHiddenFieldIds(rules, { snacks: 'Siempre' }).has('snacks_qty')).toBe(false);
  });

  it('supports a `notValue` (anything-but) rule and treats empty as hidden', () => {
    const rules: ConditionalRule[] = [{ id: 'alcohol', notValue: 'Nunca', target: 'alcohol_type' }];
    expect(computeHiddenFieldIds(rules, { alcohol: 'Nunca' }).has('alcohol_type')).toBe(true);
    expect(computeHiddenFieldIds(rules, { alcohol: '' }).has('alcohol_type')).toBe(true);
    expect(computeHiddenFieldIds(rules, { alcohol: 'Ocasional' }).has('alcohol_type')).toBe(false);
  });
});

describe('validateWizardModule', () => {
  const fields: WizardFieldConfig[] = [
    { id: 'occupation', label: 'Ocupación', type: 'text', required: true },
    { id: 'checkup_file', label: 'Chequeo', type: 'file' },
    { id: 'proteins', label: 'Proteínas', type: 'chips', options: ['Pollo'], required: true },
    { id: 'condition_other', label: 'Especifica', type: 'text', required: true },
  ];

  it('flags empty required text fields', () => {
    const invalid = validateWizardModule(fields, { occupation: '' }, new Set());
    expect(invalid).toContain('occupation');
  });

  it('never flags a file field', () => {
    const invalid = validateWizardModule(fields, { occupation: 'Ingeniero', proteins: ['Pollo'] }, new Set());
    expect(invalid).not.toContain('checkup_file');
  });

  it('flags an empty chips field as invalid', () => {
    const invalid = validateWizardModule(fields, { occupation: 'Ingeniero', proteins: [] }, new Set());
    expect(invalid).toContain('proteins');
  });

  it('skips a required field that is currently hidden', () => {
    const invalid = validateWizardModule(
      fields,
      { occupation: 'Ingeniero', proteins: ['Pollo'], condition_other: '' },
      new Set(['condition_other'])
    );
    expect(invalid).not.toContain('condition_other');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && npx vitest run test/wizard.test.ts`
Expected: FAIL with "Cannot find module '../src/wizard.js'"

- [ ] **Step 3: Write the implementation**

```ts
// packages/shared-types/src/wizard.ts
import { z } from 'zod';

export type WizardFieldType =
  | 'text' | 'textarea' | 'select' | 'date' | 'chevron'
  | 'slider' | 'segmented' | 'chips' | 'time' | 'file';

export type WizardFieldConfig = {
  id: string;
  label: string;
  type: WizardFieldType;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
};

export type WizardModuleConfig = {
  n: number;
  title: string;
  custom?: 'country' | 'body';
  fields: WizardFieldConfig[];
};

export type ConditionalRule = {
  id: string;
  target: string;
  value?: string;
  values?: string[];
  notValue?: string;
};

const RequiredTextSchema = z.string().min(1);
const RequiredChipsSchema = z.array(z.string()).min(1);

// Calcula qué field ids deben ocultarse (y por lo tanto omitirse de la
// validación) dado el valor actual de los campos que los controlan — puerto
// fiel de la función `show` en `initFieldDependencies` del legacy
// (index.html). Un campo sin regla nunca se oculta.
export function computeHiddenFieldIds(rules: ConditionalRule[], data: Record<string, unknown>): Set<string> {
  const hidden = new Set<string>();
  for (const rule of rules) {
    const val = data[rule.id];
    const show = rule.values
      ? typeof val === 'string' && rule.values.includes(val)
      : rule.notValue
        ? val !== rule.notValue && val !== undefined && val !== ''
        : val === rule.value;
    if (!show) hidden.add(rule.target);
  }
  return hidden;
}

// Devuelve los ids de los campos requeridos de un módulo que están vacíos —
// puerto fiel de `validateStep` del legacy: los campos tipo 'file' nunca
// bloquean el avance de paso (se validan aparte, vía mimetype en el
// backend), y los campos condicionalmente ocultos se omiten.
export function validateWizardModule(
  fields: WizardFieldConfig[],
  data: Record<string, unknown>,
  hiddenFieldIds: Set<string>
): string[] {
  const invalidIds: string[] = [];
  for (const field of fields) {
    if (field.type === 'file' || !field.required || hiddenFieldIds.has(field.id)) continue;
    const schema = field.type === 'chips' ? RequiredChipsSchema : RequiredTextSchema;
    if (!schema.safeParse(data[field.id]).success) invalidIds.push(field.id);
  }
  return invalidIds;
}
```

```ts
// packages/shared-types/src/index.ts
export * from './auth.js';
export * from './client.js';
export * from './personal-info.js';
export * from './wizard.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared-types && npx vitest run test/wizard.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Build shared-types so downstream tasks can resolve it**

Run: `npx tsc -p packages/shared-types/tsconfig.json`
Expected: no output, exit code 0

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/wizard.ts packages/shared-types/src/index.ts packages/shared-types/test/wizard.test.ts
git commit -m "feat(shared-types): add wizard conditional-rule and validation helpers"
```

---

### Task 2: `onboardingComplete` on login/me responses

**Context:** the wizard's routing guard (`/onboarding` must redirect away once the client has already completed onboarding) and the login page's redirect decision both need to know whether the client has completed the wizard. Neither `/api/auth/login` nor `/api/auth/me` currently return this — it was never needed until now. `personal_info.completed_at` (already modeled as `PersonalInfo.completedAt`) is the source of truth, exactly like the legacy's `state.onboardingComplete = !!data.onboardingComplete`.

**Files:**
- Modify: `apps/api/src/controllers/auth.controller.ts`
- Test: `apps/api/test/auth.routes.test.ts`

**Interfaces:**
- Consumes: `getPersonalInfoByClientId(clientId: string): Promise<PersonalInfo | null>` from `../services/personal-info.service.js` (already exists).
- Produces: `login` and `me` JSON responses gain `onboardingComplete: boolean` whenever `role === 'cliente'`.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/test/auth.routes.test.ts` (inside the existing `describe('auth routes', ...)` block, after the `'logs a client in and reports their permissions'` test):

```ts
  it('reports onboardingComplete as false for a client with no personal-info row', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'client-pass' });
    expect(res.status).toBe(200);
    expect(res.body.onboardingComplete).toBe(false);
  });

  it('reports onboardingComplete as true on /me once personal-info is completed', async () => {
    await db.insert(personalInfo).values({ clientId, completedAt: new Date() });
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email: clientEmail });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.onboardingComplete).toBe(true);
    await db.delete(personalInfo).where(eq(personalInfo.clientId, clientId));
  });
```

Add `personalInfo` to the existing schema import at the top of the file:

```ts
import { admins, clients, adminNotifications, personalInfo } from '../src/models/schema.js';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run test/auth.routes.test.ts`
Expected: FAIL — `res.body.onboardingComplete` is `undefined`, not `false`/`true`

- [ ] **Step 3: Write the implementation**

In `apps/api/src/controllers/auth.controller.ts`, add the import:

```ts
import { getPersonalInfoByClientId } from '../services/personal-info.service.js';
```

Modify the `login` function's client branch — replace:

```ts
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
```

with:

```ts
  const token = authService.signToken({ id: client.id, role: 'cliente', name: client.name, email: client.email, plan: client.plan });
  const clientInfo = await getPersonalInfoByClientId(client.id);
  return ok(res, {
    token,
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
    onboardingComplete: Boolean(clientInfo?.completedAt),
  });
```

Modify the `me` function's client branch — replace:

```ts
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
```

with:

```ts
  const client = await clientsService.findClientById(req.user!.id);
  if (!client) return err(res, 'No encontrado.', 404);
  const clientInfo = await getPersonalInfoByClientId(client.id);
  return ok(res, {
    role: 'cliente',
    user: { id: client.id, name: client.name, email: client.email, plan: client.plan },
    permissions: client.permissions,
    clientType: client.clientType,
    planExpired: authService.isPlanExpired(client),
    planEndDate: client.planEndDate,
    onboardingComplete: Boolean(clientInfo?.completedAt),
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run test/auth.routes.test.ts`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 5: Run the full apps/api suite to confirm no regression**

Run: `cd apps/api && npx vitest run`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/controllers/auth.controller.ts apps/api/test/auth.routes.test.ts
git commit -m "feat(api): report onboardingComplete on login and /me for clients"
```

---

### Task 3: Geo module — `/api/countries` and `/api/cities/:isoCode`

**Files:**
- Create: `apps/api/src/services/geo.service.ts`
- Create: `apps/api/src/controllers/geo.controller.ts`
- Create: `apps/api/src/routes/geo.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/test/geo.routes.test.ts`

**Interfaces:**
- Produces: `GET /api/countries` → `{ success, data: { priority: CountryOption[], rest: CountryOption[] } }`; `GET /api/cities/:isoCode` → `{ success, data: string[] }`. Both public (no `authMiddleware`), matching `server.js`.

- [ ] **Step 1: Add the dependency**

```bash
cd apps/api && npm install country-state-city@^3.2.1
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/test/geo.routes.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('geo routes', () => {
  const app = createApp();

  it('returns countries split into priority and rest groups', async () => {
    const res = await request(app).get('/api/countries');
    expect(res.status).toBe(200);
    expect(res.body.data.priority.some((c: { isoCode: string }) => c.isoCode === 'CO')).toBe(true);
    expect(res.body.data.rest.length).toBeGreaterThan(0);
  });

  it('does not require authentication', async () => {
    const res = await request(app).get('/api/countries');
    expect(res.status).not.toBe(401);
  });

  it('returns a sorted, deduplicated list of cities for a country', async () => {
    const res = await request(app).get('/api/cities/MX');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const sorted = [...res.body.data].sort((a: string, b: string) => a.localeCompare(b, 'es'));
    expect(res.body.data).toEqual(sorted);
  });

  it('returns an empty array for an unknown country code', async () => {
    const res = await request(app).get('/api/cities/ZZ');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run test/geo.routes.test.ts`
Expected: FAIL — 404 (routes don't exist yet)

- [ ] **Step 4: Write the service**

```ts
// apps/api/src/services/geo.service.ts
import { Country, City } from 'country-state-city';

const PRIORITY_ISO = ['CO', 'MX', 'ES', 'AR', 'CL', 'PE', 'VE', 'EC', 'US', 'BO', 'PY', 'UY', 'CR', 'GT', 'HN', 'SV', 'NI', 'PA', 'CU', 'DO'];

export type CountryOption = { isoCode: string; name: string; flag: string; phonecode: string };
export type CountriesResponse = { priority: CountryOption[]; rest: CountryOption[] };

let cache: CountriesResponse | null = null;

export function getCountries(): CountriesResponse {
  if (cache) return cache;
  let displayNames: Intl.DisplayNames | undefined;
  try {
    displayNames = new Intl.DisplayNames(['es'], { type: 'region' });
  } catch {
    displayNames = undefined;
  }
  const all = Country.getAllCountries()
    .map((c) => {
      let name = c.name;
      try {
        if (displayNames) name = displayNames.of(c.isoCode) || c.name;
      } catch {
        // se conserva el nombre en inglés si Intl.DisplayNames falla para ese código
      }
      return { isoCode: c.isoCode, name, flag: c.flag || '', phonecode: c.phonecode || '' };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  cache = {
    priority: PRIORITY_ISO.map((code) => all.find((c) => c.isoCode === code)).filter((c): c is CountryOption => Boolean(c)),
    rest: all.filter((c) => !PRIORITY_ISO.includes(c.isoCode)),
  };
  return cache;
}

export function getCitiesOfCountry(isoCode: string): string[] {
  const cities = City.getCitiesOfCountry(isoCode.toUpperCase()) || [];
  return [...new Set(cities.map((c) => c.name))].sort((a, b) => a.localeCompare(b, 'es'));
}
```

- [ ] **Step 5: Write the controller**

```ts
// apps/api/src/controllers/geo.controller.ts
import type { Request, Response } from 'express';
import * as geoService from '../services/geo.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export function getCountries(_req: Request, res: Response) {
  return ok(res, { data: geoService.getCountries() });
}

export function getCities(req: Request, res: Response) {
  return ok(res, { data: geoService.getCitiesOfCountry(req.params.isoCode) });
}
```

- [ ] **Step 6: Write the routes**

```ts
// apps/api/src/routes/geo.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import * as geoController from '../controllers/geo.controller.js';

export const geoRouter = Router();

geoRouter.get('/countries', asyncHandler(geoController.getCountries));
geoRouter.get('/cities/:isoCode', asyncHandler(geoController.getCities));
```

- [ ] **Step 7: Mount the router**

In `apps/api/src/app.ts`, add the import:

```ts
import { geoRouter } from './routes/geo.routes.js';
```

and mount it (add right after the `app.get('/api/health', ...)` block, before the other `app.use('/api/...)` lines):

```ts
  app.use('/api', geoRouter);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/api && npx vitest run test/geo.routes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Run the full apps/api suite to confirm no regression**

Run: `cd apps/api && npx vitest run`
Expected: all tests PASS

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/services/geo.service.ts apps/api/src/controllers/geo.controller.ts apps/api/src/routes/geo.routes.ts apps/api/src/app.ts apps/api/package.json apps/api/package-lock.json apps/api/test/geo.routes.test.ts
git commit -m "feat(api): port /api/countries and /api/cities/:isoCode from server.js"
```

---

### Task 4: Wizard module config data (`WIZARD_MODULES` + `CONDITIONAL_RULES`)

**Context:** this is the typed, data-only mirror of `ONBOARDING_MODULES` (index.html:1110-1210) and the conditional rules from `initFieldDependencies` (index.html:1472-1485). No rendering logic here — that's Task 7.

The legacy's `initFieldDependencies` array has 12 entries, but the 12th (`{ id: 'medical_clearance', value: 'Sí', target: null }`) is dead code in the legacy — its own `if (!el || !target) return;` guard skips it on every call, since `document.getElementById('field-null')` is never found. It is intentionally **not** ported here: `ConditionalRule.target` is typed `string` (non-nullable per Task 1), and porting a no-op rule would only violate that type for no behavioral gain. So `CONDITIONAL_RULES` below has 11 entries, not 12.

**Files:**
- Create: `apps/web/lib/wizard-modules.ts`
- Test: `apps/web/test/wizard-modules.test.ts`

**Interfaces:**
- Consumes: `WizardModuleConfig`, `ConditionalRule` types from `@latribu/shared-types` (Task 1).
- Produces: `WIZARD_MODULES: WizardModuleConfig[]` (9 entries), `CONDITIONAL_RULES: ConditionalRule[]` (12 entries).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/test/wizard-modules.test.ts
import { describe, it, expect } from 'vitest';
import { WIZARD_MODULES, CONDITIONAL_RULES } from '../lib/wizard-modules';

describe('WIZARD_MODULES', () => {
  it('has exactly 9 modules numbered 1 through 9', () => {
    expect(WIZARD_MODULES).toHaveLength(9);
    expect(WIZARD_MODULES.map((m) => m.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('marks module 1 as the country-custom module with 4 fields', () => {
    const mod1 = WIZARD_MODULES.find((m) => m.n === 1)!;
    expect(mod1.custom).toBe('country');
    expect(mod1.fields).toHaveLength(4);
  });

  it('marks module 3 as the body-custom module with no config-driven fields', () => {
    const mod3 = WIZARD_MODULES.find((m) => m.n === 3)!;
    expect(mod3.custom).toBe('body');
    expect(mod3.fields).toHaveLength(0);
  });

  it('has no custom flag on the other 7 modules', () => {
    const plainModules = WIZARD_MODULES.filter((m) => m.n !== 1 && m.n !== 3);
    expect(plainModules).toHaveLength(7);
    plainModules.forEach((m) => expect(m.custom).toBeUndefined());
  });

  it('every field has a non-empty id and label', () => {
    for (const mod of WIZARD_MODULES) {
      for (const field of mod.fields) {
        expect(field.id.length).toBeGreaterThan(0);
        expect(field.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('CONDITIONAL_RULES', () => {
  it('has exactly 11 rules', () => {
    expect(CONDITIONAL_RULES).toHaveLength(11);
  });

  it('every rule references a real controlling field and a real target field', () => {
    const allFieldIds = new Set(WIZARD_MODULES.flatMap((m) => m.fields.map((f) => f.id)));
    for (const rule of CONDITIONAL_RULES) {
      expect(allFieldIds.has(rule.id)).toBe(true);
      expect(allFieldIds.has(rule.target)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/wizard-modules.test.ts`
Expected: FAIL with "Cannot find module '../lib/wizard-modules'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/lib/wizard-modules.ts
import type { WizardModuleConfig, ConditionalRule } from '@latribu/shared-types';

// Espejo tipado de ONBOARDING_MODULES (index.html:1110-1210). Fuente única
// de verdad para el renderizado (WizardField), la validación
// (validateWizardModule) y las reglas condicionales (CONDITIONAL_RULES) —
// no duplicar esta lista en ningún otro archivo.
export const WIZARD_MODULES: WizardModuleConfig[] = [
  { n: 1, title: 'Perfil Personal', custom: 'country', fields: [
    { id: 'birthdate', label: 'Fecha de nacimiento', type: 'date', required: true },
    { id: 'gender', label: 'Género', type: 'select', options: ['Masculino', 'Femenino', 'Otro'], required: true },
    { id: 'occupation', label: 'Ocupación', type: 'text', required: true },
    { id: 'marital_status', label: 'Estado civil', type: 'select', options: ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a'], required: true },
  ]},
  { n: 2, title: 'Vida Profesional', fields: [
    { id: 'work_hours', label: '¿Horas de trabajo al día?', type: 'chevron', min: 0, required: true },
    { id: 'cognitive_demand', label: '¿Demanda cognitiva (1-10)?', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'travel', label: '¿Con qué frecuencia viajas por trabajo?', type: 'select', options: ['Nunca', '1-2 veces al mes', 'Semanal', 'Muy frecuente'], required: true },
    { id: 'work_place', label: '¿Dónde trabajas principalmente?', type: 'select', options: ['Oficina', 'Remoto', 'Híbrido', 'Campo/Obra'], required: true },
    { id: 'time_control', label: '¿Tienes control sobre tu horario?', type: 'select', options: ['Alto', 'Medio', 'Bajo'], required: true },
  ]},
  { n: 3, title: 'Composición Corporal', custom: 'body', fields: [] },
  { n: 4, title: 'Historial de Salud', fields: [
    { id: 'condition', label: 'Condición médica diagnosticada', type: 'select', options: ['Ninguna', 'Diabetes', 'Hipertensión', 'Hipotiroidismo', 'Síndrome metabólico', 'PCOS', 'Otra'], required: true },
    { id: 'condition_other', label: 'Especifica la condición médica', type: 'text', required: true },
    { id: 'meds', label: '¿Tomas medicamentos actualmente?', type: 'select', options: ['No', 'Sí'], required: true },
    { id: 'meds_detail', label: '¿Para qué te lo recetaron?', type: 'text', required: true },
    { id: 'allergies', label: 'Alergias', type: 'text', required: true },
    { id: 'injury', label: 'Pre existencias medicas o Lesiones', type: 'text', required: true },
    { id: 'intervention_surgery', label: '¿Intervenciones quirúrgicas?', type: 'select', options: ['No', 'Sí'], required: true },
    { id: 'intervention_surgery_detail', label: 'Describe la intervención quirúrgica', type: 'text', required: true },
    { id: 'last_checkup', label: 'Último chequeo médico', type: 'select', options: ['Menos de 6 meses', '1 año', '2+ años', 'Nunca'], required: true },
    { id: 'checkup_file', label: 'Subir chequeo médico', type: 'file' },
    { id: 'checkup_notes', label: 'Observaciones del chequeo', type: 'textarea', required: true },
    { id: 'mental_health', label: 'Salud mental diagnosticada', type: 'select', options: ['Sin diagnóstico', 'Ansiedad', 'Depresión', 'TDAH', 'Burnout', 'Otro'], required: true },
    { id: 'mental_health_other', label: 'Especifica la salud mental', type: 'text', required: true },
    { id: 'medical_clearance', label: '¿Tienes autorización médica para entrenar?', type: 'select', options: ['No', 'Sí'], required: true },
    { id: 'goal_reasons', label: 'Escribe 3 razones por las que quieres alcanzar tu objetivo', type: 'textarea', required: true },
  ]},
  { n: 5, title: 'Alimentación', fields: [
    { id: 'meals_per_day', label: '¿Cuántas comidas haces al día?', type: 'segmented', min: 1, max: 6, required: true },
    { id: 'first_meal', label: '¿A qué hora es tu primera comida?', type: 'time', required: true },
    { id: 'last_meal', label: '¿A qué hora es tu última comida?', type: 'time', required: true },
    { id: 'water_liters', label: '¿Cuántos litros de agua tomas al día?', type: 'chevron', min: 0, step: 0.5, required: true },
    { id: 'proteins', label: 'Proteínas que más consumes', type: 'chips', options: ['Pollo', 'Res', 'Pescado', 'Pavo', 'Cerdo', 'Huevo', 'Soja', 'Yogur griego', 'Proteína en polvo', 'Otro'], required: true },
    { id: 'carbs', label: 'Carbohidratos que más consumes', type: 'chips', options: ['Arroz', 'Avena', 'Pan integral', 'Quinoa', 'Pasta', 'Arepa', 'Papa', 'Batata', 'Yuca', 'Plátano', 'Fruta', 'Legumbres', 'Otro'], required: true },
    { id: 'fats', label: 'Grasas que más consumes', type: 'chips', options: ['Aguacate', 'Aceitunas', 'Frutos secos', 'Semillas de chía', 'Aceite de oliva', 'Mantequilla de almendras', 'Otro'], required: true },
    { id: 'breakfast_example', label: 'Describe cómo se ve tu desayuno', type: 'textarea', required: true },
    { id: 'snack_example', label: 'Describe cómo se ven tus snacks', type: 'textarea', required: true },
    { id: 'lunch_example', label: 'Describe cómo se ve tu almuerzo', type: 'textarea', required: true },
    { id: 'dinner_example', label: 'Describe cómo se ve tu cena', type: 'textarea', required: true },
    { id: 'menu_variety', label: '¿Prefieres comer el mismo menú todos los días o tener varios menús disponibles?', type: 'select', options: ['Prefiero el mismo menú todos los días', 'Prefiero tener varios menús para variar'], required: true },
    { id: 'weighing_food', label: '¿Se te da mejor pesar la comida diariamente o prefieres ser más flexible y guiarte por porciones?', type: 'select', options: ['Prefiero pesar la comida diariamente', 'Prefiero ser flexible y guiarme por porciones'], required: true },
    { id: 'favorite_fruits', label: '¿Cuáles son tus 3 frutas preferidas?', type: 'text', required: true },
    { id: 'anxiety_food', label: '¿Con qué te alimentas cuando tienes ansiedad?', type: 'text', required: true },
    { id: 'dairy', label: 'Tolerancia a lácteos', type: 'select', options: ['Sin problema', 'Leve intolerancia', 'Intolerante', 'No consumo'], required: true },
    { id: 'probiotics', label: '¿Consumes probióticos?', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'probiotics_types', label: '¿Cuáles probióticos?', type: 'chips', options: ['Yogur griego', 'Kéfir', 'Kombucha', 'Suplemento', 'Otro'], required: true },
    { id: 'eating_out', label: '¿Cuántas veces comes por fuera?', type: 'select', options: ['Nunca', '1-2 veces/semana', '3+ veces/semana', 'Diario'], required: true },
    { id: 'snacks', label: 'Consumo de snacks entre comidas', type: 'select', options: ['Nunca', 'A veces', 'Siempre'], required: true },
    { id: 'snacks_qty', label: 'Cantidad de snacks diarios', type: 'segmented', min: 0, max: 5, required: true },
    { id: 'caffeine_cups', label: 'Tazas de café/cafeína al día', type: 'segmented', min: 0, max: 6, required: true },
    { id: 'last_coffee', label: 'Hora del último café', type: 'time', required: true },
    { id: 'alcohol', label: 'Consumo de alcohol', type: 'select', options: ['Nunca', 'Ocasional', '1-2x semana', '3+ veces semana'], required: true },
    { id: 'alcohol_type', label: 'Tipo de alcohol', type: 'text', required: true },
    { id: 'diet_type', label: 'Tipo de dieta', type: 'select', options: ['Omnívoro', 'Vegetariano', 'Vegano', 'Keto', 'Paleo', 'Otra'], required: true },
    { id: 'fasting', label: '¿Practicas ayuno intermitente?', type: 'select', options: ['No', '16/8', '18/6', '20/4', '24h', 'Otro'], required: true },
    { id: 'ultraproc', label: 'Consumo de ultraprocesados', type: 'select', options: ['Bajo', 'Moderado', 'Alto'], required: true },
    { id: 'veggies', label: 'Consumo de verduras', type: 'select', options: ['Bajo', 'Moderado', 'Alto'], required: true },
    { id: 'supps_active', label: '¿Tomas suplementos actualmente?', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'supps_list', label: '¿Cuáles suplementos?', type: 'chips', options: ['Proteína', 'Creatina', 'Omega 3', 'Vitamina D', 'Magnesio', 'Zinc', 'B12', 'Colágeno', 'Otro'], required: true },
    { id: 'substances', label: 'Consumo de otras sustancias', type: 'select', options: ['No', 'Tabaco', 'Alcohol frecuente', 'Cannabis', 'Esteroides', 'Otra'], required: true },
    { id: 'substances_detail', label: 'Especifica', type: 'text', required: true },
    { id: 'substances_frequency', label: '¿Con qué frecuencia lo consumes?', type: 'select', options: ['Una vez a la semana', '2-3 veces a la semana', 'Casi todos los días', 'Diario'], required: true },
  ]},
  { n: 6, title: 'Sueño', fields: [
    { id: 'sleep_hours', label: 'Horas de sueño promedio', type: 'chevron', min: 0, step: 0.5, required: true },
    { id: 'bedtime', label: 'Hora de dormir', type: 'time', required: true },
    { id: 'wakeup', label: 'Hora de despertar', type: 'time', required: true },
    { id: 'sleep_quality', label: 'Calidad del sueño (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'wakeups', label: 'Despertares nocturnos', type: 'select', options: ['Ninguno', '1-2', '3+'], required: true },
  ]},
  { n: 7, title: 'Energía y Cognición', fields: [
    { id: 'energy_am', label: 'Energía en la mañana (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'energy_pm', label: 'Energía en la tarde (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Baja', maxLabel: 'Alta', required: true },
    { id: 'brain_fog', label: 'Niebla mental', type: 'select', options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'], required: true },
    { id: 'focus_time', label: 'Tiempo de foco sostenido', type: 'select', options: ['<15min', '15-30min', '30-60min', '>1h'], required: true },
    { id: 'memory', label: '¿Sientes la memoria afectada?', type: 'select', options: ['Sí notablemente', 'Un poco', 'No'], required: true },
  ]},
  { n: 8, title: 'Estrés y Emociones', fields: [
    { id: 'stress_level', label: 'Nivel de estrés crónico (1-10)', type: 'slider', min: 1, max: 10, minLabel: 'Bajo', maxLabel: 'Alto', required: true },
    { id: 'anxiety', label: 'Frecuencia de ansiedad', type: 'select', options: ['Nunca', 'Raramente', 'A veces', 'Frecuentemente', 'Diario'], required: true },
    { id: 'mood', label: 'Estado de ánimo general', type: 'select', options: ['Estable', 'Variable', 'Generalmente bajo', 'Generalmente alto'], required: true },
    { id: 'coping_techniques', label: 'Técnicas de manejo del estrés que usas', type: 'text', required: true },
    { id: 'work_life_balance', label: '¿El trabajo invade tu vida personal?', type: 'select', options: ['No', 'A veces', 'Frecuentemente', 'Siempre'], required: true },
  ]},
  { n: 9, title: 'Entrenamiento Físico', fields: [
    { id: 'active', label: '¿Has realizado alguna vez actividad física?', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'activity_level', label: 'A qué nivel', type: 'select', options: ['Básico', 'Intermedio', 'Avanzado'], required: true },
    { id: 'activity_time', label: 'Durante cuánto tiempo', type: 'text', required: true },
    { id: 'sports_active', label: 'Actualmente practicas algún deporte o haces actividad física', type: 'select', options: ['Sí', 'No'], required: true },
    { id: 'sports_detail', label: '¿Cuál deporte o actividad practicas?', type: 'text', required: true },
    { id: 'training_place', label: '¿En qué lugar vas a entrenar actualmente?', type: 'select', options: ['Gimnasio', 'Casa', 'Aire libre', 'Otro'], required: true },
    { id: 'training_schedule', label: '¿En qué horario?', type: 'text', required: true },
    { id: 'training_days', label: '¿Cuántos días a la semana?', type: 'segmented', min: 1, max: 7, required: true },
    { id: 'goals', label: 'Objetivos principales', type: 'text', required: true },
  ]},
];

// Puerto fiel de las reglas de `initFieldDependencies` (index.html:1472-1485).
export const CONDITIONAL_RULES: ConditionalRule[] = [
  { id: 'condition', value: 'Otra', target: 'condition_other' },
  { id: 'mental_health', value: 'Otro', target: 'mental_health_other' },
  { id: 'snacks', values: ['A veces', 'Siempre'], target: 'snacks_qty' },
  { id: 'alcohol', notValue: 'Nunca', target: 'alcohol_type' },
  { id: 'substances', value: 'Otra', target: 'substances_detail' },
  { id: 'substances', values: ['Tabaco', 'Alcohol frecuente', 'Cannabis', 'Esteroides'], target: 'substances_frequency' },
  { id: 'supps_active', value: 'Sí', target: 'supps_list' },
  { id: 'probiotics', value: 'Sí', target: 'probiotics_types' },
  { id: 'sports_active', value: 'Sí', target: 'sports_detail' },
  { id: 'intervention_surgery', value: 'Sí', target: 'intervention_surgery_detail' },
  { id: 'meds', value: 'Sí', target: 'meds_detail' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/wizard-modules.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/wizard-modules.ts apps/web/test/wizard-modules.test.ts
git commit -m "feat(web): port ONBOARDING_MODULES config and conditional rules"
```

---

### Task 5: InBody OCR text parser (pure port)

**Context:** puerto fiel de `m3ParseOcrText` (index.html:2307-2505). Función pura — no toca red ni DOM — así que se prueba con fixtures de texto sintéticos que reproducen los patrones que la regex busca (no hay un reporte InBody real capturado en el repo; los fixtures están documentados como reconstrucciones sintéticas, no capturas reales).

**Files:**
- Create: `apps/web/lib/parse-ocr-text.ts`
- Create: `apps/web/test/fixtures/inbody-report-full.txt`
- Create: `apps/web/test/fixtures/inbody-report-fallback-weight.txt`
- Test: `apps/web/test/parse-ocr-text.test.ts`

**Interfaces:**
- Produces: `ParsedInbodyFields` type; `parseOcrText(text: string): ParsedInbodyFields`.

- [ ] **Step 1: Create the fixtures**

File `apps/web/test/fixtures/inbody-report-full.txt` — exact contents below, no leading/trailing blank-line changes:

```
InBody 770
Fecha/Hora: 2026-07-20 10:00

Análisis de Composición Corporal
Agua Corporal Total (L) 35.4
Proteínas (kg) 10.2
Minerales (kg) 3.20
Masa Grasa Corporal (kg) 15.0

Control de Peso
Peso Actual 68.5
Peso Ideal 65.0
Control de Grasa -8.0

Análisis Músculo-Grasa
Peso
68.5
Masa de Músculo Esquelético
28.4
MME

Análisis de Grasa Corporal
PGC (%)
21.9
PGC (%)
21.9

Puntaje InBody 82

Grasa Visceral
7 (1~9)

Tasa Metabólica Basal 1450 kcal

Ángulo de Fase 6.35

altura 168 cm
```

File `apps/web/test/fixtures/inbody-report-fallback-weight.txt` — exact contents below:

```
InBody270

Peso
72.3
Altura 175 cm
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/web/test/parse-ocr-text.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseOcrText } from '../lib/parse-ocr-text';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

describe('parseOcrText', () => {
  it('parses a full InBody report via the Músculo-Grasa/PGC/section-based paths', () => {
    const parsed = parseOcrText(loadFixture('inbody-report-full.txt'));
    expect(parsed._version).toBe('InBody770');
    expect(parsed.peso_total).toBe(68.5);
    expect(parsed.grasa_pct).toBe(21.9);
    expect(parsed.peso_objetivo).toBe(65);
    expect(parsed.grasa_visceral).toBe(7);
    expect(parsed.bmr).toBe(1450);
    expect(parsed.ecw_tbw).toBe(35.4);
    expect(parsed.smm).toBe(28.4);
    expect(parsed.masa_osea).toBeCloseTo(3.2);
    expect(parsed.height).toBe(168);
    expect(parsed.angulo_fase).toBe(6.35);
  });

  it('falls back to line-based weight detection when there is no Músculo-Grasa/MME section', () => {
    const parsed = parseOcrText(loadFixture('inbody-report-fallback-weight.txt'));
    expect(parsed._version).toBe('InBody270');
    expect(parsed.peso_total).toBe(72.3);
    expect(parsed.height).toBe(175);
    expect(parsed.grasa_pct).toBeUndefined();
    expect(parsed.smm).toBeUndefined();
  });

  it('returns an empty-ish result for text with no recognizable InBody patterns', () => {
    const parsed = parseOcrText('texto sin ninguna relación con un reporte InBody');
    expect(parsed._version).toBeNull();
    expect(parsed.peso_total).toBeUndefined();
  });

  it('nulls out an implausible smm value that exceeds calculated lean mass', () => {
    const parsed = parseOcrText('Peso\n68.5\nPGC (%)\n5.0\nMasa de Músculo Esquelético\n68.0\nMME\n');
    expect(parsed.smm).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/parse-ocr-text.test.ts`
Expected: FAIL with "Cannot find module '../lib/parse-ocr-text'"

- [ ] **Step 4: Write the implementation**

```ts
// apps/web/lib/parse-ocr-text.ts
export type ParsedInbodyFields = {
  _version?: string | null;
  peso_total?: number;
  grasa_pct?: number;
  peso_objetivo?: number;
  grasa_visceral?: number;
  bmr?: number;
  ecw_tbw?: number;
  smm?: number;
  masa_osea?: number;
  height?: number;
  angulo_fase?: number;
};

function parseNum(s: string | undefined | null): number | undefined {
  if (s == null) return undefined;
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
}

function firstDecimal(str: string, min?: number, max?: number): number | undefined {
  const re = /([0-9]+[,.][0-9]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    const v = parseNum(m[1]);
    if (v != null && (min == null || v >= min) && (max == null || v <= max)) return v;
  }
  return undefined;
}

function winOf(src: string, re: RegExp, before: number, after: number): string {
  const norm = src
    .replace(/[áàâã]/gi, 'a')
    .replace(/[éèê]/gi, 'e')
    .replace(/[íì]/gi, 'i')
    .replace(/[óòô]/gi, 'o')
    .replace(/[úù]/gi, 'u');
  const idx = norm.search(re);
  if (idx < 0) return '';
  const start = Math.max(0, idx - before);
  const end = Math.min(src.length, idx + after);
  return src.slice(start, end);
}

// Puerto fiel de `m3ParseOcrText` (index.html:2307-2505) — el valor de esta
// función está en las ventanas de búsqueda y rangos numéricos ya validados
// contra reportes InBody reales, no en su elegancia. No simplificar sin
// volver a validar contra un reporte real.
export function parseOcrText(text: string): ParsedInbodyFields {
  const result: ParsedInbodyFields = {};
  let v: number | undefined;
  let m: RegExpMatchArray | null;

  // Versión InBody detectada en el encabezado
  {
    const fechaIdx = text.search(/fecha[\s/]*hora|date[\s/]*time/i);
    const hdrZone = fechaIdx > 0 ? text.slice(0, fechaIdx) : text.slice(0, 600);
    const vM = hdrZone.match(/InBody\s*(\d[\w-]*)/i);
    if (vM) {
      result._version = 'InBody' + vM[1];
    } else {
      const vF = text.match(/InBody\s*(\d[\w-]+)/i);
      result._version = vF ? 'InBody' + vF[1] : null;
    }
  }

  // Peso corporal — sección "Músculo-Grasa", último decimal antes de "MME"
  {
    const mgRe = /m[uú]sculo[\s-]+gras[ao]/i;
    let mgIdx = text.search(mgRe);
    if (mgIdx < 0) mgIdx = 0;
    const mmeIdx = text.slice(mgIdx).search(/\bmme\b/i);
    let found = false;
    if (mmeIdx >= 0) {
      const zone = text.slice(mgIdx, mgIdx + mmeIdx);
      const decs: number[] = [];
      const dRe = /([0-9]+[,.][0-9]+)/g;
      let dm: RegExpExecArray | null;
      while ((dm = dRe.exec(zone)) !== null) {
        const dv = parseNum(dm[1]);
        if (dv != null && dv >= 40 && dv <= 250) decs.push(dv);
      }
      if (decs.length > 0) {
        result.peso_total = decs[decs.length - 1];
        found = true;
      }
    }
    if (!found) {
      const lines = text.split('\n');
      for (let li = 0; li < lines.length && result.peso_total == null; li++) {
        const ll = lines[li];
        if (/\bpeso\b/i.test(ll) && !/ideal|control|libre|magra/i.test(ll)) {
          const lw = ll + '\n' + (lines[li + 1] || '') + '\n' + (lines[li + 2] || '');
          v = firstDecimal(lw, 40, 250);
          if (v != null) result.peso_total = v;
        }
      }
      if (result.peso_total == null) {
        const pw = winOf(text, /\bpeso\b(?!\s*(?:ideal|control|libre|magra))/i, 0, 200);
        if (pw) {
          v = firstDecimal(pw, 40, 250);
          if (v != null) result.peso_total = v;
        }
      }
    }
  }

  // % Grasa corporal (PGC)
  {
    let bmi: number | undefined;
    if (result.peso_total) {
      let htM = text.match(/\b(1[4-9][0-9]|2[0-2][0-9])\s*cm\b/i);
      if (!htM) htM = text.match(/altura\s+([0-9]{3})/i);
      if (htM) {
        const ht = parseInt(htM[1], 10);
        bmi = result.peso_total / Math.pow(ht / 100, 2);
      }
    }
    const pgcPos: number[] = [];
    const pgcRe = /\bpgc\b/gi;
    let pgcM: RegExpExecArray | null;
    while ((pgcM = pgcRe.exec(text)) !== null) pgcPos.push(pgcM.index);
    const tries = pgcPos.length >= 2 ? [pgcPos[1], pgcPos[0]] : pgcPos.length >= 1 ? [pgcPos[0]] : [];
    for (let ti = 0; ti < tries.length && result.grasa_pct == null; ti++) {
      const pgcWin = text.slice(tries[ti], tries[ti] + 600);
      const pctOff = pgcWin.search(/\(%\)/);
      const searchFrom = pctOff >= 0 ? pgcWin.slice(pctOff + 3) : pgcWin;
      const sfLines = searchFrom.split('\n');
      for (let sfi = 0; sfi < sfLines.length && result.grasa_pct == null; sfi++) {
        const sfl = sfLines[sfi].trim();
        const sfDecs = sfl.match(/[0-9]+[,.][0-9]+/g);
        if (sfDecs && sfDecs.length === 1) {
          const sfV = parseNum(sfDecs[0]);
          if (sfV != null && sfV >= 10 && sfV <= 65) {
            if (Math.abs(sfV - Math.round(sfV)) < 0.01) continue;
            if (/[0-9]\s*(?:kg|%)/i.test(sfl)) continue;
            if (bmi && Math.abs(sfV - bmi) <= 0.8) continue;
            if (result.peso_total != null && Math.abs(sfV - result.peso_total) <= 2) continue;
            result.grasa_pct = sfV;
          }
        }
      }
    }
  }

  // Peso ideal
  const ctrlSec = winOf(text, /control\s+de\s+peso/i, 0, 400);
  if (ctrlSec) {
    const idealSecM = ctrlSec.match(/peso\s+ideal[\s\S]{0,40}?([0-9]+[,.][0-9]+)/i);
    if (idealSecM) {
      v = parseNum(idealSecM[1]);
      if (v != null && v >= 30 && v <= 150) result.peso_objetivo = v;
    }
  }
  if (result.peso_objetivo == null) {
    const idealRe = /ideal/gi;
    let idealM: RegExpExecArray | null;
    while ((idealM = idealRe.exec(text)) !== null) {
      const iWin = text.slice(idealM.index, idealM.index + 100);
      const iNumRe = /([0-9]+[,.][0-9]+)/g;
      let iDm: RegExpExecArray | null;
      while ((iDm = iNumRe.exec(iWin)) !== null) {
        const iV = parseNum(iDm[1]);
        if (iV == null || iV < 40 || iV > 150) continue;
        if (result.peso_total != null && Math.abs(iV - result.peso_total) < 2) continue;
        result.peso_objetivo = iV;
        break;
      }
      if (result.peso_objetivo != null) break;
    }
  }

  // Grasa visceral
  const viscIdx = text.search(/visceral/i);
  if (viscIdx >= 0) {
    const viscSnip = text.slice(viscIdx + 8, viscIdx + 150);
    const viscClean = viscSnip.replace(/[0-9]+[,.][0-9]+/g, '');
    const viscIntM = viscClean.match(/\b([0-9]{1,2})\b/);
    if (viscIntM) {
      const vv = parseInt(viscIntM[1], 10);
      if (vv >= 1 && vv <= 20) result.grasa_visceral = vv;
    }
  }
  if (result.grasa_visceral == null) {
    m = text.match(/([0-9]{1,2})\s*\(?\s*1\s*[~-]\s*9\s*\)?/);
    if (m) {
      const gvv = parseInt(m[1], 10);
      if (gvv >= 1 && gvv <= 20) result.grasa_visceral = gvv;
    }
  }

  // Metabolismo basal (BMR)
  m = text.match(/tasa\s+metab[^\n]{0,30}?([0-9]{3,4})\s*kcal/i);
  if (!m) m = text.match(/metab[a-záéíóú]{0,10}\s+basal[^0-9]{0,15}([0-9]{3,4})/i);
  if (!m) m = text.match(/([0-9]{4})\s*kcal/i);
  if (m) {
    v = parseInt(m[1], 10);
    if (v >= 600 && v <= 5000) result.bmr = v;
  }

  // Agua corporal total
  m = text.match(/agua\s+corporal\s+(?:total\s+)?\([Ll]\)[^0-9]{0,10}([0-9]+[,.][0-9]+)/i);
  if (!m) m = text.match(/agua\s+corporal\s+total[^0-9]{0,15}([0-9]+[,.][0-9]+)/i);
  if (!m) m = text.match(/agua\s+corporal[^0-9]{0,20}([0-9]+[,.][0-9]+)/i);
  if (m) {
    v = parseNum(m[1]);
    if (v != null && v >= 15 && v <= 80) result.ecw_tbw = Math.round(v * 10) / 10;
  }

  // Masa muscular esquelética (SMM/MME)
  {
    const smmLines = text.split('\n');
    for (let si = 0; si < smmLines.length && result.smm == null; si++) {
      const sLine = smmLines[si];
      if (/m[uú]sculo\s+esqu/i.test(sLine) || /\bmme\s*\([Kk]g\)/i.test(sLine)) {
        const sWin = sLine + '\n' + (smmLines[si + 1] || '') + '\n' + (smmLines[si + 2] || '') + '\n' + (smmLines[si + 3] || '');
        v = firstDecimal(sWin, 10, 60);
        if (v != null) result.smm = v;
      }
    }
    if (result.smm == null) {
      const sWinG = winOf(text, /masa\s+de\s+m[uú]sculo/i, 0, 150);
      if (sWinG) {
        v = firstDecimal(sWinG, 10, 60);
        if (v != null) result.smm = v;
      }
    }
  }

  // Masa ósea (minerales)
  {
    const secIdx = text.search(/[aá]n[aá]lisis\s+de\s+composici[oó]n\s+corporal/i);
    const src = secIdx >= 0 ? text.slice(secIdx, secIdx + 800) : text;
    const mm = src.match(/minerales\s*\(kg\)\s*([0-9]+[,.][0-9]+)/i);
    let done = false;
    if (mm) {
      const vv = parseNum(mm[1]);
      if (vv != null && vv >= 1.5 && vv <= 5.5) {
        result.masa_osea = vv;
        done = true;
      }
    }
    if (!done) {
      const lns = src.split('\n');
      outer: for (let li = 0; li < lns.length; li++) {
        if (!/mineral/i.test(lns[li])) continue;
        if (/prote[ií]/i.test(lns[li])) continue;
        const nums = lns[li].match(/([0-9]+[,.][0-9]+)/g) || [];
        for (const numStr of nums) {
          const vv2 = parseNum(numStr);
          if (vv2 != null && vv2 >= 1.5 && vv2 <= 5.5) {
            result.masa_osea = vv2;
            break outer;
          }
        }
        if (li + 1 < lns.length) {
          const next = lns[li + 1].match(/([0-9]+[,.][0-9]+)/g) || [];
          for (const numStr of next) {
            const vv3 = parseNum(numStr);
            if (vv3 != null && vv3 >= 1.5 && vv3 <= 5.5) {
              result.masa_osea = vv3;
              break outer;
            }
          }
        }
      }
    }
  }

  // Altura
  m = text.match(/altura\s+([0-9]{3})\s*cm/i);
  if (!m) m = text.match(/\b(1[4-9][0-9]|2[0-2][0-9])\s*cm\b/i);
  if (m) result.height = parseInt(m[1], 10);

  // Ángulo de fase
  const afIdx = text.search(/[aá]ngulo\s+de\s+fase/i);
  if (afIdx >= 0) {
    const afWin = text.slice(afIdx, afIdx + 120);
    const afM = afWin.match(/([0-9]+[,.][0-9]+)/);
    if (afM) {
      v = parseNum(afM[1]);
      if (v != null && v >= 1 && v <= 15) result.angulo_fase = v;
    }
  }

  // Validación cruzada: SMM no puede superar la masa magra calculada
  if (result.peso_total != null && result.grasa_pct != null && result.smm != null) {
    const masaMagra = result.peso_total * (1 - result.grasa_pct / 100);
    if (result.smm > masaMagra * 1.05) result.smm = undefined;
  }

  return result;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/parse-ocr-text.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/parse-ocr-text.ts apps/web/test/parse-ocr-text.test.ts apps/web/test/fixtures/inbody-report-full.txt apps/web/test/fixtures/inbody-report-fallback-weight.txt
git commit -m "feat(web): port m3ParseOcrText as a pure, unit-tested function"
```

---

### Task 6: Onboarding and geo API client wrappers

**Files:**
- Create: `apps/web/lib/geo-client.ts`
- Create: `apps/web/lib/onboarding-client.ts`
- Test: `apps/web/test/geo-client.test.ts`
- Test: `apps/web/test/onboarding-client.test.ts`

**Interfaces:**
- Consumes: `getSessionToken()` from `./api-client` (already exists).
- Produces: `getCountries`, `getCities` (geo-client); `putPersonalInfo`, `uploadPersonalInfoFile`, `createAnthropometric`, `createPhoto`, `createInbodyRecord`, `uploadInbodyFile`, `callOcr`, `updateClientObjetivos` (onboarding-client).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/test/geo-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCountries, getCities } from '../lib/geo-client';

describe('geo-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns the priority/rest country groups on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, data: { priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }], rest: [] } }),
    });
    const result = await getCountries();
    expect(result.priority[0].isoCode).toBe('CO');
  });

  it('throws when the countries request fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: false }) });
    await expect(getCountries()).rejects.toThrow();
  });

  it('returns the city list for a country', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true, data: ['Bogotá', 'Medellín'] }) });
    const result = await getCities('CO');
    expect(result).toEqual(['Bogotá', 'Medellín']);
  });
});
```

```ts
// apps/web/test/onboarding-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  putPersonalInfo,
  createAnthropometric,
  createPhoto,
  updateClientObjetivos,
} from '../lib/onboarding-client';

describe('onboarding-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.setItem('latribu_token', 'fake-token');
  });

  it('sends a JSON PUT for putPersonalInfo and resolves on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    await putPersonalInfo('client-1', { onboarding_report: {}, complete: true });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/clients/client-1/personal-info');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('throws with the server error message when putPersonalInfo fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: false, error: 'Plan vencido.' }) });
    await expect(putPersonalInfo('client-1', { onboarding_report: {}, complete: true })).rejects.toThrow('Plan vencido.');
  });

  it('does not set a Content-Type header when sending FormData (createPhoto)', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    const file = new File(['x'], 'frente.jpg', { type: 'image/jpeg' });
    await createPhoto('client-1', file, 'frente', 1);
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('creates an anthropometric record with a JSON body', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    await createAnthropometric('client-1', { fecha: '2026-07-29', mes_num: 1, peso: 70 });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/clients/client-1/anthropometrics');
    expect(JSON.parse(init.body)).toEqual({ fecha: '2026-07-29', mes_num: 1, peso: 70 });
  });

  it('updates client objetivos via PUT /api/clients/:id', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    await updateClientObjetivos('client-1', { peso: 'bajar' });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/clients/client-1');
    expect(JSON.parse(init.body)).toEqual({ objetivos: { peso: 'bajar' } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/geo-client.test.ts test/onboarding-client.test.ts`
Expected: FAIL with "Cannot find module '../lib/geo-client'" / "'../lib/onboarding-client'"

- [ ] **Step 3: Write geo-client.ts**

```ts
// apps/web/lib/geo-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export type CountryOption = { isoCode: string; name: string; flag: string; phonecode: string };
export type CountriesResponse = { priority: CountryOption[]; rest: CountryOption[] };

export async function getCountries(): Promise<CountriesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/countries`);
  const body = await res.json();
  if (!body.success) throw new Error('Error al obtener países.');
  return body.data;
}

export async function getCities(isoCode: string): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/api/cities/${isoCode}`);
  const body = await res.json();
  if (!body.success) throw new Error('Error al obtener ciudades.');
  return body.data;
}
```

- [ ] **Step 4: Write onboarding-client.ts**

```ts
// apps/web/lib/onboarding-client.ts
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

export type PersonalInfoUpdatePayload = {
  birthdate?: string;
  gender?: string;
  occupation?: string;
  marital_status?: string;
  country?: string;
  city?: string;
  phone_code?: string;
  phone_number?: string;
  weight?: number | null;
  height?: number | null;
  body_fat?: number | null;
  onboarding_report: Record<string, unknown>;
  complete: true;
};

export async function putPersonalInfo(clientId: string, payload: PersonalInfoUpdatePayload): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/personal-info`, 'PUT', payload);
  if (!body.success) throw new Error(body.error || 'Error al guardar tu información personal.');
}

export async function uploadPersonalInfoFile(
  clientId: string,
  file: File,
  onboardingReport: Record<string, unknown>
): Promise<{ file_url: string; file_name: string; uploaded_at: string }> {
  const formData = new FormData();
  formData.append('checkup_file', file);
  formData.append('onboarding_report', JSON.stringify(onboardingReport));
  const body = await authorizedRequest<{ success: boolean; file_url: string; file_name: string; uploaded_at: string; error?: string }>(
    `/api/clients/${clientId}/personal-info-file`,
    'POST',
    formData
  );
  if (!body.success) throw new Error(body.error || 'Error al subir el archivo de chequeo médico.');
  return body;
}

export type AnthropometricInput = {
  fecha: string;
  peso?: number | null;
  cintura?: number | null;
  brazos?: number | null;
  hombros?: number | null;
  piernas?: number | null;
  gluteo?: number | null;
  mes_num: number;
};

export async function createAnthropometric(clientId: string, input: AnthropometricInput): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/anthropometrics`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar tus medidas antropométricas.');
}

export async function createPhoto(clientId: string, file: File, angle: string, mesNum: number): Promise<void> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('angle', angle);
  formData.append('mes_num', String(mesNum));
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/photos`, 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir tu foto de progreso.');
}

export type InbodyRecordInput = {
  fecha: string;
  version?: string | null;
  peso_total?: number | null;
  smm?: number | null;
  grasa_pct?: number | null;
  imc?: number | null;
  peso_objetivo?: number | null;
  grasa_visceral?: number | null;
  bmr?: number | null;
  angulo_fase?: number | null;
  ecw_tbw?: number | null;
  masa_osea?: number | null;
  altura?: number | null;
  mes_num: number;
  file_url?: string | null;
  file_name?: string | null;
};

export async function createInbodyRecord(clientId: string, input: InbodyRecordInput): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/inbody-records`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar tu registro InBody.');
}

export async function uploadInbodyFile(clientId: string, file: File): Promise<{ file_url: string; file_name: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const body = await authorizedRequest<{ success: boolean; file_url: string; file_name: string; error?: string }>(
    `/api/clients/${clientId}/inbody-upload`,
    'POST',
    formData
  );
  if (!body.success) throw new Error(body.error || 'Error al adjuntar el archivo InBody.');
  return body;
}

export async function callOcr(clientId: string, base64: string): Promise<{ text: string; source: 'vision' | 'pdf-parse' }> {
  const body = await authorizedRequest<{ success: boolean; text: string; source: 'vision' | 'pdf-parse'; error?: string }>(
    `/api/clients/${clientId}/ocr-vision`,
    'POST',
    { base64 }
  );
  if (!body.success) throw new Error(body.error || 'Error al procesar el archivo con OCR.');
  return body;
}

export async function updateClientObjetivos(clientId: string, objetivos: Record<string, string>): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}`, 'PUT', { objetivos });
  if (!body.success) throw new Error(body.error || 'Error al guardar tu objetivo.');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/geo-client.test.ts test/onboarding-client.test.ts`
Expected: PASS (8 tests total)

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/geo-client.ts apps/web/lib/onboarding-client.ts apps/web/test/geo-client.test.ts apps/web/test/onboarding-client.test.ts
git commit -m "feat(web): add geo and onboarding API client wrappers"
```

---

### Task 7: `WizardField` generic renderer component

**Files:**
- Create: `apps/web/components/onboarding/WizardField.tsx`
- Test: `apps/web/test/wizard-field.test.tsx`

**Interfaces:**
- Consumes: `WizardFieldConfig` from `@latribu/shared-types` (Task 1).
- Produces: `WizardField` React component, props `{ field, value, otroValue?, hidden?, invalid?, onChange, onOtroChange?, onFileChange? }`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/test/wizard-field.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WizardField } from '../components/onboarding/WizardField';
import type { WizardFieldConfig } from '@latribu/shared-types';

describe('WizardField', () => {
  it('renders nothing when hidden is true', () => {
    const field: WizardFieldConfig = { id: 'condition_other', label: 'Especifica', type: 'text', required: true };
    const { container } = render(<WizardField field={field} value="" hidden onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onChange with the selected option for a select field', () => {
    const field: WizardFieldConfig = { id: 'gender', label: 'Género', type: 'select', options: ['Masculino', 'Femenino'], required: true };
    const onChange = vi.fn();
    render(<WizardField field={field} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Género'), { target: { value: 'Femenino' } });
    expect(onChange).toHaveBeenCalledWith('gender', 'Femenino');
  });

  it('toggles a chip option in and out of the selected array', () => {
    const field: WizardFieldConfig = { id: 'proteins', label: 'Proteínas', type: 'chips', options: ['Pollo', 'Res'], required: true };
    const onChange = vi.fn();
    render(<WizardField field={field} value={['Pollo']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Res'));
    expect(onChange).toHaveBeenCalledWith('proteins', ['Pollo', 'Res']);
    fireEvent.click(screen.getByLabelText('Pollo'));
    expect(onChange).toHaveBeenCalledWith('proteins', []);
  });

  it('shows an extra "otro" text input once "Otro" is selected in a chips field', () => {
    const field: WizardFieldConfig = { id: 'proteins', label: 'Proteínas', type: 'chips', options: ['Pollo', 'Otro'], required: true };
    render(<WizardField field={field} value={['Otro']} otroValue="Tofu" onChange={vi.fn()} onOtroChange={vi.fn()} />);
    expect(screen.getByLabelText('Especifica Proteínas')).toHaveValue('Tofu');
  });

  it('calls onChange with the clicked number for a segmented field', () => {
    const field: WizardFieldConfig = { id: 'meals_per_day', label: 'Comidas', type: 'segmented', min: 1, max: 3, required: true };
    const onChange = vi.fn();
    render(<WizardField field={field} value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('2'));
    expect(onChange).toHaveBeenCalledWith('meals_per_day', '2');
  });

  it('renders an alert when invalid is true', () => {
    const field: WizardFieldConfig = { id: 'occupation', label: 'Ocupación', type: 'text', required: true };
    render(<WizardField field={field} value="" invalid onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/wizard-field.test.ts`
Expected: FAIL with "Cannot find module '../components/onboarding/WizardField'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/components/onboarding/WizardField.tsx
'use client';

import type { WizardFieldConfig } from '@latribu/shared-types';

export type WizardFieldProps = {
  field: WizardFieldConfig;
  value: string | string[] | undefined;
  otroValue?: string;
  hidden?: boolean;
  invalid?: boolean;
  onChange: (id: string, value: string | string[]) => void;
  onOtroChange?: (id: string, value: string) => void;
  onFileChange?: (id: string, file: File | null) => void;
};

export function WizardField({ field, value, otroValue, hidden, invalid, onChange, onOtroChange, onFileChange }: WizardFieldProps) {
  if (hidden) return null;

  if (field.type === 'select') {
    return (
      <div>
        <label htmlFor={`field-${field.id}`}>{field.label}</label>
        <select id={`field-${field.id}`} value={(value as string) || ''} onChange={(e) => onChange(field.id, e.target.value)}>
          <option value="">Selecciona…</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {invalid && <p role="alert">Este campo es obligatorio.</p>}
      </div>
    );
  }

  if (field.type === 'segmented') {
    const min = field.min ?? 1;
    const max = field.max ?? 6;
    const current = value !== undefined && value !== '' ? Number(value) : undefined;
    const cells: number[] = [];
    for (let n = min; n <= max; n++) cells.push(n);
    return (
      <div>
        <span id={`field-${field.id}-label`}>{field.label}</span>
        <div role="group" aria-labelledby={`field-${field.id}-label`}>
          {cells.map((n) => (
            <button key={n} type="button" aria-pressed={n === current} onClick={() => onChange(field.id, String(n))}>
              {n}
            </button>
          ))}
        </div>
        {invalid && <p role="alert">Este campo es obligatorio.</p>}
      </div>
    );
  }

  if (field.type === 'chevron') {
    const min = field.min ?? 0;
    const step = field.step ?? 1;
    const current = value !== undefined && value !== '' ? Number(value) : min;
    return (
      <div>
        <label htmlFor={`field-${field.id}`}>{field.label}</label>
        <output htmlFor={`field-${field.id}`}>{current}</output>
        <input type="hidden" id={`field-${field.id}`} value={current} readOnly />
        <button type="button" aria-label={`Aumentar ${field.label}`} onClick={() => onChange(field.id, String(Math.max(min, Math.round((current + step) * 10) / 10)))}>
          ▲
        </button>
        <button type="button" aria-label={`Disminuir ${field.label}`} onClick={() => onChange(field.id, String(Math.max(min, Math.round((current - step) * 10) / 10)))}>
          ▼
        </button>
        {invalid && <p role="alert">Este campo es obligatorio.</p>}
      </div>
    );
  }

  if (field.type === 'slider') {
    const min = field.min ?? 1;
    const max = field.max ?? 10;
    const current = value !== undefined && value !== '' ? Number(value) : min;
    return (
      <div>
        <label htmlFor={`field-${field.id}`}>
          {field.label} ({current})
        </label>
        <input type="range" id={`field-${field.id}`} min={min} max={max} value={current} onChange={(e) => onChange(field.id, e.target.value)} />
        <div>
          <span>{field.minLabel}</span>
          <span>{field.maxLabel}</span>
        </div>
        {invalid && <p role="alert">Este campo es obligatorio.</p>}
      </div>
    );
  }

  if (field.type === 'time') {
    return (
      <div>
        <label htmlFor={`field-${field.id}`}>{field.label}</label>
        <input type="time" id={`field-${field.id}`} value={(value as string) || ''} onChange={(e) => onChange(field.id, e.target.value)} />
        {invalid && <p role="alert">Este campo es obligatorio.</p>}
      </div>
    );
  }

  if (field.type === 'chips') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend>{field.label}</legend>
        {(field.options || []).map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => {
                const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
                onChange(field.id, next);
              }}
            />
            {option}
          </label>
        ))}
        {selected.includes('Otro') && (
          <input
            type="text"
            aria-label={`Especifica ${field.label}`}
            placeholder="Especifica…"
            value={otroValue || ''}
            onChange={(e) => onOtroChange?.(field.id, e.target.value)}
          />
        )}
        {invalid && <p role="alert">Este campo es obligatorio.</p>}
      </fieldset>
    );
  }

  if (field.type === 'file') {
    return (
      <div>
        <label htmlFor={`field-${field.id}`}>{field.label}</label>
        <input type="file" id={`field-${field.id}`} onChange={(e) => onFileChange?.(field.id, e.target.files?.[0] || null)} />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label htmlFor={`field-${field.id}`}>{field.label}</label>
        <textarea id={`field-${field.id}`} value={(value as string) || ''} onChange={(e) => onChange(field.id, e.target.value)} />
        {invalid && <p role="alert">Este campo es obligatorio.</p>}
      </div>
    );
  }

  // text, date
  return (
    <div>
      <label htmlFor={`field-${field.id}`}>{field.label}</label>
      <input type={field.type} id={`field-${field.id}`} value={(value as string) || ''} onChange={(e) => onChange(field.id, e.target.value)} />
      {invalid && <p role="alert">Este campo es obligatorio.</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/wizard-field.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/onboarding/WizardField.tsx apps/web/test/wizard-field.test.tsx
git commit -m "feat(web): add generic WizardField renderer for the 9 non-chips widget types"
```

---

### Task 8: `CountryCityPicker` component

**Context:** puerto funcional (no pixel-perfect) de `renderCountryBlock`/`m1Init`/`m1LoadCities`/`m1FilterCities` (index.html:1675-1813). Se usa `<input list>` + `<datalist>` nativo para el autocompletado de ciudad en vez del dropdown a mano del legacy — simplificación deliberada, HTML nativo cubre el mismo caso de uso (escribir o elegir de una lista) sin JS bespoke.

**Files:**
- Create: `apps/web/components/onboarding/CountryCityPicker.tsx`
- Test: `apps/web/test/country-city-picker.test.tsx`

**Interfaces:**
- Consumes: `getCountries`, `getCities` from `../../lib/geo-client` (Task 6).
- Produces: `CountryCityPicker` component, props `{ value: CountryCityValue, onChange: (patch: Partial<CountryCityValue>) => void }`, where `CountryCityValue = { country: string; city: string; phoneCode: string; phoneNumber: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/test/country-city-picker.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CountryCityPicker } from '../components/onboarding/CountryCityPicker';
import * as geoClient from '../lib/geo-client';

vi.mock('../lib/geo-client');

describe('CountryCityPicker', () => {
  beforeEach(() => {
    vi.mocked(geoClient.getCountries).mockResolvedValue({
      priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }],
      rest: [{ isoCode: 'MX', name: 'México', flag: '🇲🇽', phonecode: '52' }],
    });
    vi.mocked(geoClient.getCities).mockResolvedValue(['Bogotá', 'Medellín']);
  });

  it('renders the fetched countries and disables the city input until a country is chosen', async () => {
    render(<CountryCityPicker value={{ country: '', city: '', phoneCode: '+57', phoneNumber: '' }} onChange={vi.fn()} />);
    expect(await screen.findByRole('option', { name: /Colombia/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Ciudad')).toBeDisabled();
  });

  it('fetches cities and calls onChange when the country changes', async () => {
    const onChange = vi.fn();
    render(<CountryCityPicker value={{ country: '', city: '', phoneCode: '+57', phoneNumber: '' }} onChange={onChange} />);
    await screen.findByRole('option', { name: /Colombia/ });
    fireEvent.change(screen.getByLabelText('País de residencia'), { target: { value: 'CO' } });
    expect(onChange).toHaveBeenCalledWith({ country: 'CO', city: '' });
    await waitFor(() => expect(geoClient.getCities).toHaveBeenCalledWith('CO'));
  });

  it('calls onChange when the phone number changes', async () => {
    const onChange = vi.fn();
    render(<CountryCityPicker value={{ country: 'CO', city: '', phoneCode: '+57', phoneNumber: '' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Celular (WhatsApp)'), { target: { value: '3001234567' } });
    expect(onChange).toHaveBeenCalledWith({ phoneNumber: '3001234567' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/country-city-picker.test.tsx`
Expected: FAIL with "Cannot find module '../components/onboarding/CountryCityPicker'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/components/onboarding/CountryCityPicker.tsx
'use client';

import { useEffect, useState } from 'react';
import { getCountries, getCities, type CountryOption } from '../../lib/geo-client';

export type CountryCityValue = {
  country: string;
  city: string;
  phoneCode: string;
  phoneNumber: string;
};

export type CountryCityPickerProps = {
  value: CountryCityValue;
  onChange: (patch: Partial<CountryCityValue>) => void;
};

export function CountryCityPicker({ value, onChange }: CountryCityPickerProps) {
  const [priority, setPriority] = useState<CountryOption[]>([]);
  const [rest, setRest] = useState<CountryOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getCountries()
      .then((data) => {
        setPriority(data.priority);
        setRest(data.rest);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!value.country) {
      setCities([]);
      return;
    }
    getCities(value.country)
      .then(setCities)
      .catch((e: Error) => setLoadError(e.message));
  }, [value.country]);

  const allCountries = [...priority, ...rest];
  const phoneCodes = Array.from(new Map(allCountries.filter((c) => c.phonecode).map((c) => [c.phonecode, c])).values());

  return (
    <div>
      {loadError && <p role="alert">{loadError}</p>}
      <label htmlFor="field-country">País de residencia</label>
      <select id="field-country" value={value.country} onChange={(e) => onChange({ country: e.target.value, city: '' })}>
        <option value="">Selecciona tu país…</option>
        <optgroup label="Países frecuentes">
          {priority.map((c) => (
            <option key={c.isoCode} value={c.isoCode}>
              {c.flag} {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Todos los países">
          {rest.map((c) => (
            <option key={c.isoCode} value={c.isoCode}>
              {c.flag} {c.name}
            </option>
          ))}
        </optgroup>
      </select>

      <label htmlFor="field-city">Ciudad</label>
      <input
        id="field-city"
        type="text"
        list="field-city-options"
        disabled={!value.country}
        placeholder={value.country ? 'Busca tu ciudad…' : 'Primero selecciona tu país'}
        value={value.city}
        onChange={(e) => onChange({ city: e.target.value })}
      />
      <datalist id="field-city-options">
        {cities.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>

      <label htmlFor="field-phone-code">Indicativo</label>
      <select id="field-phone-code" value={value.phoneCode} onChange={(e) => onChange({ phoneCode: e.target.value })}>
        {phoneCodes.map((c) => (
          <option key={c.phonecode} value={`+${c.phonecode}`}>
            {c.flag} +{c.phonecode}
          </option>
        ))}
      </select>

      <label htmlFor="field-phone-number">Celular (WhatsApp)</label>
      <input
        id="field-phone-number"
        type="tel"
        placeholder="300 123 4567"
        value={value.phoneNumber}
        onChange={(e) => onChange({ phoneNumber: e.target.value })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/country-city-picker.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/onboarding/CountryCityPicker.tsx apps/web/test/country-city-picker.test.tsx
git commit -m "feat(web): add CountryCityPicker for wizard module 1"
```

---

### Task 9: `Module3` component (Composición Corporal)

**Context:** puerto funcional de `renderBodyModuleBlock`/`initModule3`/`saveModule3`/`m3HandlePdf`/`m3UpdateIMC`/`renderObjetivoQuestion`/`setObjetivo` (index.html:1817-2312). **Simplificación deliberada y documentada:** el legacy redimensiona/comprime la imagen en el navegador (canvas, máx. 1600px, JPEG 0.85) antes de mandarla a OCR — esa optimización de payload no se porta en esta tarea porque `jsdom` no implementa `Image`/`canvas` de forma fiable, haciendo ese paso no verificable en un test unitario real. El archivo se envía tal cual; el límite de 8 MB en base64 ya lo hace cumplir `ocr.service.ts` (`FileTooLargeError`) del lado del servidor. Si en producción esto resulta en rechazos frecuentes de fotos grandes, portar la compresión es un follow-up de UI, no de esta migración.

**Files:**
- Create: `apps/web/components/onboarding/Module3.tsx`
- Test: `apps/web/test/module3.test.tsx`

**Interfaces:**
- Consumes: `callOcr`, `uploadInbodyFile`, `updateClientObjetivos` from `../../lib/onboarding-client` (Task 6); `parseOcrText` from `../../lib/parse-ocr-text` (Task 5).
- Produces: `Module3Draft` type, `EMPTY_MODULE3_DRAFT`, `validateModule3(draft): string[]`, `computeImc(pesoTotal, altura): string`, `Module3` component.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/test/module3.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Module3, EMPTY_MODULE3_DRAFT, validateModule3, computeImc, type Module3Draft } from '../components/onboarding/Module3';
import * as onboardingClient from '../lib/onboarding-client';
import * as ocrParser from '../lib/parse-ocr-text';

vi.mock('../lib/onboarding-client');
vi.mock('../lib/parse-ocr-text');

describe('validateModule3', () => {
  it('flags weight/height/body_fat and the 3 objetivos and 9 InBody fields as required, no more', () => {
    const invalid = validateModule3(EMPTY_MODULE3_DRAFT);
    expect(invalid).toEqual(
      expect.arrayContaining(['weight', 'height', 'bodyFat', 'objetivo_peso', 'objetivo_grasa_corporal', 'objetivo_masa_muscular'])
    );
    expect(invalid).not.toContain('inbody_anguloFase');
  });

  it('is empty once every required field is filled', () => {
    const draft: Module3Draft = {
      ...EMPTY_MODULE3_DRAFT,
      weight: '70', height: '170', bodyFat: '18',
      objetivos: { peso: 'bajar', grasa_corporal: 'bajar', masa_muscular: 'subir' },
      inbody: {
        ...EMPTY_MODULE3_DRAFT.inbody,
        pesoTotal: '70', smm: '30', grasaPct: '18', pesoObjetivo: '65', grasaVisceral: '7',
        bmr: '1500', ecwTbw: '35', masaOsea: '3', altura: '170',
      },
    };
    expect(validateModule3(draft)).toEqual([]);
  });
});

describe('computeImc', () => {
  it('computes IMC from weight (kg) and height (cm)', () => {
    expect(computeImc('70', '175')).toBe('22.9');
  });

  it('returns an empty string when weight or height is missing', () => {
    expect(computeImc('', '175')).toBe('');
    expect(computeImc('70', '')).toBe('');
  });
});

describe('Module3 component', () => {
  beforeEach(() => {
    vi.mocked(onboardingClient.updateClientObjetivos).mockResolvedValue(undefined);
  });

  it('saves an objetivo selection and calls updateClientObjetivos in the background', async () => {
    const onChange = vi.fn();
    render(<Module3 clientId="client-1" draft={EMPTY_MODULE3_DRAFT} onChange={onChange} invalidFields={new Set()} />);
    fireEvent.change(screen.getByLabelText(/objetivo de peso/i), { target: { value: 'bajar' } });
    expect(onChange).toHaveBeenCalled();
    await waitFor(() => expect(onboardingClient.updateClientObjetivos).toHaveBeenCalledWith('client-1', { peso: 'bajar', grasa_corporal: '', masa_muscular: '' }));
  });

  it('fills the InBody fields from a parsed OCR result after uploading a file', async () => {
    vi.mocked(onboardingClient.callOcr).mockResolvedValue({ text: 'texto extraído', source: 'vision' });
    vi.mocked(ocrParser.parseOcrText).mockReturnValue({ _version: 'InBody770', peso_total: 70, smm: 30 });
    vi.mocked(onboardingClient.uploadInbodyFile).mockResolvedValue({ file_url: 'https://example.com/f.pdf', file_name: 'reporte.pdf' });

    const onChange = vi.fn();
    render(<Module3 clientId="client-1" draft={EMPTY_MODULE3_DRAFT} onChange={onChange} invalidFields={new Set()} />);
    const file = new File(['%PDF-1.4'], 'reporte.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Sube el PDF o una foto/i), { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Module3Draft;
    expect(lastCall.inbody.pesoTotal).toBe('70');
    expect(lastCall.inbody.smm).toBe('30');
    expect(lastCall.inbody.version).toBe('InBody770');
    expect(lastCall.inbody.fileUrl).toBe('https://example.com/f.pdf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/module3.test.tsx`
Expected: FAIL with "Cannot find module '../components/onboarding/Module3'"

- [ ] **Step 3: Write the implementation**

```tsx
// apps/web/components/onboarding/Module3.tsx
'use client';

import { useState } from 'react';
import { callOcr, uploadInbodyFile, updateClientObjetivos } from '../../lib/onboarding-client';
import { parseOcrText } from '../../lib/parse-ocr-text';

export type Module3Draft = {
  weight: string;
  height: string;
  bodyFat: string;
  objetivos: { peso: string; grasa_corporal: string; masa_muscular: string };
  antropometria: { cintura: string; brazos: string; hombros: string; piernas: string; gluteo: string };
  inbody: {
    pesoTotal: string;
    smm: string;
    grasaPct: string;
    pesoObjetivo: string;
    grasaVisceral: string;
    bmr: string;
    anguloFase: string;
    ecwTbw: string;
    masaOsea: string;
    altura: string;
    imc: string;
    version: string | null;
    fileUrl: string | null;
    fileName: string | null;
    ocrDone: boolean;
  };
  photos: Partial<Record<'frente' | 'lado_derecho' | 'lado_izquierdo' | 'espalda', File>>;
};

export const EMPTY_MODULE3_DRAFT: Module3Draft = {
  weight: '', height: '', bodyFat: '',
  objetivos: { peso: '', grasa_corporal: '', masa_muscular: '' },
  antropometria: { cintura: '', brazos: '', hombros: '', piernas: '', gluteo: '' },
  inbody: {
    pesoTotal: '', smm: '', grasaPct: '', pesoObjetivo: '', grasaVisceral: '', bmr: '', anguloFase: '',
    ecwTbw: '', masaOsea: '', altura: '', imc: '', version: null, fileUrl: null, fileName: null, ocrDone: false,
  },
  photos: {},
};

// Ángulo de fase y toda la sección de medidas antropométricas quedan
// opcionales a propósito, igual que MODULE3_REQUIRED_FIELDS en el legacy.
const INBODY_REQUIRED_KEYS = ['pesoTotal', 'smm', 'grasaPct', 'pesoObjetivo', 'grasaVisceral', 'bmr', 'ecwTbw', 'masaOsea', 'altura'] as const;

export function validateModule3(draft: Module3Draft): string[] {
  const invalid: string[] = [];
  if (!draft.weight.trim()) invalid.push('weight');
  if (!draft.height.trim()) invalid.push('height');
  if (!draft.bodyFat.trim()) invalid.push('bodyFat');
  if (!draft.objetivos.peso) invalid.push('objetivo_peso');
  if (!draft.objetivos.grasa_corporal) invalid.push('objetivo_grasa_corporal');
  if (!draft.objetivos.masa_muscular) invalid.push('objetivo_masa_muscular');
  for (const key of INBODY_REQUIRED_KEYS) {
    if (!draft.inbody[key]) invalid.push(`inbody_${key}`);
  }
  return invalid;
}

export function computeImc(pesoTotal: string, altura: string): string {
  const w = parseFloat(pesoTotal) || 0;
  const h = parseFloat(altura) || 0;
  return w > 0 && h > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : '';
}

const PHOTO_ANGLES = [
  { key: 'frente', label: 'Frente' },
  { key: 'lado_derecho', label: 'Lado derecho' },
  { key: 'lado_izquierdo', label: 'Lado izquierdo' },
  { key: 'espalda', label: 'Espalda' },
] as const;

const INBODY_NUMBER_FIELDS = [
  ['pesoTotal', 'Peso total (InBody)'],
  ['smm', 'Masa muscular esquelética'],
  ['grasaPct', '% Grasa corporal'],
  ['pesoObjetivo', 'Peso objetivo'],
  ['grasaVisceral', 'Grasa visceral'],
  ['bmr', 'Metabolismo basal (BMR)'],
  ['anguloFase', 'Ángulo de fase'],
  ['ecwTbw', 'Agua corporal total (L)'],
  ['masaOsea', 'Masa ósea'],
  ['altura', 'Estatura (InBody)'],
] as const;

const ANTROPOMETRIA_FIELDS = [
  ['cintura', 'Cintura (cm)'],
  ['brazos', 'Brazos (cm)'],
  ['hombros', 'Hombros (cm)'],
  ['piernas', 'Piernas (cm)'],
  ['gluteo', 'Glúteo (cm)'],
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type Module3Props = {
  clientId: string;
  draft: Module3Draft;
  onChange: (draft: Module3Draft) => void;
  invalidFields: Set<string>;
};

export function Module3({ clientId, draft, onChange, invalidFields }: Module3Props) {
  const [ocrStatus, setOcrStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  function setObjetivo(metrica: keyof Module3Draft['objetivos'], valor: string) {
    const objetivos = { ...draft.objetivos, [metrica]: valor };
    onChange({ ...draft, objetivos });
    // No fatal — igual que setObjetivo() en el legacy, el borrador local
    // avanza aunque esta escritura en segundo plano falle.
    updateClientObjetivos(clientId, objetivos).catch((e: Error) => {
      console.error('No se pudo guardar el objetivo:', e.message);
    });
  }

  async function handleInbodyFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      setOcrStatus({ message: 'El archivo excede 25 MB.', isError: true });
      return;
    }
    setOcrBusy(true);
    setOcrStatus({ message: 'Procesando archivo…', isError: false });
    try {
      const base64 = await fileToBase64(file);
      const { text } = await callOcr(clientId, base64);
      if (!text.trim()) throw new Error('No se pudo extraer texto. Exporta el reporte como JPG/PNG e intenta de nuevo.');
      const parsed = parseOcrText(text);
      const parsedCount = Object.entries(parsed).filter(([k, v]) => k !== '_version' && v != null).length;
      if (parsedCount === 0) throw new Error('No se detectaron campos. Intenta con una captura JPG/PNG del reporte InBody.');

      const nextInbody = {
        ...draft.inbody,
        pesoTotal: parsed.peso_total != null ? String(parsed.peso_total) : '',
        smm: parsed.smm != null ? String(parsed.smm) : '',
        grasaPct: parsed.grasa_pct != null ? String(parsed.grasa_pct) : '',
        pesoObjetivo: parsed.peso_objetivo != null ? String(parsed.peso_objetivo) : '',
        grasaVisceral: parsed.grasa_visceral != null ? String(parsed.grasa_visceral) : '',
        bmr: parsed.bmr != null ? String(parsed.bmr) : '',
        anguloFase: parsed.angulo_fase != null ? String(parsed.angulo_fase) : '',
        ecwTbw: parsed.ecw_tbw != null ? String(parsed.ecw_tbw) : '',
        masaOsea: parsed.masa_osea != null ? String(parsed.masa_osea) : '',
        altura: parsed.height != null ? String(parsed.height) : '',
        version: parsed._version ?? null,
        ocrDone: true,
      };
      nextInbody.imc = computeImc(nextInbody.pesoTotal, nextInbody.altura);

      let fileAttached = false;
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      try {
        const uploaded = await uploadInbodyFile(clientId, file);
        fileUrl = uploaded.file_url;
        fileName = uploaded.file_name;
        fileAttached = true;
      } catch (e) {
        console.error('inbody-upload falló:', e);
      }

      onChange({ ...draft, inbody: { ...nextInbody, fileUrl, fileName } });
      setOcrStatus({
        message: fileAttached
          ? `${parsedCount} campos detectados y rellenados. Archivo adjuntado.`
          : `${parsedCount} campos detectados y rellenados, pero el archivo original NO se pudo adjuntar — inténtalo de nuevo antes de continuar.`,
        isError: !fileAttached,
      });
    } catch (e) {
      setOcrStatus({ message: e instanceof Error ? e.message : 'Error al procesar el archivo.', isError: true });
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div>
      <section>
        <h3>Composición corporal</h3>
        <label htmlFor="field-weight">Peso (kg)</label>
        <input id="field-weight" type="number" value={draft.weight} onChange={(e) => onChange({ ...draft, weight: e.target.value })} />
        {invalidFields.has('weight') && <p role="alert">Este campo es obligatorio.</p>}

        <label htmlFor="field-height">Estatura (cm)</label>
        <input id="field-height" type="number" value={draft.height} onChange={(e) => onChange({ ...draft, height: e.target.value })} />
        {invalidFields.has('height') && <p role="alert">Este campo es obligatorio.</p>}

        <label htmlFor="field-body-fat">% Grasa corporal (si lo conoces)</label>
        <input id="field-body-fat" type="number" value={draft.bodyFat} onChange={(e) => onChange({ ...draft, bodyFat: e.target.value })} />
        {invalidFields.has('bodyFat') && <p role="alert">Este campo es obligatorio.</p>}

        <h4>Tus objetivos de composición corporal</h4>
        {(['peso', 'grasa_corporal', 'masa_muscular'] as const).map((metrica) => (
          <div key={metrica}>
            <label htmlFor={`objetivo-${metrica}`}>¿Cuál es tu objetivo de {metrica.replace('_', ' ')}?</label>
            <select id={`objetivo-${metrica}`} value={draft.objetivos[metrica]} onChange={(e) => setObjetivo(metrica, e.target.value)}>
              <option value="">Selecciona…</option>
              <option value="bajar">Bajar</option>
              <option value="mantener">Mantener</option>
              <option value="subir">Subir</option>
            </select>
            {invalidFields.has(`objetivo_${metrica}`) && <p role="alert">Este campo es obligatorio.</p>}
          </div>
        ))}
      </section>

      <section>
        <h3>Cargar análisis InBody</h3>
        <label htmlFor="field-inbody-file">Sube el PDF o una foto de tu reporte InBody</label>
        <input
          id="field-inbody-file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={ocrBusy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleInbodyFile(file);
          }}
        />
        {ocrStatus && <p role={ocrStatus.isError ? 'alert' : 'status'}>{ocrStatus.message}</p>}
        {draft.inbody.version && <p>Versión detectada: {draft.inbody.version}</p>}

        {INBODY_NUMBER_FIELDS.map(([key, label]) => (
          <div key={key}>
            <label htmlFor={`inbody-${key}`}>{label}</label>
            <input
              id={`inbody-${key}`}
              type="number"
              value={draft.inbody[key]}
              onChange={(e) => {
                const nextInbody = { ...draft.inbody, [key]: e.target.value };
                if (key === 'pesoTotal' || key === 'altura') nextInbody.imc = computeImc(nextInbody.pesoTotal, nextInbody.altura);
                onChange({ ...draft, inbody: nextInbody });
              }}
            />
            {invalidFields.has(`inbody_${key}`) && <p role="alert">Este campo es obligatorio.</p>}
          </div>
        ))}
        <label htmlFor="inbody-imc">IMC calculado</label>
        <input id="inbody-imc" type="text" value={draft.inbody.imc} disabled />
      </section>

      <section>
        <h3>Medidas antropométricas (opcional)</h3>
        {ANTROPOMETRIA_FIELDS.map(([key, label]) => (
          <div key={key}>
            <label htmlFor={`antropometria-${key}`}>{label}</label>
            <input
              id={`antropometria-${key}`}
              type="number"
              value={draft.antropometria[key]}
              onChange={(e) => onChange({ ...draft, antropometria: { ...draft.antropometria, [key]: e.target.value } })}
            />
          </div>
        ))}
      </section>

      <section>
        <h3>Fotos de progreso (opcional)</h3>
        {PHOTO_ANGLES.map((angle) => (
          <div key={angle.key}>
            <label htmlFor={`photo-${angle.key}`}>{angle.label}</label>
            <input
              id={`photo-${angle.key}`}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onChange({ ...draft, photos: { ...draft.photos, [angle.key]: file } });
              }}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/module3.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/onboarding/Module3.tsx apps/web/test/module3.test.tsx
git commit -m "feat(web): add Module3 (composición corporal, objetivos, InBody OCR upload)"
```

---

### Task 10: `WizardShell`, `/onboarding` page, and login redirect

**Files:**
- Create: `apps/web/components/onboarding/WizardShell.tsx`
- Create: `apps/web/app/onboarding/page.tsx`
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Modify: `apps/web/lib/api-client.ts`
- Test: `apps/web/test/onboarding-page.test.tsx`
- Test: `apps/web/test/login-page.test.tsx`

**Interfaces:**
- Consumes: `WIZARD_MODULES`, `CONDITIONAL_RULES` (Task 4); `computeHiddenFieldIds`, `validateWizardModule` (Task 1); `WizardField` (Task 7); `CountryCityPicker` (Task 8); `Module3`, `EMPTY_MODULE3_DRAFT`, `validateModule3` (Task 9); `putPersonalInfo`, `uploadPersonalInfoFile`, `createAnthropometric`, `createPhoto`, `createInbodyRecord` (Task 6); `getSessionToken` (existing `api-client.ts`).
- Produces: `WizardShell` component; `/onboarding` page; `LoginResult` gains `onboardingComplete?: boolean`; login page redirects clients with an incomplete onboarding to `/onboarding`.

- [ ] **Step 1: Extend `LoginResult` and the login page redirect — write the failing test**

Modify the two existing tests in `apps/web/test/login-page.test.tsx` to reflect the new redirect rule (a client whose onboarding isn't complete goes to `/onboarding`; an admin, or a client who already completed it, goes to `/admin/clients`):

```tsx
// apps/web/test/login-page.test.tsx (full replacement)
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

  it('redirects an admin to /admin/clients', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, token: 'abc.def.ghi', role: 'admin', user: { id: '1', name: 'Admin', email: 'a@a.com' } }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/clients'));
  });

  it('redirects a client with an incomplete onboarding to /onboarding', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        token: 'abc.def.ghi',
        role: 'cliente',
        user: { id: '2', name: 'Cliente', email: 'c@c.com' },
        onboardingComplete: false,
      }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c@c.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/onboarding'));
  });

  it('redirects a client who already completed onboarding to /admin/clients', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        token: 'abc.def.ghi',
        role: 'cliente',
        user: { id: '3', name: 'Cliente', email: 'c2@c.com' },
        onboardingComplete: true,
      }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c2@c.com' } });
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/login-page.test.tsx`
Expected: FAIL — currently always redirects to `/admin/clients`

- [ ] **Step 3: Extend `LoginResult` in api-client.ts**

In `apps/web/lib/api-client.ts`, replace:

```ts
export type LoginResult = {
  success: boolean;
  token?: string;
  role?: 'admin' | 'cliente';
  user?: { id: string; name: string; email: string };
  error?: string;
};
```

with:

```ts
export type LoginResult = {
  success: boolean;
  token?: string;
  role?: 'admin' | 'cliente';
  user?: { id: string; name: string; email: string };
  onboardingComplete?: boolean;
  error?: string;
};
```

- [ ] **Step 4: Update the login page redirect**

In `apps/web/app/(auth)/login/page.tsx`, replace:

```tsx
    saveSession(result.token);
    router.push('/admin/clients');
```

with:

```tsx
    saveSession(result.token);
    if (result.role === 'cliente' && !result.onboardingComplete) {
      router.push('/onboarding');
      return;
    }
    router.push('/admin/clients');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/login-page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Write the failing test for the onboarding page**

```tsx
// apps/web/test/onboarding-page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../app/onboarding/page';
import * as apiClient from '../lib/api-client';
import * as onboardingClient from '../lib/onboarding-client';
import * as geoClient from '../lib/geo-client';

vi.mock('../lib/onboarding-client');
vi.mock('../lib/geo-client');

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function fillModule1() {
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1990-01-01' } });
  fireEvent.change(screen.getByLabelText('Género'), { target: { value: 'Masculino' } });
  fireEvent.change(screen.getByLabelText('Ocupación'), { target: { value: 'Ingeniero' } });
  fireEvent.change(screen.getByLabelText('Estado civil'), { target: { value: 'Soltero/a' } });
  fireEvent.change(screen.getByLabelText('País de residencia'), { target: { value: 'CO' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Bogotá' } });
  fireEvent.change(screen.getByLabelText('Celular (WhatsApp)'), { target: { value: '3001234567' } });
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.spyOn(apiClient, 'getSessionToken').mockReturnValue('fake-token');
    vi.mocked(geoClient.getCountries).mockResolvedValue({
      priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }],
      rest: [],
    });
    vi.mocked(geoClient.getCities).mockResolvedValue(['Bogotá']);
  });

  it('redirects to /login when there is no session token', () => {
    vi.spyOn(apiClient, 'getSessionToken').mockReturnValue(null);
    render(<OnboardingPage />);
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('blocks advancing from module 1 when a required field is missing and shows an alert', async () => {
    render(<OnboardingPage />);
    await screen.findByLabelText('País de residencia');
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(screen.queryByLabelText('¿Horas de trabajo al día?')).not.toBeInTheDocument();
  });

  it('advances from module 1 to module 2 once all required fields are filled', async () => {
    render(<OnboardingPage />);
    await screen.findByLabelText('País de residencia');
    fillModule1();
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findByLabelText('¿Horas de trabajo al día?')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/onboarding-page.test.tsx`
Expected: FAIL with "Cannot find module '../app/onboarding/page'"

- [ ] **Step 8: Write `WizardShell.tsx`**

```tsx
// apps/web/components/onboarding/WizardShell.tsx
'use client';

import { useState } from 'react';
import { computeHiddenFieldIds, validateWizardModule } from '@latribu/shared-types';
import { WIZARD_MODULES, CONDITIONAL_RULES } from '../../lib/wizard-modules';
import { WizardField } from './WizardField';
import { CountryCityPicker, type CountryCityValue } from './CountryCityPicker';
import { Module3, EMPTY_MODULE3_DRAFT, validateModule3, type Module3Draft } from './Module3';
import {
  putPersonalInfo,
  uploadPersonalInfoFile,
  createAnthropometric,
  createPhoto,
  createInbodyRecord,
} from '../../lib/onboarding-client';

type WizardData = Record<string, string | string[]>;

const PHOTO_ANGLE_KEYS = ['frente', 'lado_derecho', 'lado_izquierdo', 'espalda'] as const;

export type WizardShellProps = {
  clientId: string;
};

export function WizardShell({ clientId }: WizardShellProps) {
  const [step, setStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [otroValues, setOtroValues] = useState<Record<string, string>>({});
  const [pendingCheckupFile, setPendingCheckupFile] = useState<File | null>(null);
  const [module3Draft, setModule3Draft] = useState<Module3Draft>(EMPTY_MODULE3_DRAFT);
  const [invalidFieldIds, setInvalidFieldIds] = useState<Set<string>>(new Set());
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const mod = WIZARD_MODULES.find((m) => m.n === step)!;
  const hiddenFieldIds = computeHiddenFieldIds(CONDITIONAL_RULES, wizardData);

  function handleFieldChange(id: string, value: string | string[]) {
    setWizardData((prev) => ({ ...prev, [id]: value }));
  }

  function handleOtroChange(id: string, value: string) {
    setOtroValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleFileChange(id: string, file: File | null) {
    if (id === 'checkup_file') setPendingCheckupFile(file);
    setWizardData((prev) => ({ ...prev, [id]: file?.name || '' }));
  }

  function handleCountryCityChange(patch: Partial<CountryCityValue>) {
    setWizardData((prev) => ({
      ...prev,
      ...(patch.country !== undefined ? { country: patch.country } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.phoneCode !== undefined ? { phone_code: patch.phoneCode } : {}),
      ...(patch.phoneNumber !== undefined ? { phone_number: patch.phoneNumber } : {}),
    }));
  }

  async function finalize() {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      let onboardingReport: Record<string, unknown> = { ...wizardData };
      for (const [fieldId, otro] of Object.entries(otroValues)) {
        onboardingReport[`${fieldId}_otro`] = otro;
      }
      if (pendingCheckupFile) {
        const uploaded = await uploadPersonalInfoFile(clientId, pendingCheckupFile, onboardingReport);
        onboardingReport = {
          ...onboardingReport,
          checkup_file_url: uploaded.file_url,
          checkup_file_name: uploaded.file_name,
          checkup_uploaded_at: uploaded.uploaded_at,
        };
      }

      await putPersonalInfo(clientId, {
        birthdate: wizardData.birthdate as string,
        gender: wizardData.gender as string,
        occupation: wizardData.occupation as string,
        marital_status: wizardData.marital_status as string,
        country: wizardData.country as string,
        city: wizardData.city as string,
        phone_code: wizardData.phone_code as string,
        phone_number: wizardData.phone_number as string,
        weight: module3Draft.weight ? Number(module3Draft.weight) : null,
        height: module3Draft.height ? Number(module3Draft.height) : null,
        body_fat: module3Draft.bodyFat ? Number(module3Draft.bodyFat) : null,
        onboarding_report: onboardingReport,
        complete: true,
      });

      const monthNum = 1; // primer registro del onboarding — siempre mes 1
      const { cintura, brazos, hombros, piernas, gluteo } = module3Draft.antropometria;
      if (cintura || brazos || hombros || piernas || gluteo) {
        await createAnthropometric(clientId, {
          fecha: new Date().toISOString().slice(0, 10),
          peso: module3Draft.weight ? Number(module3Draft.weight) : null,
          cintura: cintura ? Number(cintura) : null,
          brazos: brazos ? Number(brazos) : null,
          hombros: hombros ? Number(hombros) : null,
          piernas: piernas ? Number(piernas) : null,
          gluteo: gluteo ? Number(gluteo) : null,
          mes_num: monthNum,
        });
      }

      for (const angle of PHOTO_ANGLE_KEYS) {
        const file = module3Draft.photos[angle];
        if (file) await createPhoto(clientId, file, angle, monthNum);
      }

      if (module3Draft.inbody.ocrDone && module3Draft.inbody.pesoTotal) {
        await createInbodyRecord(clientId, {
          fecha: new Date().toISOString().slice(0, 10),
          version: module3Draft.inbody.version,
          peso_total: Number(module3Draft.inbody.pesoTotal),
          smm: module3Draft.inbody.smm ? Number(module3Draft.inbody.smm) : null,
          grasa_pct: module3Draft.inbody.grasaPct ? Number(module3Draft.inbody.grasaPct) : null,
          imc: module3Draft.inbody.imc ? Number(module3Draft.inbody.imc) : null,
          peso_objetivo: module3Draft.inbody.pesoObjetivo ? Number(module3Draft.inbody.pesoObjetivo) : null,
          grasa_visceral: module3Draft.inbody.grasaVisceral ? Number(module3Draft.inbody.grasaVisceral) : null,
          bmr: module3Draft.inbody.bmr ? Number(module3Draft.inbody.bmr) : null,
          angulo_fase: module3Draft.inbody.anguloFase ? Number(module3Draft.inbody.anguloFase) : null,
          ecw_tbw: module3Draft.inbody.ecwTbw ? Number(module3Draft.inbody.ecwTbw) : null,
          masa_osea: module3Draft.inbody.masaOsea ? Number(module3Draft.inbody.masaOsea) : null,
          altura: module3Draft.inbody.altura ? Number(module3Draft.inbody.altura) : null,
          mes_num: monthNum,
          file_url: module3Draft.inbody.fileUrl,
          file_name: module3Draft.inbody.fileName,
        });
      }

      setComplete(true);
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setFinalizing(false);
    }
  }

  function handleContinue() {
    if (mod.custom === 'country') {
      const invalid: string[] = [];
      if (!wizardData.country) invalid.push('country');
      if (!wizardData.city) invalid.push('city');
      if (!wizardData.phone_number) invalid.push('phone_number');
      setInvalidFieldIds(new Set(invalid));
      if (invalid.length > 0) return;
      setStep(2);
      return;
    }
    if (mod.custom === 'body') {
      const invalid = validateModule3(module3Draft);
      setInvalidFieldIds(new Set(invalid));
      if (invalid.length > 0) return;
      setStep(4);
      return;
    }
    const invalid = validateWizardModule(mod.fields, wizardData, hiddenFieldIds);
    setInvalidFieldIds(new Set(invalid));
    if (invalid.length > 0) return;
    if (step < 9) {
      setStep(step + 1);
      return;
    }
    void finalize();
  }

  if (complete) {
    return (
      <div>
        <h1>¡Listo!</h1>
        <p>Datos guardados. Tu coach te contactará lo antes posible.</p>
      </div>
    );
  }

  return (
    <div>
      <p>
        Módulo {step} de 9 · {mod.title}
      </p>

      {mod.custom === 'country' && (
        <CountryCityPicker
          value={{
            country: (wizardData.country as string) || '',
            city: (wizardData.city as string) || '',
            phoneCode: (wizardData.phone_code as string) || '+57',
            phoneNumber: (wizardData.phone_number as string) || '',
          }}
          onChange={handleCountryCityChange}
        />
      )}

      {mod.custom === 'body' && (
        <Module3 clientId={clientId} draft={module3Draft} onChange={setModule3Draft} invalidFields={invalidFieldIds} />
      )}

      {!mod.custom &&
        mod.fields.map((field) => (
          <WizardField
            key={field.id}
            field={field}
            value={wizardData[field.id]}
            otroValue={otroValues[field.id]}
            hidden={hiddenFieldIds.has(field.id)}
            invalid={invalidFieldIds.has(field.id)}
            onChange={handleFieldChange}
            onOtroChange={handleOtroChange}
            onFileChange={handleFileChange}
          />
        ))}

      {finalizeError && <p role="alert">{finalizeError}</p>}

      <button type="button" disabled={step === 1} onClick={() => setStep(step - 1)}>
        Anterior
      </button>
      <button type="button" disabled={finalizing} onClick={handleContinue}>
        {step === 9 ? 'Finalizar' : 'Continuar'}
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Write `app/onboarding/page.tsx`**

```tsx
// apps/web/app/onboarding/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionToken } from '../../lib/api-client';
import { WizardShell } from '../../components/onboarding/WizardShell';

// El JWT ya trae el id del cliente en su payload (mismo `TokenPayload` que
// firma apps/api) — decodificarlo aquí evita un round-trip a /api/auth/me
// solo para saber "quién soy" antes de renderizar el wizard. La autorización
// real de cada llamada la sigue haciendo el backend (ownerOrAdmin) sin
// importar lo que este decode diga.
function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setClientId(decodeClientIdFromToken(token));
  }, [router]);

  if (!clientId) return null;

  return <WizardShell clientId={clientId} />;
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/onboarding-page.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 11: Run the full apps/web suite to confirm no regression**

Run: `cd apps/web && npx vitest run`
Expected: all tests PASS

- [ ] **Step 12: Commit**

```bash
git add apps/web/components/onboarding/WizardShell.tsx apps/web/app/onboarding/page.tsx apps/web/app/\(auth\)/login/page.tsx apps/web/lib/api-client.ts apps/web/test/onboarding-page.test.tsx apps/web/test/login-page.test.tsx
git commit -m "feat(web): add WizardShell, the /onboarding page, and role-based login redirect"
```

---

## Final Verification

- [ ] Run the whole monorepo's tests once more end to end:
  - `npx tsc -p packages/shared-types/tsconfig.json`
  - `cd packages/shared-types && npx vitest run`
  - `cd apps/api && npx vitest run`
  - `cd apps/web && npx vitest run`
- [ ] Confirm `git status` on `main`/the feature branch shows only the files touched by this plan's 10 tasks.
- [ ] Manually sanity-check (dev servers, not part of automated tests) that `/onboarding` renders module 1 first and that `GET /api/countries` responds from a running `apps/api`.
