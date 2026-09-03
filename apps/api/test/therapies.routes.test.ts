import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, communityTherapies, therapyReservations } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('therapies routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Therapies Client', email: `therapies-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
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
    await db.delete(therapyReservations).where(eq(therapyReservations.clientId, clientId));
    await db.delete(communityTherapies);
  });

  it('admin creates, updates, and deletes a therapy', async () => {
    const createRes = await request(app)
      .post('/api/community/therapies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Masaje', provider: 'Clínica Aliada', discount_pct: 30 });
    expect(createRes.status).toBe(201);
    const therapyId = createRes.body.therapy.id;

    const updateRes = await request(app)
      .put(`/api/community/therapies/${therapyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Masaje actualizado' });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app).delete(`/api/community/therapies/${therapyId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects a client from creating a therapy (admin-only)', async () => {
    const res = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${clientToken}`).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  it('a client reserves a therapy, confirmed_count increments, and a second reserve attempt is a 409', async () => {
    const createRes = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Terapia' });
    const therapyId = createRes.body.therapy.id;

    const reserveRes = await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reserveRes.status).toBe(201);

    const listRes = await request(app).get('/api/community/therapies').set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.therapies.find((t: { id: string }) => t.id === therapyId).confirmed_count).toBe(1);

    const duplicateRes = await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(duplicateRes.status).toBe(409);
  });

  it('lists a client\'s own therapy reservations', async () => {
    const createRes = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Terapia' });
    const therapyId = createRes.body.therapy.id;
    await request(app).post(`/api/community/therapies/${therapyId}/reserve`).set('Authorization', `Bearer ${clientToken}`);

    const res = await request(app).get(`/api/clients/${clientId}/therapy-reservations`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reservations).toHaveLength(1);
  });

  it('admin uploads a photo for a therapy', async () => {
    const createRes = await request(app)
      .post('/api/community/therapies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Masaje', provider: 'Clínica Aliada', discount_pct: 30 });
    const therapyId = createRes.body.therapy.id;

    const uploadRes = await request(app)
      .post(`/api/community/therapies/${therapyId}/upload-image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('fake png bytes'), { filename: 'masaje.png', contentType: 'image/png' });
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.therapy.imageUrl).toEqual(expect.stringContaining('http'));
    expect(uploadRes.body.therapy.provider).toBe('Clínica Aliada');
  });

  it('rejects a non-image upload for a therapy photo', async () => {
    const createRes = await request(app).post('/api/community/therapies').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Terapia' });
    const therapyId = createRes.body.therapy.id;
    const res = await request(app)
      .post(`/api/community/therapies/${therapyId}/upload-image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('not an image'), { filename: 'foto.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});