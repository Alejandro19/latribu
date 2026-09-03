import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, sleepProtocols, sleepLogs } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('sleep protocol + logs routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Sleep Client', email: `sleep-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(sleepLogs).where(eq(sleepLogs.clientId, clientId));
    await db.delete(sleepProtocols).where(eq(sleepProtocols.clientId, clientId));
  });

  it('a client with no protocol yet gets null, not a 404', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.protocol).toBeNull();
  });

  it('rejects a client from saving their own protocol (admin-only)', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}/sleep-protocol`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ protocol_text: 'Test' });
    expect(res.status).toBe(403);
  });

  it('admin writes the protocol and the client can read it back', async () => {
    const putRes = await request(app)
      .put(`/api/clients/${clientId}/sleep-protocol`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ protocol_text: 'Apaga pantallas 1h antes.', sleep_window: '22:30 - 06:30', supplement: 'Magnesio' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.protocol.protocolText).toBe('Apaga pantallas 1h antes.');

    const getRes = await request(app).get(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.body.protocol.sleepWindow).toBe('22:30 - 06:30');
  });

  it('writing the protocol a second time updates the same row, not a duplicate', async () => {
    await request(app).put(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${adminToken}`).send({ protocol_text: 'v1' });
    await request(app).put(`/api/clients/${clientId}/sleep-protocol`).set('Authorization', `Bearer ${adminToken}`).send({ protocol_text: 'v2' });
    const rows = await db.select().from(sleepProtocols).where(eq(sleepProtocols.clientId, clientId));
    expect(rows).toHaveLength(1);
    expect(rows[0].protocolText).toBe('v2');
  });

  it('returns null for today\'s sleep log when none exists yet', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/sleep-log-today`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.log).toBeNull();
  });

  it('rejects a log with quality out of range', async () => {
    const res = await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 7, quality: 9 });
    expect(res.status).toBe(400);
  });

  it('logs sleep for today, and posting again the same day updates it in place (upsert, not duplicate)', async () => {
    const first = await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 6, quality: 3 });
    expect(first.status).toBe(200);
    expect(Number(first.body.log.hours)).toBe(6);

    const second = await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 8, quality: 5 });
    expect(second.status).toBe(200);
    expect(second.body.log.id).toBe(first.body.log.id);
    expect(Number(second.body.log.hours)).toBe(8);

    const rows = await db.select().from(sleepLogs).where(eq(sleepLogs.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('lists the full sleep log history', async () => {
    await request(app).post(`/api/clients/${clientId}/sleep-log`).set('Authorization', `Bearer ${clientToken}`).send({ hours: 7, quality: 4 });
    const res = await request(app).get(`/api/clients/${clientId}/sleep-logs`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThan(0);
  });
});
