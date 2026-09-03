import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, membershipPayments } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

describe('membership-payments history + approval (admin)', () => {
  const app = createApp();
  const adminEmail = `approval-admin-${Date.now()}@example.com`;
  const clientEmail = `approval-client-${Date.now()}@example.com`;
  let adminId: string;
  let adminToken: string;
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [admin] = await db.insert(admins).values({ name: 'Approval Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
    adminToken = signToken({ id: adminId, role: 'admin', name: 'Approval Admin', email: adminEmail });

    const [client] = await db
      .insert(clients)
      .values({ name: 'Approval Client', email: clientEmail, passwordHash: await hashPassword('x'), status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: 'Approval Client', email: clientEmail, clientType: client.clientType });
  });

  afterAll(async () => {
    await db.delete(membershipPayments).where(eq(membershipPayments.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  it('rejects a client from reading the payment history (adminOnly)', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/membership-payments`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin read the payment history for a client', async () => {
    await db.insert(membershipPayments).values({
      clientId,
      clientType: 'mentoring',
      durationMonths: 1,
      amountCents: 45000000,
      currency: 'cop',
      provider: 'wompi',
      providerReference: `history-ref-${Date.now()}`,
      status: 'failed',
    });

    const res = await request(app).get(`/api/clients/${clientId}/membership-payments`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBeGreaterThan(0);
  });

  it('rejects approving a payment that is not pending approval (e.g. still pending, or already applied)', async () => {
    const [pendingPayment] = await db
      .insert(membershipPayments)
      .values({
        clientId,
        clientType: 'mentoring',
        durationMonths: 1,
        amountCents: 45000000,
        currency: 'cop',
        provider: 'wompi',
        providerReference: `not-approvable-${Date.now()}`,
        status: 'pending', // nunca se confirmó — requiresApproval sigue en false
      })
      .returning();

    const res = await request(app)
      .post(`/api/clients/${clientId}/membership-payments/${pendingPayment.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('approves a pending payment: activates the client with the exact tier/duration/package stored on the payment', async () => {
    const [payment] = await db
      .insert(membershipPayments)
      .values({
        clientId,
        clientType: 'coaching_1_1',
        durationMonths: 3,
        packageSize: 16,
        amountCents: 277000000,
        currency: 'cop',
        provider: 'wompi',
        providerReference: `approvable-${Date.now()}`,
        status: 'succeeded',
        requiresApproval: true,
      })
      .returning();

    const res = await request(app)
      .post(`/api/clients/${clientId}/membership-payments/${payment.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.client.status).toBe('active');
    expect(res.body.client.clientType).toBe('coaching_1_1');
    expect(res.body.client.sessionsTotal).toBe(16);
    expect(res.body.client.sessionsRemaining).toBe(16);

    const [updatedPayment] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, payment.id));
    expect(updatedPayment.appliedAt).not.toBeNull();

    // Ya aplicado — un segundo intento de aprobar el mismo pago se rechaza.
    const secondRes = await request(app)
      .post(`/api/clients/${clientId}/membership-payments/${payment.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(secondRes.status).toBe(409);
  });

  it('rejects a client (non-admin) from approving a payment', async () => {
    const [payment] = await db
      .insert(membershipPayments)
      .values({
        clientId,
        clientType: 'mentoring',
        durationMonths: 1,
        amountCents: 45000000,
        currency: 'cop',
        provider: 'wompi',
        providerReference: `not-for-client-${Date.now()}`,
        status: 'succeeded',
        requiresApproval: true,
      })
      .returning();

    const res = await request(app)
      .post(`/api/clients/${clientId}/membership-payments/${payment.id}/approve`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });
});
