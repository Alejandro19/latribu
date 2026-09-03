import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('member number auto-assignment on activation', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  const clientIds: string[] = [];

  afterAll(async () => {
    for (const id of clientIds) {
      await db.delete(clients).where(eq(clients.id, id));
    }
  });

  async function createInactiveClient(name: string) {
    const [client] = await db
      .insert(clients)
      .values({ name, email: `member-number-${Date.now()}-${Math.random()}@example.com`, status: 'inactive', clientType: 'coaching_1_1' })
      .returning();
    clientIds.push(client.id);
    return client;
  }

  it('assigns the next sequential member number and activatedAt the moment a client is activated', async () => {
    const client = await createInactiveClient('Member Number Client 1');
    expect(client.memberNumber).toBeNull();

    const res = await request(app)
      .patch(`/api/clients/${client.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.client.memberNumber).toEqual(expect.any(Number));
    expect(res.body.client.activatedAt).toBeTruthy();
  });

  it('does not reassign the member number or overwrite activatedAt when a client is deactivated and reactivated', async () => {
    const client = await createInactiveClient('Member Number Client 2');

    const activateRes = await request(app)
      .patch(`/api/clients/${client.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    const firstNumber = activateRes.body.client.memberNumber;
    const firstActivatedAt = activateRes.body.client.activatedAt;

    await request(app).patch(`/api/clients/${client.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'inactive' });

    const reactivateRes = await request(app)
      .patch(`/api/clients/${client.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });

    expect(reactivateRes.body.client.memberNumber).toBe(firstNumber);
    expect(reactivateRes.body.client.activatedAt).toBe(firstActivatedAt);
  });

  it('assigns sequential, non-colliding numbers across two separate activations', async () => {
    const clientA = await createInactiveClient('Member Number Client 3A');
    const clientB = await createInactiveClient('Member Number Client 3B');

    const resA = await request(app)
      .patch(`/api/clients/${clientA.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    const resB = await request(app)
      .patch(`/api/clients/${clientB.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });

    expect(resA.body.client.memberNumber).not.toBe(resB.body.client.memberNumber);
  });
});
