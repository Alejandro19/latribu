import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { clients } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import { authMiddleware, adminOnly, ownerOrAdmin, blockExpiredPresencialSession } from '../src/middleware/auth.middleware.js';

function buildTestApp() {
  const app = express();
  app.get('/admin-only', authMiddleware, adminOnly, (_req, res) => res.json({ success: true }));
  app.get('/owner/:id', authMiddleware, ownerOrAdmin, (_req, res) => res.json({ success: true }));
  app.get('/owner/:id/session', authMiddleware, ownerOrAdmin, blockExpiredPresencialSession, (_req, res) => res.json({ success: true }));
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

  it('acceso no restrictivo: ownerOrAdmin ya NO bloquea a un cliente con el plan vencido', async () => {
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get(`/owner/${clientId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('blockExpiredPresencialSession sí bloquea a un Presencial vencido, específicamente', async () => {
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get(`/owner/${clientId}/session`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(402);
  });

  it('blockExpiredPresencialSession no bloquea a un cliente vencido que no es Presencial', async () => {
    await db.update(clients).set({ clientType: 'mentoring' }).where(eq(clients.id, clientId));
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get(`/owner/${clientId}/session`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    await db.update(clients).set({ clientType: 'coaching_1_1' }).where(eq(clients.id, clientId));
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

  it('rejects a valid token whose id is not a UUID instead of hanging or 500ing', async () => {
    const token = signToken({ id: 'not-a-uuid', role: 'cliente', name: 'Test Client', email });
    const res = await request(buildTestApp()).get('/owner/not-a-uuid').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
