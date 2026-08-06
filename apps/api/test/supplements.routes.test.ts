import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, supplements, clientNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('supplements routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Supplement Client', email: `supplements-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(supplements).where(eq(supplements.clientId, clientId));
  });

  it('a client with no supplements yet gets an empty list', async () => {
    // This client hasn't had a supplement assigned yet, so permissions.supplementation
    // defaults to false and requirePermission('supplementation') would 403 the request.
    // Unlock the module directly for this test's fixture — the empty-list response is
    // what's under test, not the requirePermission gate — then revert so the later
    // "unlocks the module" test still observes the false -> true transition.
    await db
      .update(clients)
      .set({ permissions: { training: false, nutrition: false, supplementation: true, cortisol: false, community: true, evolution: true } })
      .where(eq(clients.id, clientId));

    const res = await request(app).get(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.supplements).toEqual([]);

    await db
      .update(clients)
      .set({ permissions: { training: false, nutrition: false, supplementation: false, cortisol: false, community: true, evolution: true } })
      .where(eq(clients.id, clientId));
  });

  it('rejects a client from assigning their own supplement (admin-only)', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/supplements`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ name: 'Magnesio', category: 'Sueño' });
    expect(res.status).toBe(403);
  });

  it('admin assigns a supplement, which unlocks the module and notifies the client', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/supplements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Magnesio', category: 'Sueño', dose: '400mg' });
    expect(res.status).toBe(201);
    expect(res.body.supplement.name).toBe('Magnesio');

    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).supplementation).toBe(true);

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('suplementación'))).toBe(true);
  });

  it('rejects assigning a duplicate supplement name to the same client', async () => {
    await request(app).post(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Magnesio' });
    const res = await request(app).post(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Magnesio' });
    expect(res.status).toBe(409);
  });

  it('admin updates and deletes a supplement', async () => {
    const createRes = await request(app).post(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Ashwagandha' });
    const suppId = createRes.body.supplement.id;

    const updateRes = await request(app)
      .put(`/api/clients/${clientId}/supplements/${suppId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ashwagandha KSM-66', dose: '600mg' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.supplement.name).toBe('Ashwagandha KSM-66');

    const deleteRes = await request(app).delete(`/api/clients/${clientId}/supplements/${suppId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    // The client needs supplementation access to hit the GET route; the earlier
    // create in this test already unlocked it via the assign-a-supplement flow.
    const listRes = await request(app).get(`/api/clients/${clientId}/supplements`).set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.supplements).toEqual([]);
  });

  it('does not let an admin mutate another client\'s supplement via a mismatched clientId in the URL', async () => {
    const [otherClient] = await db
      .insert(clients)
      .values({ name: 'Other Supplement Client', email: `supplements-other-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();

    const createRes = await request(app)
      .post(`/api/clients/${clientId}/supplements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Creatina', dose: '5g' });
    const suppId = createRes.body.supplement.id;

    const updateRes = await request(app)
      .put(`/api/clients/${otherClient.id}/supplements/${suppId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Hijacked' });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/clients/${otherClient.id}/supplements/${suppId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const [unchanged] = await db.select().from(supplements).where(eq(supplements.id, suppId));
    expect(unchanged).toBeDefined();
    expect(unchanged.name).toBe('Creatina');

    await db.delete(clients).where(eq(clients.id, otherClient.id));
  });
});
