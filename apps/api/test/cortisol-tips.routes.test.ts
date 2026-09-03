import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, cortisolTips } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('cortisol tips routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Cortisol Tips Client',
        email: `cortisol-tips-${Date.now()}@example.com`,
        status: 'active',
        clientType: 'coaching_1_1',
        permissions: { cortisol: true },
      })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(cortisolTips);
  });

  it('rejects a client from reading the admin tip bank', async () => {
    const res = await request(app).get('/api/admin/cortisol-tips').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('admin creates, lists, updates, and deletes a tip', async () => {
    const createRes = await request(app)
      .post('/api/admin/cortisol-tips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'El cortisol baja con luz solar matutina.' });
    expect(createRes.status).toBe(201);
    const tipId = createRes.body.tip.id;

    const listRes = await request(app).get('/api/admin/cortisol-tips').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.tips.some((t: { id: string }) => t.id === tipId)).toBe(true);

    const updateRes = await request(app)
      .patch(`/api/admin/cortisol-tips/${tipId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tip.active).toBe(false);

    const deleteRes = await request(app).delete(`/api/admin/cortisol-tips/${tipId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects creating an empty tip', async () => {
    const res = await request(app).post('/api/admin/cortisol-tips').set('Authorization', `Bearer ${adminToken}`).send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('returns null for tip-of-the-day when the pool is empty', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/cortisol-tip-of-the-day`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tip).toBeNull();
  });

  it('returns a tip from the active pool, never an inactive one', async () => {
    await db.insert(cortisolTips).values([
      { content: 'Tip activo', active: true },
      { content: 'Tip inactivo', active: false },
    ]);
    const res = await request(app).get(`/api/clients/${clientId}/cortisol-tip-of-the-day`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tip.content).toBe('Tip activo');
  });
});
