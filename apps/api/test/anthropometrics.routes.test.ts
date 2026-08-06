import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, anthropometricRecords } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('anthropometrics routes', () => {
  const app = createApp();
  let clientId: string;
  let token: string;
  let firstRecordId: string;
  let secondClientId: string;
  let secondClientRecordId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Anthro Client', email: `anthro-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    token = signToken({ id: clientId, role: 'cliente', name: 'Anthro Client', email: client.email });

    const [secondClient] = await db
      .insert(clients)
      .values({ name: 'Anthro Client 2', email: `anthro2-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    secondClientId = secondClient.id;
    const [secondRecord] = await db
      .insert(anthropometricRecords)
      .values({ clientId: secondClientId, fecha: '2026-01-01', mesNum: 1, peso: 55 })
      .returning();
    secondClientRecordId = secondRecord.id;
  });

  afterAll(async () => {
    await db.delete(anthropometricRecords).where(eq(anthropometricRecords.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(anthropometricRecords).where(eq(anthropometricRecords.clientId, secondClientId));
    await db.delete(clients).where(eq(clients.id, secondClientId));
  });

  it('creates a new anthropometric record', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/anthropometrics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-01-01', peso: 70, cintura: 80, mes_num: 1 });
    expect(res.status).toBe(201);
    expect(res.body.record.peso).toBe(70);
    firstRecordId = res.body.record.id;
  });

  it('updates the same month instead of creating a duplicate', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/anthropometrics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-01-15', peso: 69, mes_num: 1 });
    expect(res.status).toBe(200);
    expect(res.body.record.id).toBe(firstRecordId);
    expect(res.body.record.peso).toBe(69);
  });

  it('creates a separate record for a different month', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/anthropometrics`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-02-01', peso: 68, mes_num: 2 });
    expect(res.status).toBe(201);
    expect(res.body.record.id).not.toBe(firstRecordId);
  });

  it('lists all anthropometric records for a client', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/anthropometrics`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
  });

  it('deletes a record', async () => {
    const res = await request(app).delete(`/api/clients/${clientId}/anthropometrics/${firstRecordId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const remaining = await db.select().from(anthropometricRecords).where(eq(anthropometricRecords.id, firstRecordId));
    expect(remaining).toHaveLength(0);
  });

  it('does not delete another client\'s record (IDOR guard)', async () => {
    const res = await request(app)
      .delete(`/api/clients/${clientId}/anthropometrics/${secondClientRecordId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const remaining = await db.select().from(anthropometricRecords).where(eq(anthropometricRecords.id, secondClientRecordId));
    expect(remaining).toHaveLength(1);
  });
});
