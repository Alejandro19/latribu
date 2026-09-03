import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('cognitive load routes', () => {
  const app = createApp();
  let clientId: string;
  let clientToken: string;
  let otherClientId: string;
  let otherClientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Cognitive Load Route Client',
        email: `cognitive-load-route-${Date.now()}@example.com`,
        status: 'active',
        clientType: 'coaching_1_1',
        permissions: { cortisol: true },
      })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });

    const [other] = await db
      .insert(clients)
      .values({
        name: 'Other Client',
        email: `cognitive-load-other-${Date.now()}@example.com`,
        status: 'active',
        clientType: 'coaching_1_1',
        permissions: { cortisol: true },
      })
      .returning();
    otherClientId = other.id;
    otherClientToken = signToken({ id: otherClientId, role: 'cliente', name: other.name, email: other.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(clients).where(eq(clients.id, otherClientId));
  });

  it('returns a fresh overview with no data yet', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/cognitive-load`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.today).toBeNull();
    expect(res.body.threshold).toBeNull();
    expect(res.body.alert).toBe(false);
    expect(res.body.trend).toEqual([]);
    expect(res.body.latest).toEqual({ hrv: null, activacionMatutina: null, recuperacionPct: null });
  });

  it('rejects a client fetching a different client\'s cognitive load', async () => {
    const res = await request(app).get(`/api/clients/${otherClientId}/cognitive-load`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });
});
