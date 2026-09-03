import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, morningCheckins } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('morning checkin routes', () => {
  const app = createApp();
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Morning Checkin Client',
        email: `morning-checkin-${Date.now()}@example.com`,
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
    await db.delete(morningCheckins).where(eq(morningCheckins.clientId, clientId));
  });

  it('returns null for today\'s check-in when none exists yet', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/morning-checkin/today`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.checkin).toBeNull();
  });

  it('rejects an out-of-range answer', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/morning-checkin`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ energia: 6, tension: 3, claridad: 3 });
    expect(res.status).toBe(400);
  });

  it('creates a check-in and computes Activación Matutina with the exact formula', async () => {
    // ((5 + (6-1) + 5) / 3) * 2 = (5+5+5)/3*2 = 10
    const res = await request(app)
      .post(`/api/clients/${clientId}/morning-checkin`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ energia: 5, tension: 1, claridad: 5 });
    expect(res.status).toBe(200);
    expect(res.body.checkin.energia).toBe(5);
    expect(res.body.checkin.tension).toBe(1);
    expect(res.body.checkin.claridad).toBe(5);
    expect(Number(res.body.checkin.activacionMatutina)).toBeCloseTo(10, 5);

    const today = await request(app).get(`/api/clients/${clientId}/morning-checkin/today`).set('Authorization', `Bearer ${clientToken}`);
    expect(today.body.checkin.id).toBe(res.body.checkin.id);
  });

  it('posting again the same day updates it in place (upsert, not duplicate)', async () => {
    const first = await request(app)
      .post(`/api/clients/${clientId}/morning-checkin`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ energia: 3, tension: 3, claridad: 3 });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/clients/${clientId}/morning-checkin`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ energia: 1, tension: 5, claridad: 1 });
    expect(second.status).toBe(200);
    expect(second.body.checkin.id).toBe(first.body.checkin.id);
    // ((1 + (6-5) + 1) / 3) * 2 = (1+1+1)/3*2 = 2
    expect(Number(second.body.checkin.activacionMatutina)).toBeCloseTo(2, 5);

    const rows = await db.select().from(morningCheckins).where(eq(morningCheckins.clientId, clientId));
    expect(rows).toHaveLength(1);
  });
});
