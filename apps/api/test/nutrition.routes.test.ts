import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, nutritionPlans, meals, clientNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('nutrition routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Nutrition Client', email: `nutrition-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(meals).where(eq(meals.clientId, clientId));
    await db.delete(nutritionPlans).where(eq(nutritionPlans.clientId, clientId));
  });

  it('a client with no plan yet gets an empty object back, not a 404', async () => {
    // This client has nutrition access unlocked (permissions.nutrition = true) but has
    // never had a plan/meal saved for them yet — the empty-state response, not the
    // requirePermission('nutrition') gate, is what's under test here.
    await db
      .update(clients)
      .set({ permissions: { training: false, nutrition: true, supplementation: false, cortisol: false, community: true, evolution: true } })
      .where(eq(clients.id, clientId));

    const res = await request(app).get(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.plan).toEqual({});
    expect(res.body.meals).toEqual([]);

    // Revert so downstream tests still observe the false -> true unlock transition.
    await db
      .update(clients)
      .set({ permissions: { training: false, nutrition: false, supplementation: false, cortisol: false, community: true, evolution: true } })
      .where(eq(clients.id, clientId));
  });

  it('rejects a client from saving their own plan (admin-only)', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}/nutrition`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ daily_cals: 2000 });
    expect(res.status).toBe(403);
  });

  it('admin saves a plan, which unlocks the nutrition module and notifies the client', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}/nutrition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ daily_cals: 2200, protein_g: 160 });
    expect(res.status).toBe(200);
    expect(res.body.plan.dailyCals).toBe(2200);

    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).nutrition).toBe(true);

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('Nutrition'))).toBe(true);
  });

  it('saving the plan a second time does not duplicate the unlock notification', async () => {
    await request(app).put(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${adminToken}`).send({ daily_cals: 2000 });
    await request(app).put(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${adminToken}`).send({ daily_cals: 2100 });

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.filter((n) => n.message.includes('Nutrition'))).toHaveLength(1);
  });

  it('admin creates, updates, and deletes a meal', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/meals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ meal_time: 'Desayuno', name: 'Avena', calories: 300 });
    expect(createRes.status).toBe(201);
    const mealId = createRes.body.meal.id;

    const updateRes = await request(app)
      .put(`/api/clients/${clientId}/meals/${mealId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ meal_time: 'Desayuno', name: 'Avena con fruta', calories: 350 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.meal.name).toBe('Avena con fruta');

    const deleteRes = await request(app).delete(`/api/clients/${clientId}/meals/${mealId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app).get(`/api/clients/${clientId}/nutrition`).set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.meals).toEqual([]);
  });

  it('creating a meal unlocks the nutrition module', async () => {
    await request(app)
      .post(`/api/clients/${clientId}/meals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ meal_time: 'Cena', name: 'Ensalada' });
    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).nutrition).toBe(true);
  });

  it('does not let an admin mutate another client\'s meal via a mismatched clientId in the URL', async () => {
    const [otherClient] = await db
      .insert(clients)
      .values({ name: 'Other Nutrition Client', email: `nutrition-other-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();

    const createRes = await request(app)
      .post(`/api/clients/${clientId}/meals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ meal_time: 'Comida', name: 'Pollo con arroz', calories: 500 });
    const mealId = createRes.body.meal.id;

    const updateRes = await request(app)
      .put(`/api/clients/${otherClient.id}/meals/${mealId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Hijacked' });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/clients/${otherClient.id}/meals/${mealId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const [unchanged] = await db.select().from(meals).where(eq(meals.id, mealId));
    expect(unchanged).toBeDefined();
    expect(unchanged.name).toBe('Pollo con arroz');

    await db.delete(clients).where(eq(clients.id, otherClient.id));
  });

  it('uploads a PDF and attaches it to the plan', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/nutrition/upload-pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), { filename: 'plan.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.plan.pdfName).toBe('plan.pdf');
    expect(res.body.plan.pdfUrl).toEqual(expect.stringContaining('http'));
  });

  it('rejects a non-PDF upload', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/nutrition/upload-pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('pdf', Buffer.from('not a pdf'), { filename: 'plan.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});
