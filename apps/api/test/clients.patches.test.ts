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
