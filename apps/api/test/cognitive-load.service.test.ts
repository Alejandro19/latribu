import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients, wearableMetricas, morningCheckins, cognitiveLoadHistory } from '../src/models/schema.js';
import { computeCognitiveLoadForDate, computeAndStoreCognitiveLoadForDate, getCognitiveLoadOverview } from '../src/services/cognitive-load.service.js';

describe('cognitive-load.service', () => {
  let clientId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Cognitive Load Client',
        email: `cognitive-load-${Date.now()}@example.com`,
        status: 'active',
        clientType: 'coaching_1_1',
        permissions: { cortisol: true },
      })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(wearableMetricas).where(eq(wearableMetricas.clientId, clientId));
    await db.delete(morningCheckins).where(eq(morningCheckins.clientId, clientId));
    await db.delete(cognitiveLoadHistory).where(eq(cognitiveLoadHistory.clientId, clientId));
  });

  it('returns null for a date with no wearable data and no morning check-in', async () => {
    const score = await computeCognitiveLoadForDate(clientId, '2026-01-15');
    expect(score).toBeNull();
  });

  it('computes a score using only the morning check-in when there is no wearable data that day', async () => {
    await db.insert(morningCheckins).values({ clientId, fecha: '2026-01-15', energia: 5, tension: 1, claridad: 5, activacionMatutina: 10 });
    const score = await computeCognitiveLoadForDate(clientId, '2026-01-15');
    // Solo Activación Matutina disponible (peso 0.25, redistribuido a 1.0),
    // en el mejor valor posible (10) → Bienestar_ponderado = 10 → Carga = 0.
    expect(score).toBeCloseTo(0, 5);
  });

  it('uses the earliest connected days as the HRV baseline, not the most recent', async () => {
    // Baseline (primeros días): HRV 50. Día evaluado: HRV 50 también → Score_HRV = 10.
    for (let i = 1; i <= 5; i++) {
      await db.insert(wearableMetricas).values({ clientId, dispositivo: 'oura', fecha: `2026-01-0${i}`, hrvNocturno: 50 });
    }
    await db.insert(wearableMetricas).values({ clientId, dispositivo: 'oura', fecha: '2026-01-20', hrvNocturno: 50, recoveryScore: 100, suenoScore: 100 });
    await db.insert(morningCheckins).values({ clientId, fecha: '2026-01-20', energia: 5, tension: 1, claridad: 5, activacionMatutina: 10 });

    const score = await computeCognitiveLoadForDate(clientId, '2026-01-20');
    // Los 4 componentes en su mejor valor → Bienestar_ponderado = 10 → Carga = 0.
    expect(score).toBeCloseTo(0, 5);
  });

  it('falls back to readinessScore when recoveryScore is absent', async () => {
    await db.insert(wearableMetricas).values({ clientId, dispositivo: 'oura', fecha: '2026-01-10', readinessScore: 80, suenoScore: 80 });
    const score = await computeCognitiveLoadForDate(clientId, '2026-01-10');
    expect(score).not.toBeNull();
  });

  it('computeAndStoreCognitiveLoadForDate does not insert a row when no component has data', async () => {
    await computeAndStoreCognitiveLoadForDate(clientId, '2026-02-01');
    const rows = await db.select().from(cognitiveLoadHistory).where(eq(cognitiveLoadHistory.clientId, clientId));
    expect(rows).toHaveLength(0);
  });

  it('computeAndStoreCognitiveLoadForDate upserts (calling twice for the same day does not duplicate)', async () => {
    await db.insert(wearableMetricas).values({ clientId, dispositivo: 'oura', fecha: '2026-02-02', suenoScore: 90 });
    await computeAndStoreCognitiveLoadForDate(clientId, '2026-02-02');
    await computeAndStoreCognitiveLoadForDate(clientId, '2026-02-02');
    const rows = await db.select().from(cognitiveLoadHistory).where(eq(cognitiveLoadHistory.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('getCognitiveLoadOverview reports no threshold with fewer than 14 days of history', async () => {
    await db.insert(cognitiveLoadHistory).values({ clientId, fecha: '2026-03-01', score: 5 });
    const overview = await getCognitiveLoadOverview(clientId);
    expect(overview.threshold).toBeNull();
    expect(overview.alert).toBe(false);
  });

  it('getCognitiveLoadOverview computes a threshold and streak once there are 14+ days of history', async () => {
    // 11 días de score bajo (2) y los últimos 3 días muy por encima (9) —
    // el percentil 75 de un historial dominado por 2s cae bajo, así que 9
    // queda por encima del umbral en esos últimos 3 días.
    for (let i = 1; i <= 11; i++) {
      await db.insert(cognitiveLoadHistory).values({ clientId, fecha: `2026-04-${String(i).padStart(2, '0')}`, score: 2 });
    }
    for (let i = 12; i <= 14; i++) {
      await db.insert(cognitiveLoadHistory).values({ clientId, fecha: `2026-04-${String(i).padStart(2, '0')}`, score: 9 });
    }

    const overview = await getCognitiveLoadOverview(clientId);
    expect(overview.threshold).not.toBeNull();
    expect(overview.trend.length).toBeGreaterThan(0);
    expect(overview.consecutiveDaysOverThreshold).toBe(3);
    expect(overview.alert).toBe(true);
  });
});
