import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, nutritionTips } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('nutrition tips routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Nutrition Tips Client',
        email: `nutrition-tips-${Date.now()}@example.com`,
        status: 'active',
        clientType: 'coaching_1_1',
        permissions: { nutrition: true },
      })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(nutritionTips);
  });

  it('rejects a client from reading the admin tip bank', async () => {
    const res = await request(app).get('/api/admin/nutrition-tips').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('admin creates, lists, updates, and deletes a tip', async () => {
    const createRes = await request(app)
      .post('/api/admin/nutrition-tips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Prepara tus comidas con anticipación.' });
    expect(createRes.status).toBe(201);
    const tipId = createRes.body.tip.id;

    const listRes = await request(app).get('/api/admin/nutrition-tips').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.tips.some((t: { id: string }) => t.id === tipId)).toBe(true);

    const updateRes = await request(app)
      .patch(`/api/admin/nutrition-tips/${tipId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tip.active).toBe(false);

    const deleteRes = await request(app).delete(`/api/admin/nutrition-tips/${tipId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects creating an empty tip', async () => {
    const res = await request(app).post('/api/admin/nutrition-tips').set('Authorization', `Bearer ${adminToken}`).send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('a client with the nutrition module unlocked sees only the active tips', async () => {
    await db.insert(nutritionTips).values([
      { content: 'Tip activo', active: true },
      { content: 'Tip inactivo', active: false },
    ]);
    const res = await request(app).get(`/api/clients/${clientId}/nutrition-tips`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tips).toHaveLength(1);
    expect(res.body.tips[0].content).toBe('Tip activo');
  });

  it('rejects a client without the nutrition permission from reading the tip list', async () => {
    await db.update(clients).set({ permissions: { nutrition: false } }).where(eq(clients.id, clientId));
    const res = await request(app).get(`/api/clients/${clientId}/nutrition-tips`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
    await db.update(clients).set({ permissions: { nutrition: true } }).where(eq(clients.id, clientId));
  });
});
