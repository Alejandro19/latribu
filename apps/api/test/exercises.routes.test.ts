import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, exercises, clientNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('exercises routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientId: string;
  let clientToken: string;
  let leadClientId: string;
  let leadToken: string;
  let exerciseId: string;

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });

    const [client] = await db
      .insert(clients)
      .values({ name: 'Exercise Client', email: `exercises-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });

    const [leadClient] = await db
      .insert(clients)
      .values({ name: 'Lead Client', email: `lead-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'lead_wellness' })
      .returning();
    leadClientId = leadClient.id;
    leadToken = signToken({ id: leadClientId, role: 'cliente', name: leadClient.name, email: leadClient.email });
  });

  afterAll(async () => {
    await db.delete(exercises).where(eq(exercises.clientId, clientId));
    await db.delete(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(clients).where(eq(clients.id, leadClientId));
  });

  it('rejects lead_wellness clients from listing exercises', async () => {
    const res = await request(app).get(`/api/clients/${leadClientId}/exercises`).set('Authorization', `Bearer ${leadToken}`);
    expect(res.status).toBe(403);
  });

  it('creates an exercise as admin, unlocks the training module, and notifies the client', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/exercises`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Sentadilla', day_number: 1, category: 'strength', series: 4, reps: '10', rest_time: '01:00' });
    expect(res.status).toBe(201);
    expect(res.body.exercise.title).toBe('Sentadilla');
    expect(res.body.exercise.sortOrder).toBe(0);
    exerciseId = res.body.exercise.id;

    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).training).toBe(true);

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain('entrenamiento');
  });

  it('does not duplicate the unlock notification on a second exercise', async () => {
    await request(app)
      .post(`/api/clients/${clientId}/exercises`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Peso muerto', day_number: 1, category: 'strength', series: 4, reps: '8' });

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications).toHaveLength(1);
  });

  it('assigns increasing sort_order within the same day+category', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/exercises`).set('Authorization', `Bearer ${clientToken}`);
    const day1Strength = res.body.exercises.filter((e: { dayNumber: number; category: string }) => e.dayNumber === 1 && e.category === 'strength');
    expect(day1Strength.map((e: { sortOrder: number }) => e.sortOrder)).toEqual([0, 1]);
  });

  it('rejects exercise creation by a client (adminOnly)', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/exercises`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'X', day_number: 1, category: 'strength' });
    expect(res.status).toBe(403);
  });

  it('updates an exercise', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Sentadilla profunda', day_number: 1, category: 'strength', series: 5, reps: '8' });
    expect(res.status).toBe(200);
    expect(res.body.exercise.title).toBe('Sentadilla profunda');
    expect(res.body.exercise.series).toBe(5);
  });

  it('swaps sort_order when reordering down', async () => {
    const before = await request(app).get(`/api/clients/${clientId}/exercises`).set('Authorization', `Bearer ${clientToken}`);
    const first = before.body.exercises.find((e: { id: string }) => e.id === exerciseId);
    expect(first.sortOrder).toBe(0);

    const res = await request(app)
      .patch(`/api/clients/${clientId}/exercises/${exerciseId}/order`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ direction: 'down' });
    expect(res.status).toBe(200);
    const reordered = res.body.exercises.find((e: { id: string }) => e.id === exerciseId);
    expect(reordered.sortOrder).toBe(1);
  });

  it('does not move past the last position', async () => {
    const res = await request(app)
      .patch(`/api/clients/${clientId}/exercises/${exerciseId}/order`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ direction: 'down' });
    expect(res.status).toBe(200);
    const unchanged = res.body.exercises.find((e: { id: string }) => e.id === exerciseId);
    expect(unchanged.sortOrder).toBe(1);
  });

  it('deletes an exercise', async () => {
    const res = await request(app).delete(`/api/clients/${clientId}/exercises/${exerciseId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const remaining = await db.select().from(exercises).where(eq(exercises.id, exerciseId));
    expect(remaining).toHaveLength(0);
  });

  it('normalizes duplicate legacy sort_order values (both 0) before reordering', async () => {
    const [exA] = await db
      .insert(exercises)
      .values({ clientId, title: 'Plancha', dayNumber: 2, category: 'warmup' })
      .returning();
    const [exB] = await db
      .insert(exercises)
      .values({ clientId, title: 'Jumping jacks', dayNumber: 2, category: 'warmup' })
      .returning();

    // exB auto-increments to sortOrder 1 on create; simulate legacy data where
    // both rows are stuck at sort_order = 0 (schema.sql's default, never set
    // by the legacy app), which makes swapping them a permanent no-op.
    await db.update(exercises).set({ sortOrder: 0 }).where(eq(exercises.id, exB.id));

    const res = await request(app)
      .patch(`/api/clients/${clientId}/exercises/${exA.id}/order`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ direction: 'down' });
    expect(res.status).toBe(200);

    const resultA = res.body.exercises.find((e: { id: string }) => e.id === exA.id);
    const resultB = res.body.exercises.find((e: { id: string }) => e.id === exB.id);
    // Which of the two ends up first after normalization depends on the id
    // tiebreak (both started at sort_order 0), but the two must end up with
    // genuinely different, dense 0/1 sortOrders — never a no-op tie.
    expect(resultA.sortOrder).not.toBe(resultB.sortOrder);
    expect(new Set([resultA.sortOrder, resultB.sortOrder])).toEqual(new Set([0, 1]));

    await db.delete(exercises).where(eq(exercises.id, exA.id));
    await db.delete(exercises).where(eq(exercises.id, exB.id));
  });

  it('recomputes sortOrder when updateExercise moves an exercise to a different day/category group', async () => {
    const [movedEx] = await db
      .insert(exercises)
      .values({ clientId, title: 'Curl', dayNumber: 1, category: 'strength' })
      .returning();
    const [warmup1] = await db
      .insert(exercises)
      .values({ clientId, title: 'Estiramiento 1', dayNumber: 1, category: 'warmup', sortOrder: 0 })
      .returning();
    const [warmup2] = await db
      .insert(exercises)
      .values({ clientId, title: 'Estiramiento 2', dayNumber: 1, category: 'warmup', sortOrder: 1 })
      .returning();

    const res = await request(app)
      .put(`/api/clients/${clientId}/exercises/${movedEx.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Curl', day_number: 1, category: 'warmup' });
    expect(res.status).toBe(200);
    expect(res.body.exercise.sortOrder).toBe(2);

    await db.delete(exercises).where(eq(exercises.id, movedEx.id));
    await db.delete(exercises).where(eq(exercises.id, warmup1.id));
    await db.delete(exercises).where(eq(exercises.id, warmup2.id));
  });
});
