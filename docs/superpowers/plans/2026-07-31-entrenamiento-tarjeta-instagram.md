# Entrenamiento — Compartir Tarjeta a Instagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the disabled "Compartir" button in `SessionConfirmedScreen` generate and share a 1080×1920 Instagram-story card (racha, logros, frase, marca) via `navigator.share`/download fallback, backed by a new generic `GET /training/phrase?context=` endpoint.

**Architecture:** A pure canvas-drawing module (`training-card.ts`) and a pure sharing module (`share-card.ts`) in `apps/web`, wired into `SessionConfirmedScreen` behind a new `clientId` prop and a `handleShare` handler. Backend gains one read-only service function (`getPhraseByContext`) and one route (`GET /:id/training/phrase`) reusing the already-existing `pickRandomPhrase`.

**Tech Stack:** Express + TypeScript (`apps/api`), Next.js App Router + React (`apps/web`), Drizzle/Postgres, Vitest (both packages, jsdom for web).

## Global Constraints

- No custom/embedded font: draw the card with `Georgia, serif` (system font), not the legacy's base64 "Fraunces Card" WOFF2. Preserve the legacy's per-block weight/italic/size choices otherwise.
- `GET /api/clients/:id/training/phrase?context=confirmacion|instagram` is gated by `ownerOrAdmin` + `requirePermission('training')`, exactly like `/training/streak` and `/training/use-protector`.
- Invalid/missing `context` query param → 400. No new Zod schema — manual validation in the controller, matching the legacy's own manual check (`server.js:1077-1086`).
- Card canvas is always 1080×1920, `CARD_SCALE = 1080 / 260` (base design 260×462), reusing the same 4 draw blocks and same color/position constants as the legacy (`index.html:3167-3251`).
- `computeAchievements(streakWeeks)` is a direct, pure port: `{ medalsInCurrentCycle: streakWeeks % 4, trophiesEarned: Math.floor(streakWeeks / 4) }` (legacy `index.html:3145-3151`).
- Sharing: try `navigator.share` when `navigator.canShare({ files: [file] })` is truthy; otherwise fall back to a synthetic `<a download>` + `URL.createObjectURL`/`revokeObjectURL`. Swallow `AbortError` silently; re-throw everything else.
- No production cutover. `server.js`/`index.html` keep running unchanged and untouched by this plan (read-only reference only).

---

### Task 1: Backend — `getPhraseByContext` service function + `GET /training/phrase` endpoint

**Files:**
- Modify: `apps/api/src/services/training.service.ts` — add `getPhraseByContext`.
- Modify: `apps/api/src/controllers/training.controller.ts` — add `getPhraseByContext` handler.
- Modify: `apps/api/src/routes/training.routes.ts` — add the route.
- Test: `apps/api/test/training.routes.test.ts` — add a `describe('GET /training/phrase')` block.

**Interfaces:**
- Consumes: `pickRandomPhrase(pool: Phrase[], context: string): Phrase | null` (already exported from `apps/api/src/services/training.service.ts`); `phrases` table and `Phrase` type (already exported from `apps/api/src/models/schema.js`); `ownerOrAdmin`, `requirePermission('training')` middleware (already used by the streak/use-protector routes).
- Produces: `getPhraseByContext(context: string): Promise<string | null>` (service), `GET /api/clients/:id/training/phrase?context=confirmacion|instagram` returning `{ success: true, phrase: string | null }` on 200, `{ success: false, error }` on 400 for an invalid context.

- [ ] **Step 1: Write the failing service test**

Add to `apps/api/test/training.routes.test.ts`, inside the existing `describe('training routes', ...)` block (after the existing `describe('GET /training/streak', ...)` block, alongside the other nested describes):

```ts
describe('GET /training/phrase', () => {
  it('rejects an invalid context', async () => {
    const res = await request(app)
      .get(`/api/clients/${clientId}/training/phrase?context=bogus`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(400);
  });

  it('returns null when there are no eligible phrases', async () => {
    const res = await request(app)
      .get(`/api/clients/${clientId}/training/phrase?context=instagram`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.phrase).toBeNull();
  });

  it('draws a phrase matching the requested context', async () => {
    const [igPhrase] = await db
      .insert(phrases)
      .values({ text: 'Frase de Instagram', context: 'instagram', active: true })
      .returning();
    const [confirmPhrase] = await db
      .insert(phrases)
      .values({ text: 'Frase de confirmación', context: 'confirmacion', active: true })
      .returning();

    const res = await request(app)
      .get(`/api/clients/${clientId}/training/phrase?context=instagram`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.phrase).toBe('Frase de Instagram');

    await db.delete(phrases).where(eq(phrases.id, igPhrase.id));
    await db.delete(phrases).where(eq(phrases.id, confirmPhrase.id));
  });

  it('draws a phrase whose context is "ambas" for either context', async () => {
    const [bothPhrase] = await db
      .insert(phrases)
      .values({ text: 'Frase para ambas', context: 'ambas', active: true })
      .returning();

    const res = await request(app)
      .get(`/api/clients/${clientId}/training/phrase?context=confirmacion`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.phrase).toBe('Frase para ambas');

    await db.delete(phrases).where(eq(phrases.id, bothPhrase.id));
  });

  it('rejects a client requesting another client\'s phrase', async () => {
    const [otherClient] = await db
      .insert(clients)
      .values({ name: 'Other Phrase Client', email: `otherphrase-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1', permissions: { training: true } })
      .returning();
    const res = await request(app)
      .get(`/api/clients/${otherClient.id}/training/phrase?context=instagram`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
    await db.delete(clients).where(eq(clients.id, otherClient.id));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts -t "GET /training/phrase"`
Expected: FAIL — route does not exist (404s), so status/body assertions fail.

- [ ] **Step 3: Implement `getPhraseByContext` in the service**

In `apps/api/src/services/training.service.ts`, add after `pickRandomPhrase`:

```ts
export async function getPhraseByContext(context: string): Promise<string | null> {
  const pool = await db.select().from(phrases).where(eq(phrases.active, true));
  const drawn = pickRandomPhrase(pool, context);
  return drawn ? drawn.text : null;
}
```

- [ ] **Step 4: Add the controller handler**

In `apps/api/src/controllers/training.controller.ts`, add:

```ts
export async function getPhraseByContext(req: Request, res: Response) {
  const context = typeof req.query.context === 'string' ? req.query.context : '';
  if (context !== 'confirmacion' && context !== 'instagram') {
    return err(res, 'Contexto inválido.', 400);
  }
  const phrase = await trainingService.getPhraseByContext(context);
  return ok(res, { phrase });
}
```

- [ ] **Step 5: Add the route**

In `apps/api/src/routes/training.routes.ts`, add after the `training/achievements` route:

```ts
trainingRouter.get(
  '/:id/training/phrase',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  asyncHandler(trainingController.getPhraseByContext)
);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run test/training.routes.test.ts`
Expected: PASS (all training route tests, including the new `GET /training/phrase` block).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/training.service.ts apps/api/src/controllers/training.controller.ts apps/api/src/routes/training.routes.ts apps/api/test/training.routes.test.ts
git commit -m "feat(api): add GET /training/phrase endpoint for the Instagram card"
```

---

### Task 2: Frontend — `training-client.ts` gains `getPhraseByContext`

**Files:**
- Modify: `apps/web/lib/training-client.ts` — add `getPhraseByContext`.
- Test: `apps/web/test/training-client.test.ts` — add test cases.

**Interfaces:**
- Consumes: `authorizedRequest<T>(path, method, body?)` (private helper already defined at the top of `training-client.ts`).
- Produces: `getPhraseByContext(clientId: string, context: 'confirmacion' | 'instagram'): Promise<string | null>`.

- [ ] **Step 1: Write the failing test**

Look at the existing test file's mocking pattern first (it mocks `global.fetch`). Add, following that same pattern:

```ts
describe('getPhraseByContext', () => {
  it('returns the phrase text on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: 'Vamos con todo' }),
    }) as unknown as typeof fetch;

    const result = await getPhraseByContext('client-1', 'instagram');
    expect(result).toBe('Vamos con todo');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/clients/client-1/training/phrase?context=instagram'),
      expect.anything()
    );
  });

  it('returns null when the backend has no eligible phrase', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, phrase: null }),
    }) as unknown as typeof fetch;

    const result = await getPhraseByContext('client-1', 'confirmacion');
    expect(result).toBeNull();
  });

  it('throws when the backend reports failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Contexto inválido.' }),
    }) as unknown as typeof fetch;

    await expect(getPhraseByContext('client-1', 'instagram')).rejects.toThrow('Contexto inválido.');
  });
});
```

Add the `getPhraseByContext` import to this test file's existing import line from `../lib/training-client`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/training-client.test.ts -t "getPhraseByContext"`
Expected: FAIL with "getPhraseByContext is not a function" or similar.

- [ ] **Step 3: Implement `getPhraseByContext`**

In `apps/web/lib/training-client.ts`, add after `getAchievements`:

```ts
export async function getPhraseByContext(clientId: string, context: 'confirmacion' | 'instagram'): Promise<string | null> {
  const body = await authorizedRequest<{ success: boolean; phrase: string | null; error?: string }>(
    `/api/clients/${clientId}/training/phrase?context=${context}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener la frase.');
  return body.phrase;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/training-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/training-client.ts apps/web/test/training-client.test.ts
git commit -m "feat(web): add getPhraseByContext to training-client"
```

---

### Task 3: Frontend — `lib/training-card.ts` (computeAchievements + drawInstagramCard)

**Files:**
- Create: `apps/web/lib/training-card.ts`
- Test: `apps/web/test/training-card.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure module).
- Produces: `computeAchievements(streakWeeks: number): { medalsInCurrentCycle: number; trophiesEarned: number }`; `drawInstagramCard(ctx: CanvasRenderingContext2D, { streakWeeks, phrase }: { streakWeeks: number; phrase: string | null }): void`. Task 5 (`SessionConfirmedScreen`) calls both by these exact names.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/training-card.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { computeAchievements, drawInstagramCard } from '../lib/training-card';

describe('computeAchievements', () => {
  it('returns 0 medals and 0 trophies for a streak of 0', () => {
    expect(computeAchievements(0)).toEqual({ medalsInCurrentCycle: 0, trophiesEarned: 0 });
  });

  it('returns 0 medals and 1 trophy for a streak of exactly 4', () => {
    expect(computeAchievements(4)).toEqual({ medalsInCurrentCycle: 0, trophiesEarned: 1 });
  });

  it('returns 1 medal and 1 trophy for a streak of 5', () => {
    expect(computeAchievements(5)).toEqual({ medalsInCurrentCycle: 1, trophiesEarned: 1 });
  });

  it('returns 3 medals and 2 trophies for a streak of 11', () => {
    expect(computeAchievements(11)).toEqual({ medalsInCurrentCycle: 3, trophiesEarned: 2 });
  });
});

function createMockCtx() {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 10 }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    letterSpacing: '0px',
  } as unknown as CanvasRenderingContext2D;
}

describe('drawInstagramCard', () => {
  it('fills the background and draws the streak number and brand text', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 3, phrase: null });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920);
    expect(ctx.fillText).toHaveBeenCalledWith('3', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('SEMANAS SEGUIDAS', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('La Tribu', expect.any(Number), expect.any(Number));
  });

  it('uses singular "SEMANA SEGUIDA" for a streak of exactly 1', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 1, phrase: null });
    expect(ctx.fillText).toHaveBeenCalledWith('SEMANA SEGUIDA', expect.any(Number), expect.any(Number));
  });

  it('does not draw phrase text when phrase is null', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 2, phrase: null });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((text: string) => text.includes('"'))).toBe(false);
  });

  it('wraps a long phrase across multiple fillText calls', () => {
    const ctx = createMockCtx();
    (ctx.measureText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => ({
      width: text.length * 20,
    }));
    drawInstagramCard(ctx, { streakWeeks: 2, phrase: 'Una frase muy larga que definitivamente no cabe en una sola linea del diseño' });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    const phraseLines = calls.filter((text: string) => text.includes('Una') || text.includes('frase') || text.includes('linea'));
    expect(phraseLines.length).toBeGreaterThan(1);
  });

  it('draws medal and trophy row text when the streak has achievements', () => {
    const ctx = createMockCtx();
    drawInstagramCard(ctx, { streakWeeks: 5, phrase: null });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((text: string) => text.includes('copas'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/training-card.test.ts`
Expected: FAIL — `../lib/training-card` does not exist.

- [ ] **Step 3: Implement `lib/training-card.ts`**

Port directly from the legacy (`index.html:3145-3251`), replacing `"Fraunces Card"` with `Georgia, serif` in every `ctx.font` assignment, and `Math.random()`-free (no randomness in this file):

```ts
// Puerto directo de computeAchievements/drawInstagramCard del legacy (index.html:3145-3251).
// streakWeeks=11 → trophiesEarned=2 (🏆🏆), medalsInCurrentCycle=3 (🎖️🎖️🎖️ + 1 slot vacío).
// Las copas nunca se resetean; las medallas del ciclo actual sí, cada 4.
export function computeAchievements(streakWeeks: number): { medalsInCurrentCycle: number; trophiesEarned: number } {
  return {
    medalsInCurrentCycle: streakWeeks % 4,
    trophiesEarned: Math.floor(streakWeeks / 4),
  };
}

const CARD_SCALE = 1080 / 260;

export function drawInstagramCard(ctx: CanvasRenderingContext2D, { streakWeeks, phrase }: { streakWeeks: number; phrase: string | null }): void {
  const W = 1080;
  const H = 1920;
  const s = (n: number) => n * CARD_SCALE;

  const bg = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, W * 0.75);
  bg.addColorStop(0, '#2A2118');
  bg.addColorStop(1, '#14100A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const padTop = H * 0.185;
  const padBottom = H * 0.145;
  const { medalsInCurrentCycle, trophiesEarned } = computeAchievements(streakWeeks);

  // Bloque 1: fila de logros
  const rowY = padTop - s(36);
  ctx.textBaseline = 'middle';
  ctx.font = `${s(12)}px Georgia, serif`;
  ctx.fillStyle = '#E8C97D';
  ctx.textAlign = 'left';
  if (trophiesEarned > 0) ctx.fillText(`${'🏆'.repeat(trophiesEarned)} copas`, s(22), rowY);
  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.85;
  ctx.letterSpacing = `${s(2)}px`;
  ctx.fillText(`${'🎖️'.repeat(medalsInCurrentCycle)}${'○'.repeat(4 - medalsInCurrentCycle)}`, W - s(22), rowY);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;

  // Bloque 2: sello circular
  const sealCenterY = H * 0.42;
  const sealR = s(75);
  ctx.beginPath();
  ctx.arc(W / 2, sealCenterY, sealR, 0, Math.PI * 2);
  ctx.strokeStyle = '#E8C97D';
  ctx.lineWidth = s(2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, sealCenterY, sealR - s(8), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(232,201,125,.4)';
  ctx.lineWidth = s(1);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#B8A88A';
  ctx.font = `${s(7.5)}px Georgia, serif`;
  ctx.letterSpacing = `${s(0.12 * 7.5)}px`;
  ctx.fillText('MI RACHA', W / 2, sealCenterY - s(28));
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#F8EFDD';
  ctx.font = `800 ${s(42)}px Georgia, serif`;
  ctx.fillText(String(streakWeeks), W / 2, sealCenterY);

  ctx.fillStyle = '#E8C97D';
  ctx.font = `${s(9)}px Georgia, serif`;
  ctx.fillText(streakWeeks === 1 ? 'SEMANA SEGUIDA' : 'SEMANAS SEGUIDAS', W / 2, sealCenterY + s(28));

  // Bloque 3: frase
  if (phrase) {
    ctx.fillStyle = '#F3E9D2';
    ctx.font = `italic ${s(14)}px Georgia, serif`;
    const maxWidth = s(200);
    const words = `"${phrase}"`.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const lineHeight = s(14) * 1.4;
    const phraseY = H - padBottom - s(90) - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, phraseY + i * lineHeight));
  }

  // Bloque 4: marca
  const brandY = H - padBottom;
  ctx.fillStyle = '#E8C97D';
  ctx.font = `700 ${s(13)}px Georgia, serif`;
  ctx.fillText('La Tribu', W / 2, brandY - s(14));
  ctx.fillStyle = '#9C8A67';
  ctx.font = `${s(7.5)}px Georgia, serif`;
  ctx.letterSpacing = `${s(0.05 * 7.5)}px`;
  ctx.fillText('COMUNIDAD DE BIENESTAR Y ALTO RENDIMIENTO', W / 2, brandY);
  ctx.letterSpacing = '0px';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/training-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/training-card.ts apps/web/test/training-card.test.ts
git commit -m "feat(web): add computeAchievements/drawInstagramCard, ported with a system font"
```

---

### Task 4: Frontend — `lib/share-card.ts` (shareCanvasAsImage)

**Files:**
- Create: `apps/web/lib/share-card.ts`
- Test: `apps/web/test/share-card.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure module operating on a `HTMLCanvasElement`).
- Produces: `shareCanvasAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void>`. Task 5 calls this by this exact name.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/share-card.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareCanvasAsImage } from '../lib/share-card';

function createMockCanvas(blob: Blob | null) {
  return {
    toBlob: (cb: (b: Blob | null) => void) => cb(blob),
  } as unknown as HTMLCanvasElement;
}

describe('shareCanvasAsImage', () => {
  const originalShare = (navigator as unknown as { share?: unknown }).share;
  const originalCanShare = (navigator as unknown as { canShare?: unknown }).canShare;

  afterEach(() => {
    (navigator as unknown as { share?: unknown }).share = originalShare;
    (navigator as unknown as { canShare?: unknown }).canShare = originalCanShare;
    vi.restoreAllMocks();
  });

  it('uses navigator.share when canShare returns true', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    (navigator as unknown as { canShare: unknown }).canShare = vi.fn().mockReturnValue(true);
    (navigator as unknown as { share: unknown }).share = shareMock;

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await shareCanvasAsImage(canvas, 'la-tribu-racha.png');

    expect(shareMock).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it('falls back to a synthetic download when canShare is unavailable', async () => {
    (navigator as unknown as { canShare: unknown }).canShare = undefined;
    (navigator as unknown as { share: unknown }).share = undefined;

    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await shareCanvasAsImage(canvas, 'la-tribu-racha.png');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('swallows an AbortError from navigator.share', async () => {
    const abortError = new DOMException('cancelled', 'AbortError');
    (navigator as unknown as { canShare: unknown }).canShare = vi.fn().mockReturnValue(true);
    (navigator as unknown as { share: unknown }).share = vi.fn().mockRejectedValue(abortError);

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await expect(shareCanvasAsImage(canvas, 'la-tribu-racha.png')).resolves.toBeUndefined();
  });

  it('re-throws a non-AbortError from navigator.share', async () => {
    (navigator as unknown as { canShare: unknown }).canShare = vi.fn().mockReturnValue(true);
    (navigator as unknown as { share: unknown }).share = vi.fn().mockRejectedValue(new Error('boom'));

    const blob = new Blob(['fake'], { type: 'image/png' });
    const canvas = createMockCanvas(blob);

    await expect(shareCanvasAsImage(canvas, 'la-tribu-racha.png')).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/share-card.test.ts`
Expected: FAIL — `../lib/share-card` does not exist.

- [ ] **Step 3: Implement `lib/share-card.ts`**

```ts
// Puerto de shareTrainingCard del legacy (index.html:3256-3285), separado
// del dibujo del canvas para poder testearlo de forma aislada.
export async function shareCanvasAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], filename, { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[] }) => Promise<void> };

  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e;
    }
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/share-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/share-card.ts apps/web/test/share-card.test.ts
git commit -m "feat(web): add shareCanvasAsImage with Web Share API + download fallback"
```

---

### Task 5: Frontend — wire "Compartir" into `SessionConfirmedScreen`

**Files:**
- Modify: `apps/web/components/training/SessionConfirmedScreen.tsx`
- Modify: `apps/web/components/training/TrainingShell.tsx` — pass the new `clientId` prop.
- Test: `apps/web/test/session-confirmed-screen.test.tsx`
- Test: `apps/web/test/training-shell.test.tsx` — update the existing render call for `SessionConfirmedScreen`'s new required prop (only if that test file renders `SessionConfirmedScreen` directly; otherwise no change needed since `TrainingShell` already passes `clientId` through as its own prop).

**Interfaces:**
- Consumes: `getPhraseByContext(clientId, context)` from `apps/web/lib/training-client.ts` (Task 2); `computeAchievements`/`drawInstagramCard` are NOT called directly here — `drawInstagramCard(ctx, { streakWeeks, phrase })` from `apps/web/lib/training-card.ts` (Task 3); `shareCanvasAsImage(canvas, filename)` from `apps/web/lib/share-card.ts` (Task 4).
- Produces: `SessionConfirmedScreen` now requires a `clientId: string` prop; its "Compartir" button becomes enabled and functional.

- [ ] **Step 1: Write the failing tests**

Read the existing `apps/web/test/session-confirmed-screen.test.tsx` first to match its current render call and mocking conventions, then add these cases (adjust the existing render calls in that file to also pass `clientId="client-1"`, since it becomes a required prop):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionConfirmedScreen } from '../components/training/SessionConfirmedScreen';
import * as trainingClient from '../lib/training-client';
import * as trainingCard from '../lib/training-card';
import * as shareCard from '../lib/share-card';

const streak = {
  streakWeeks: 2,
  sessionsDoneThisWeek: 3,
  sessionsRequiredThisWeek: 3,
  protectorAvailable: true,
  protectorUsedThisWeek: false,
  atRisk: false,
};

describe('SessionConfirmedScreen — Compartir', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('disables the button while generating, then re-enables it after success', async () => {
    vi.spyOn(trainingClient, 'getPhraseByContext').mockResolvedValue('Vamos con todo');
    vi.spyOn(trainingCard, 'drawInstagramCard').mockImplementation(() => {});
    vi.spyOn(shareCard, 'shareCanvasAsImage').mockResolvedValue(undefined);

    render(<SessionConfirmedScreen streak={streak} phrase={null} clientId="client-1" onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Compartir' });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(button).toBeDisabled();

    await waitFor(() => expect(button).toBeEnabled());
    expect(shareCard.shareCanvasAsImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 'la-tribu-racha.png');
    expect(trainingCard.drawInstagramCard).toHaveBeenCalledWith(expect.anything(), { streakWeeks: 2, phrase: 'Vamos con todo' });
  });

  it('draws the card with a null phrase when the phrase fetch fails (non-fatal)', async () => {
    vi.spyOn(trainingClient, 'getPhraseByContext').mockRejectedValue(new Error('network'));
    vi.spyOn(trainingCard, 'drawInstagramCard').mockImplementation(() => {});
    vi.spyOn(shareCard, 'shareCanvasAsImage').mockResolvedValue(undefined);

    render(<SessionConfirmedScreen streak={streak} phrase={null} clientId="client-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(trainingCard.drawInstagramCard).toHaveBeenCalled());
    expect(trainingCard.drawInstagramCard).toHaveBeenCalledWith(expect.anything(), { streakWeeks: 2, phrase: null });
  });

  it('shows a short error message without blocking Cerrar when sharing fails', async () => {
    vi.spyOn(trainingClient, 'getPhraseByContext').mockResolvedValue(null);
    vi.spyOn(trainingCard, 'drawInstagramCard').mockImplementation(() => {});
    vi.spyOn(shareCard, 'shareCanvasAsImage').mockRejectedValue(new Error('boom'));

    const onClose = vi.fn();
    render(<SessionConfirmedScreen streak={streak} phrase={null} clientId="client-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    expect(closeButton).toBeEnabled();
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/session-confirmed-screen.test.tsx`
Expected: FAIL — button is `disabled` with text "Compartir (Próximamente)", `clientId` prop not accepted, no calls to the mocked modules.

- [ ] **Step 3: Implement the share handler in `SessionConfirmedScreen.tsx`**

Replace the full file content:

```tsx
'use client';

import { useState, useRef } from 'react';
import type { TrainingStreak } from '../../lib/training-client';
import { getPhraseByContext } from '../../lib/training-client';
import { drawInstagramCard } from '../../lib/training-card';
import { shareCanvasAsImage } from '../../lib/share-card';

export type SessionConfirmedScreenProps = {
  streak: TrainingStreak;
  phrase: string | null;
  clientId: string;
  onClose: () => void;
};

export function SessionConfirmedScreen({ streak, phrase, clientId, onClose }: SessionConfirmedScreenProps) {
  const dots = Array.from({ length: streak.sessionsRequiredThisWeek }, (_, i) => i + 1);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      let cardPhrase: string | null = null;
      try {
        cardPhrase = await getPhraseByContext(clientId, 'instagram');
      } catch {
        cardPhrase = null;
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 1080;
        canvasRef.current.height = 1920;
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) drawInstagramCard(ctx, { streakWeeks: streak.streakWeeks, phrase: cardPhrase });

      await shareCanvasAsImage(canvas, 'la-tribu-racha.png');
    } catch (e) {
      setShareError('No pudimos generar la tarjeta. Intenta de nuevo.');
    } finally {
      setSharing(false);
    }
  }

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
      {shareError && <p role="alert">{shareError}</p>}
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
      <button type="button" onClick={handleShare} disabled={sharing}>
        Compartir
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Pass `clientId` from `TrainingShell`**

In `apps/web/components/training/TrainingShell.tsx`, update the `SessionConfirmedScreen` render call (around line 122):

```tsx
  if (confirmedResult) {
    return (
      <SessionConfirmedScreen
        streak={confirmedResult.streak}
        phrase={confirmedResult.phrase}
        clientId={clientId}
        onClose={closeConfirmedScreen}
      />
    );
  }
```

- [ ] **Step 5: Check `apps/web/app/training/page.tsx` for a second `SessionConfirmedScreen` render call (the NFC path)**

The NFC deep-link flow in `apps/web/app/training/page.tsx` also renders `SessionConfirmedScreen` directly (per the Racha/Protector/NFC sub-project). Find that render call and add `clientId={clientId}` (the variable already holds the decoded client id in that file — use whatever it's named there, do not rename it).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run`
Expected: PASS across the whole `apps/web` suite — this also catches any other place that renders `SessionConfirmedScreen` without the new required prop (TypeScript will fail to compile if any caller is missed; fix any such caller the same way as Step 4/5).

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/training/SessionConfirmedScreen.tsx apps/web/components/training/TrainingShell.tsx apps/web/app/training/page.tsx apps/web/test/session-confirmed-screen.test.tsx
git commit -m "feat(web): make the Compartir button generate and share the Instagram card"
```

---

## Self-Review Notes

- **Spec coverage:** backend endpoint (Task 1), `training-client.ts` wrapper (Task 2), `training-card.ts` (Task 3), `share-card.ts` (Task 4), `SessionConfirmedScreen` integration + button activation (Task 5) — all spec sections covered. Testing strategy from the spec (backend 400/draw/null/gating, frontend computeAchievements edge cases, drawInstagramCard spies, shareCanvasAsImage branches, SessionConfirmedScreen share flow) is reflected task-by-task.
- **Font decision:** every `ctx.font` in Task 3 uses `Georgia, serif` — no `ensureCardFontsLoaded`/embedded-WOFF2 equivalent is ported, per the approved scope decision.
- **Out of scope, confirmed absent from this plan:** Quotes/Phrases admin CRUD, Rest tools, exact custom-font fidelity, production cutover — none of the 5 tasks touch admin phrase CRUD routes or `server.js`/`index.html`.
- **Type consistency check:** `getPhraseByContext(clientId: string, context: 'confirmacion' | 'instagram'): Promise<string | null>` (Task 2) matches the call in Task 5's `handleShare`; `drawInstagramCard(ctx: CanvasRenderingContext2D, { streakWeeks, phrase })` (Task 3) matches the call in Task 5; `shareCanvasAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void>` (Task 4) matches the call in Task 5.
