import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients, personalInfo, bioInbodyRecords, labPanels, wearableMetricas } from '../src/models/schema.js';
import { listClients } from '../src/services/clients.service.js';

describe('listClients: indicadores de onboarding Mentoría', () => {
  let mentoringId: string;
  let coachingId: string;

  beforeAll(async () => {
    const [mentoring] = await db
      .insert(clients)
      .values({ name: 'Indicators Mentoring', email: `indicators-mentoring-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    mentoringId = mentoring.id;

    const [coaching] = await db
      .insert(clients)
      .values({ name: 'Indicators Coaching', email: `indicators-coaching-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    coachingId = coaching.id;

    await db.insert(personalInfo).values({ clientId: mentoringId, completedAt: new Date() });
    await db.insert(bioInbodyRecords).values({ clientId: mentoringId });
    await db.insert(labPanels).values({ clientId: mentoringId, semanaNumero: 0, datos: { cortisol: 15 }, status: 'en_revision' });
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      await db.insert(wearableMetricas).values({ clientId: mentoringId, dispositivo: 'whoop', fecha: d.toISOString().slice(0, 10) });
    }
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, mentoringId));
    await db.delete(clients).where(eq(clients.id, coachingId));
  });

  it('populates real indicators for a mentoring client', async () => {
    const rows = await listClients();
    const row = rows.find((c) => c.id === mentoringId)!;
    expect(row.baselineComplete).toBe(true);
    expect(row.labWeek0Status).toBe('en_revision');
    expect(row.wearableDaysConDatos).toBe(4);
  });

  it('leaves indicators empty/null for a coaching_1_1 client', async () => {
    const rows = await listClients();
    const row = rows.find((c) => c.id === coachingId)!;
    expect(row.baselineComplete).toBe(false);
    expect(row.labWeek0Status).toBeNull();
    expect(row.wearableDaysConDatos).toBeNull();
  });

  it('baselineComplete is false when InBody is missing, even if personal-info is completed', async () => {
    const [otherMentoring] = await db
      .insert(clients)
      .values({ name: 'No Inbody', email: `no-inbody-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    await db.insert(personalInfo).values({ clientId: otherMentoring.id, completedAt: new Date() });

    const rows = await listClients();
    const row = rows.find((c) => c.id === otherMentoring.id)!;
    expect(row.baselineComplete).toBe(false);

    await db.delete(clients).where(eq(clients.id, otherMentoring.id));
  });
});
