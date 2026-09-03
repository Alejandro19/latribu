import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients, personalInfo } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import { requireOnboardingComplete, requireEventsAccess, requireCommunityAccess } from '../src/middleware/community-access.middleware.js';
import { authMiddleware } from '../src/middleware/auth.middleware.js';

function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/onboarding-gated', authMiddleware, requireOnboardingComplete, (_req, res) => res.json({ success: true }));
  app.get('/events-gated', authMiddleware, requireEventsAccess, (_req, res) => res.json({ success: true }));
  app.get('/community-gated', authMiddleware, requireCommunityAccess, (_req, res) => res.json({ success: true }));
  return app;
}

describe('community-access middleware', () => {
  const app = buildTestApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let coachingClientId: string;

  beforeAll(async () => {
    const [coaching] = await db
      .insert(clients)
      .values({ name: 'Coaching Client', email: `coaching-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    coachingClientId = coaching.id;
  });

  afterAll(async () => {
    await db.delete(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    await db.delete(clients).where(eq(clients.id, coachingClientId));
  });

  afterEach(async () => {
    await db.delete(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
  });

  it('requireOnboardingComplete: admin always passes', async () => {
    const res = await request(app).get('/onboarding-gated').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('requireOnboardingComplete: coaching client without completed personal_info is blocked', async () => {
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/onboarding-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requireOnboardingComplete: coaching client with completed personal_info passes', async () => {
    await db.insert(personalInfo).values({ clientId: coachingClientId, completedAt: new Date() });
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/onboarding-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('requireEventsAccess: any active client passes, no onboarding/plan check', async () => {
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/events-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('requireCommunityAccess: coaching client without completed onboarding is blocked', async () => {
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/community-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('requireCommunityAccess: coaching client with completed onboarding passes', async () => {
    await db.insert(personalInfo).values({ clientId: coachingClientId, completedAt: new Date() });
    const token = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching', email: 'coaching@a.com' });
    const res = await request(app).get('/community-gated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});