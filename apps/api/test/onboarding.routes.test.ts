import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, labPanels, wearableTokens, bioInbodyRecords } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('onboarding finalize (gate obligatorio Mentoría)', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let mentoringClientId: string;
  let coachingClientId: string;

  beforeAll(async () => {
    const [mentoring] = await db
      .insert(clients)
      .values({ name: 'Onboarding Mentoring Client', email: `onb-mentoring-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    mentoringClientId = mentoring.id;

    const [coaching] = await db
      .insert(clients)
      .values({ name: 'Onboarding Coaching Client', email: `onb-coaching-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    coachingClientId = coaching.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, mentoringClientId));
    await db.delete(clients).where(eq(clients.id, coachingClientId));
  });

  afterEach(async () => {
    await db.delete(personalInfo).where(eq(personalInfo.clientId, mentoringClientId));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    await db.delete(labPanels).where(eq(labPanels.clientId, mentoringClientId));
    await db.delete(wearableTokens).where(eq(wearableTokens.clientId, mentoringClientId));
    await db.delete(bioInbodyRecords).where(eq(bioInbodyRecords.clientId, mentoringClientId));
  });

  it('finalizes without any gate for a coaching_1_1 client', async () => {
    const res = await request(app)
      .post(`/api/clients/${coachingClientId}/onboarding/finalize`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const [info] = await db.select().from(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    expect(info.completedAt).not.toBeNull();
  });

  it('rejects a mentoring client missing all three required items', async () => {
    const res = await request(app)
      .post(`/api/clients/${mentoringClientId}/onboarding/finalize`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.missing.sort()).toEqual(['inbody', 'lab_week0', 'wearable']);

    const [info] = await db.select().from(personalInfo).where(eq(personalInfo.clientId, mentoringClientId));
    expect(info).toBeUndefined();
  });

  it('rejects a mentoring client with an empty lab_week0 panel (no markers entered)', async () => {
    await db.insert(labPanels).values({ clientId: mentoringClientId, semanaNumero: 0, datos: {} });
    const res = await request(app)
      .post(`/api/clients/${mentoringClientId}/onboarding/finalize`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.missing).toContain('lab_week0');
  });

  it('accepts apple_health_connected as a valid substitute for an OAuth wearable', async () => {
    await db.insert(personalInfo).values({ clientId: mentoringClientId, appleHealthConnected: true });
    await db.insert(labPanels).values({ clientId: mentoringClientId, semanaNumero: 0, datos: { cortisol: 15 } });
    await db.insert(bioInbodyRecords).values({ clientId: mentoringClientId });

    const res = await request(app)
      .post(`/api/clients/${mentoringClientId}/onboarding/finalize`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('accepts a real OAuth wearable connection and finalizes successfully once all three items exist', async () => {
    await db.insert(wearableTokens).values({ clientId: mentoringClientId, dispositivo: 'whoop', accessToken: 'fake-token' });
    await db.insert(labPanels).values({ clientId: mentoringClientId, semanaNumero: 0, datos: { cortisol: 15 } });
    await db.insert(bioInbodyRecords).values({ clientId: mentoringClientId });

    const res = await request(app)
      .post(`/api/clients/${mentoringClientId}/onboarding/finalize`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const [info] = await db.select().from(personalInfo).where(eq(personalInfo.clientId, mentoringClientId));
    expect(info.completedAt).not.toBeNull();
  });
});
