import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, communityEvents, eventReservations } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

// Ensure test DB is used
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres.ranfumrqwqnvpvxilacw:kxgIxv8WT10wsx6X@aws-1-us-west-2.pooler.supabase.com:5432/postgres_test';

describe('events routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Events Client', email: `events-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(eventReservations).where(eq(eventReservations.clientId, clientId));
    await db.delete(communityEvents);
  });

  it('admin creates, updates, and deletes an event', async () => {
    const createRes = await request(app)
      .post('/api/community/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Sesión grupal', location: 'Estudio', capacity: 20 });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.event.id;

    const updateRes = await request(app)
      .put(`/api/community/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Sesión grupal actualizada' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.event.title).toBe('Sesión grupal actualizada');

    const deleteRes = await request(app).delete(`/api/community/events/${eventId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects a client from creating an event (admin-only)', async () => {
    const res = await request(app).post('/api/community/events').set('Authorization', `Bearer ${clientToken}`).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  it('lists active events with a confirmed_count of 0 when nobody has reserved', async () => {
    await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento sin reservas' });
    const res = await request(app).get('/api/community/events').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.events[0].confirmed_count).toBe(0);
  });

  it('a client reserves an event, confirmed_count increments, and a second reserve attempt is a 409', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;

    const reserveRes = await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reserveRes.status).toBe(201);
    expect(reserveRes.body.reservation.status).toBe('confirmada');

    const listRes = await request(app).get('/api/community/events').set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.body.events.find((e: { id: string }) => e.id === eventId).confirmed_count).toBe(1);

    const duplicateRes = await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(duplicateRes.status).toBe(409);
  });

  it('cancelling a reservation flips status and allows re-reserving (the legacy cancel/re-reserve bug, must NOT reproduce)', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;

    await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    const cancelRes = await request(app).delete(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(cancelRes.status).toBe(200);

    const reReserveRes = await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(reReserveRes.status).toBe(201);
    expect(reReserveRes.body.reservation.status).toBe('confirmada');

    const rows = await db.select().from(eventReservations).where(eq(eventReservations.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('cancelling with no active reservation is a 404', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;
    const res = await request(app).delete(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });

  it('lists a client\'s own event reservations', async () => {
    const createRes = await request(app).post('/api/community/events').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Evento' });
    const eventId = createRes.body.event.id;
    await request(app).post(`/api/community/events/${eventId}/reserve`).set('Authorization', `Bearer ${clientToken}`);

    const res = await request(app).get(`/api/clients/${clientId}/event-reservations`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.reservations).toHaveLength(1);
  });
});