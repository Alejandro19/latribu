import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, communityEvents, eventReservations, communityTherapies, therapyReservations } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('community reservations aggregate route', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let eventId: string;
  let therapyId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Reservations Client', email: `reservations-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    await db.insert(personalInfo).values({ clientId, phoneCode: '+52', phoneNumber: '5512345678' });

    const [event] = await db.insert(communityEvents).values({ title: 'Evento Test', location: 'Estudio' }).returning();
    eventId = event.id;
    await db.insert(eventReservations).values({ eventId, clientId, status: 'confirmada' });

    const [therapy] = await db.insert(communityTherapies).values({ title: 'Terapia Test', provider: 'Aliado' }).returning();
    therapyId = therapy.id;
    await db.insert(therapyReservations).values({ therapyId, clientId, status: 'confirmada' });
  });

  afterAll(async () => {
    await db.delete(eventReservations).where(eq(eventReservations.clientId, clientId));
    await db.delete(therapyReservations).where(eq(therapyReservations.clientId, clientId));
    await db.delete(communityEvents).where(eq(communityEvents.id, eventId));
    await db.delete(communityTherapies).where(eq(communityTherapies.id, therapyId));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects a non-admin', async () => {
    const clientToken = signToken({ id: clientId, role: 'cliente', name: 'X', email: 'x@a.com' });
    const res = await request(app).get('/api/community/reservations').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('returns confirmed event and therapy reservations enriched with client name, phone, and content details', async () => {
    const res = await request(app).get('/api/community/reservations').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const eventRes = res.body.eventReservations.find((r: { eventId: string }) => r.eventId === eventId);
    expect(eventRes).toBeDefined();
    expect(eventRes.clientName).toBe('Reservations Client');
    expect(eventRes.clientPhone).toBe('+52 5512345678');
    expect(eventRes.eventTitle).toBe('Evento Test');

    const therapyRes = res.body.therapyReservations.find((r: { therapyId: string }) => r.therapyId === therapyId);
    expect(therapyRes).toBeDefined();
    expect(therapyRes.therapyTitle).toBe('Terapia Test');
    expect(therapyRes.therapyProvider).toBe('Aliado');
    expect(therapyRes.therapyDiscountPct).toBe(0);
  });
});