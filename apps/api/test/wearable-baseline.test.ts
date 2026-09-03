import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients, wearableMetricas } from '../src/models/schema.js';
import { updateBaselineTimestampsIfNeeded } from '../src/services/wearable-baseline.service.js';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('wearable-baseline.service', () => {
  let clientId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Baseline Client', email: `baseline-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(wearableMetricas).where(eq(wearableMetricas.clientId, clientId));
    await db.update(clients).set({ wearableBaselineReadyAt: null, wearableBaselineStableAt: null }).where(eq(clients.id, clientId));
  });

  it('does not set any timestamp with fewer than 7 days of data', async () => {
    for (let i = 0; i < 5; i++) {
      await db.insert(wearableMetricas).values({ clientId, dispositivo: 'whoop', fecha: daysAgo(i) });
    }
    await updateBaselineTimestampsIfNeeded(clientId);
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.wearableBaselineReadyAt).toBeNull();
    expect(client.wearableBaselineStableAt).toBeNull();
  });

  it('sets wearableBaselineReadyAt once 7 distinct days exist, but not wearableBaselineStableAt', async () => {
    for (let i = 0; i < 7; i++) {
      await db.insert(wearableMetricas).values({ clientId, dispositivo: 'whoop', fecha: daysAgo(i) });
    }
    await updateBaselineTimestampsIfNeeded(clientId);
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.wearableBaselineReadyAt).not.toBeNull();
    expect(client.wearableBaselineStableAt).toBeNull();
  });

  it('sets both timestamps once 28 distinct days exist', async () => {
    for (let i = 0; i < 28; i++) {
      await db.insert(wearableMetricas).values({ clientId, dispositivo: 'whoop', fecha: daysAgo(i) });
    }
    await updateBaselineTimestampsIfNeeded(clientId);
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.wearableBaselineReadyAt).not.toBeNull();
    expect(client.wearableBaselineStableAt).not.toBeNull();
  });

  it('never overwrites an already-set timestamp (idempotent)', async () => {
    for (let i = 0; i < 7; i++) {
      await db.insert(wearableMetricas).values({ clientId, dispositivo: 'whoop', fecha: daysAgo(i) });
    }
    await updateBaselineTimestampsIfNeeded(clientId);
    const [first] = await db.select().from(clients).where(eq(clients.id, clientId));
    const firstReadyAt = first.wearableBaselineReadyAt;

    await updateBaselineTimestampsIfNeeded(clientId);
    const [second] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(second.wearableBaselineReadyAt?.getTime()).toBe(firstReadyAt?.getTime());
  });

  it('counts distinct days across multiple devices, not per-device totals', async () => {
    for (let i = 0; i < 4; i++) {
      await db.insert(wearableMetricas).values({ clientId, dispositivo: 'whoop', fecha: daysAgo(i) });
    }
    for (let i = 0; i < 3; i++) {
      await db.insert(wearableMetricas).values({ clientId, dispositivo: 'oura', fecha: daysAgo(i + 10) });
    }
    await updateBaselineTimestampsIfNeeded(clientId);
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.wearableBaselineReadyAt).not.toBeNull();
  });
});
