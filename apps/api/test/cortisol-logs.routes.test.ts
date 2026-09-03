import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, cortisolCompletions, cortisolCheckins } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('cortisol logs routes', () => {
  const app = createApp();
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Cortisol Logs Client',
        email: `cortisol-logs-${Date.now()}@example.com`,
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
    await db.delete(cortisolCompletions).where(eq(cortisolCompletions.clientId, clientId));
    await db.delete(cortisolCheckins).where(eq(cortisolCheckins.clientId, clientId));
  });

  it('lists no completions when none exist', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/cortisol-completions`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.completions).toEqual([]);
  });

  it('marks a completion for today, and posting again the same day returns the same row (no duplicate)', async () => {
    const first = await request(app).post(`/api/clients/${clientId}/cortisol-completions`).set('Authorization', `Bearer ${clientToken}`).send({});
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/clients/${clientId}/cortisol-completions`).set('Authorization', `Bearer ${clientToken}`).send({});
    expect(second.status).toBe(200);
    expect(second.body.completion.id).toBe(first.body.completion.id);

    const list = await db.select().from(cortisolCompletions).where(eq(cortisolCompletions.clientId, clientId));
    expect(list).toHaveLength(1);
  });

  it('returns null for today\'s check-in when none exists yet', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/cortisol-checkin`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.checkin).toBeNull();
  });

  it('rejects an invalid emotion', async () => {
    const res = await request(app).post(`/api/clients/${clientId}/cortisol-checkin`).set('Authorization', `Bearer ${clientToken}`).send({ emotion: 'feliz' });
    expect(res.status).toBe(400);
  });

  it('creates a check-in, then posting again the same day updates it in place (upsert, not duplicate)', async () => {
    const first = await request(app).post(`/api/clients/${clientId}/cortisol-checkin`).set('Authorization', `Bearer ${clientToken}`).send({ emotion: 'ansioso' });
    expect(first.status).toBe(200);
    expect(first.body.checkin.emotion).toBe('ansioso');

    const second = await request(app).post(`/api/clients/${clientId}/cortisol-checkin`).set('Authorization', `Bearer ${clientToken}`).send({ emotion: 'tranquilo' });
    expect(second.status).toBe(200);
    expect(second.body.checkin.id).toBe(first.body.checkin.id);
    expect(second.body.checkin.emotion).toBe('tranquilo');

    const list = await db.select().from(cortisolCheckins).where(eq(cortisolCheckins.clientId, clientId));
    expect(list).toHaveLength(1);
  });

  it('lists the full check-in history ordered by date ascending', async () => {
    await request(app).post(`/api/clients/${clientId}/cortisol-checkin`).set('Authorization', `Bearer ${clientToken}`).send({ emotion: 'cansado' });
    const res = await request(app).get(`/api/clients/${clientId}/cortisol-checkins`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.checkins.length).toBeGreaterThan(0);
  });
});
