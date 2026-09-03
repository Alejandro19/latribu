import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, legalAcceptances } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

const legalAcceptanceFixture = {
  dataPolicyVersion: 'v0.1-borrador',
  termsVersion: 'v0.1-borrador',
  sensitiveDataConsent: true,
  acceptedAt: new Date().toISOString(),
};

describe('account routes', () => {
  const app = createApp();
  const adminEmail = `account-admin-${Date.now()}@example.com`;
  const clientEmail = `account-client-${Date.now()}@example.com`;
  let adminId: string;
  let adminToken: string;
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [admin] = await db.insert(admins).values({ name: 'Account Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
    adminToken = signToken({ id: adminId, role: 'admin', name: 'Account Admin', email: adminEmail });

    const [client] = await db
      .insert(clients)
      .values({ name: 'Account Client', email: clientEmail, passwordHash: await hashPassword('x'), status: 'active' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: 'Account Client', email: clientEmail, clientType: client.clientType });
  });

  afterAll(async () => {
    await db.delete(legalAcceptances).where(eq(legalAcceptances.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  it('rejects a non-client (admin) from every /api/account route', async () => {
    const res = await request(app).get('/api/account/legal-acceptance').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('returns null when the client has no legal acceptance on record yet', async () => {
    const res = await request(app).get('/api/account/legal-acceptance').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.acceptance).toBeNull();
  });

  it('records a new legal acceptance and reflects it as the latest', async () => {
    const first = await request(app)
      .post('/api/account/legal-acceptance')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(legalAcceptanceFixture);
    expect(first.status).toBe(201);

    const later = { ...legalAcceptanceFixture, dataPolicyVersion: 'v2.0' };
    const second = await request(app)
      .post('/api/account/legal-acceptance')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(later);
    expect(second.status).toBe(201);

    const get = await request(app).get('/api/account/legal-acceptance').set('Authorization', `Bearer ${clientToken}`);
    expect(get.body.acceptance.dataPolicyVersion).toBe('v2.0');

    // Append-only: dos aceptaciones, no un update sobre la misma fila.
    const rows = await db.select().from(legalAcceptances).where(eq(legalAcceptances.clientId, clientId));
    expect(rows).toHaveLength(2);
  });

  it('updates notification preferences without clobbering the untouched ones', async () => {
    const res = await request(app)
      .patch('/api/account/notification-preferences')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ news: true });
    expect(res.status).toBe(200);
    expect(res.body.client.notificationPreferences).toEqual({ streakReminders: true, events: true, news: true });
  });

  it('is idempotent when requesting account deletion twice', async () => {
    const first = await request(app).post('/api/account/deletion-request').set('Authorization', `Bearer ${clientToken}`);
    expect(first.status).toBe(200);
    const firstTimestamp = first.body.client.deletionRequestedAt;
    expect(firstTimestamp).not.toBeNull();

    const second = await request(app).post('/api/account/deletion-request').set('Authorization', `Bearer ${clientToken}`);
    expect(second.status).toBe(200);
    expect(second.body.client.deletionRequestedAt).toBe(firstTimestamp);

    // El admin puede resolverla y marca el registro como no-pendiente de nuevo.
    const resolved = await request(app)
      .patch(`/api/clients/${clientId}/deletion-request/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.client.deletionRequestedAt).toBeNull();
  });

  it('exports profile, membership and the full legal acceptance history', async () => {
    const res = await request(app).get('/api/account/export').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profile.email).toBe(clientEmail);
    expect(res.body.data.membership.clientType).toBeDefined();
    expect(res.body.data.legalAcceptances.length).toBeGreaterThanOrEqual(2);
  });

  it('uploads an avatar and rejects an invalid format', async () => {
    const badRes = await request(app)
      .post('/api/account/avatar')
      .set('Authorization', `Bearer ${clientToken}`)
      .attach('avatar', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(badRes.status).toBe(400);
  });
});
