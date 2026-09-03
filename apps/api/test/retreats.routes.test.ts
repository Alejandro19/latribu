import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, communityRetreats, retreatReservations } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('retreats routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Retreats Client', email: `retreats-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
    // requireCommunityAccess needs completed onboarding for a coaching client.
    await db.insert(personalInfo).values({ clientId, completedAt: new Date() });
  });

  afterAll(async () => {
    await db.delete(personalInfo).where(eq(personalInfo.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(retreatReservations).where(eq(retreatReservations.clientId, clientId));
    await db.delete(communityRetreats);
  });

  it('admin creates, updates, and deletes a retreat', async () => {
    const createRes = await request(app)
      .post('/api/community/retreats')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Retiro de montaña', location: 'Sierra Nevada', start_date: '2026-09-01', end_date: '2026-09-05', capacity: 12, price_cents: 250000 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.retreat.priceCents).toBe(250000);
    const retreatId = createRes.body.retreat.id;

    const updateRes = await request(app)
      .put(`/api/community/retreats/${retreatId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Retiro de montaña actualizado' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.retreat.title).toBe('Retiro de montaña actualizado');

    const deleteRes = await request(app).delete(`/api/community/retreats/${retreatId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('toggling active with a partial update does not wipe start/end dates (regression)', async () => {
    const createRes = await request(app)
      .post('/api/community/retreats')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Retiro de playa', start_date: '2026-09-01T00:00:00Z', end_date: '2026-09-05T00:00:00Z' });
    const retreatId = createRes.body.retreat.id;

    const toggleRes = await request(app)
      .put(`/api/community/retreats/${retreatId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.retreat.startDate).not.toBeNull();
    expect(toggleRes.body.retreat.endDate).not.toBeNull();
  });

  it('rejects a client from creating a retreat (admin-only)', async () => {
    const res = await request(app).post('/api/community/retreats').set('Authorization', `Bearer ${clientToken}`).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  it('rejects a retreat where end_date is before start_date', async () => {
    const res = await request(app)
      .post('/api/community/retreats')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Retiro inválido', start_date: '2026-09-05', end_date: '2026-09-01' });
    expect(res.status).toBe(400);
  });

  it('lists active retreats for any authenticated client', async () => {
    await request(app).post('/api/community/retreats').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Retiro sin reservas' });
    const res = await request(app).get('/api/community/retreats').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.retreats[0].confirmed_count).toBe(0);
  });

  it('a client reserves a retreat, confirmed_count increments, and a second reserve attempt is a 409', async () => {
    const createRes = await request(app).post('/api/community/retreats').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Retiro' });
    const retreatId = createRes.body.retreat.id;

    const reserveRes = await request(app).post(`/api/community/retreats/${retreatId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reserveRes.status).toBe(201);
    expect(reserveRes.body.reservation.status).toBe('confirmada');

    const listRes = await request(app).get('/api/community/retreats').set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.retreats.find((r: { id: string }) => r.id === retreatId).confirmed_count).toBe(1);

    const duplicateRes = await request(app).post(`/api/community/retreats/${retreatId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(duplicateRes.status).toBe(409);
  });

  it('cancelling a reservation flips status and allows re-reserving', async () => {
    const createRes = await request(app).post('/api/community/retreats').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Retiro' });
    const retreatId = createRes.body.retreat.id;

    await request(app).post(`/api/community/retreats/${retreatId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    const cancelRes = await request(app).delete(`/api/community/retreats/${retreatId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(cancelRes.status).toBe(200);

    const reReserveRes = await request(app).post(`/api/community/retreats/${retreatId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reReserveRes.status).toBe(201);

    const rows = await db.select().from(retreatReservations).where(eq(retreatReservations.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('lists a client\'s own retreat reservations', async () => {
    const createRes = await request(app).post('/api/community/retreats').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Retiro' });
    const retreatId = createRes.body.retreat.id;
    await request(app).post(`/api/community/retreats/${retreatId}/reserve`).set('Authorization', `Bearer ${clientToken}`);

    const res = await request(app).get(`/api/clients/${clientId}/retreat-reservations`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reservations).toHaveLength(1);
  });

  it('admin uploads a photo for a retreat without wiping its other fields (start_date/end_date)', async () => {
    const createRes = await request(app)
      .post('/api/community/retreats')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Retiro de montaña', start_date: '2026-09-01T00:00:00Z', end_date: '2026-09-05T00:00:00Z', location: 'Sierra Nevada' });
    const retreatId = createRes.body.retreat.id;

    const uploadRes = await request(app)
      .post(`/api/community/retreats/${retreatId}/upload-image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('fake jpg bytes'), { filename: 'retiro.jpg', contentType: 'image/jpeg' });
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.retreat.imageUrl).toEqual(expect.stringContaining('http'));
    expect(uploadRes.body.retreat.startDate).not.toBeNull();
    expect(uploadRes.body.retreat.endDate).not.toBeNull();
  });

  it('rejects a non-image upload for a retreat photo', async () => {
    const createRes = await request(app).post('/api/community/retreats').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Retiro' });
    const retreatId = createRes.body.retreat.id;
    const res = await request(app)
      .post(`/api/community/retreats/${retreatId}/upload-image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('not an image'), { filename: 'foto.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});
