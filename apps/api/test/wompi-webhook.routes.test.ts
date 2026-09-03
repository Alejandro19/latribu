import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, membershipPrices, membershipPayments, adminNotifications } from '../src/models/schema.js';
import { hashPassword } from '../src/services/auth.service.js';

function buildTransactionUpdatedPayload(reference: string, status: string) {
  const timestamp = 1700000000;
  const data = { transaction: { id: 'txn-wompi-1', reference, status, amount_in_cents: 9900 } };
  const properties = ['transaction.id', 'transaction.status', 'transaction.reference'];
  const concatenated =
    properties.map((path) => String(path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], data))).join('') +
    String(timestamp) +
    process.env.WOMPI_EVENTS_SECRET;
  const checksum = createHash('sha256').update(concatenated).digest('hex');
  return { event: 'transaction.updated', data, environment: 'test', signature: { properties, checksum }, timestamp, sent_at: new Date().toISOString() };
}

describe('POST /api/wompi/webhook', () => {
  const app = createApp();

  afterAll(async () => {
    await db
      .update(membershipPrices)
      .set({ amountCents: 0 })
      .where(and(eq(membershipPrices.clientType, 'coaching_1_1'), eq(membershipPrices.durationMonths, 3), eq(membershipPrices.packageSize, 8)));
  });

  beforeAll(async () => {
    await db
      .update(membershipPrices)
      .set({ amountCents: 9900 })
      .where(and(eq(membershipPrices.clientType, 'coaching_1_1'), eq(membershipPrices.durationMonths, 3), eq(membershipPrices.packageSize, 8)));
  });

  it('rejects a payload with a tampered checksum', async () => {
    const payload = buildTransactionUpdatedPayload('ref-does-not-matter', 'APPROVED');
    payload.signature.checksum = 'deadbeef';
    const res = await request(app).post('/api/wompi/webhook').send(payload);
    expect(res.status).toBe(400);
  });

  describe('cliente veterano (ya activo en un tier pagable) — activa directo', () => {
    const clientEmail = `wompi-webhook-veteran-${Date.now()}@example.com`;
    let clientId: string;

    beforeAll(async () => {
      const [client] = await db
        .insert(clients)
        .values({ name: 'Veteran Client', email: clientEmail, passwordHash: await hashPassword('x'), status: 'active', clientType: 'coaching_1_1' })
        .returning();
      clientId = client.id;
    });

    afterAll(async () => {
      await db.delete(membershipPayments).where(eq(membershipPayments.clientId, clientId));
      await db.delete(clients).where(eq(clients.id, clientId));
    });

    it('activates the membership on an APPROVED transaction, sets sessions and a 90-day expiration, idempotent on redelivery', async () => {
      const [payment] = await db
        .insert(membershipPayments)
        .values({
          clientId,
          clientType: 'coaching_1_1',
          durationMonths: 3,
          packageSize: 8,
          amountCents: 9900,
          currency: 'cop',
          provider: 'wompi',
          providerReference: 'wompi-ref-approved-1',
          status: 'pending',
        })
        .returning();

      const payload = buildTransactionUpdatedPayload('wompi-ref-approved-1', 'APPROVED');
      const res = await request(app).post('/api/wompi/webhook').send(payload);
      expect(res.status).toBe(200);

      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      expect(client.status).toBe('active');
      expect(client.clientType).toBe('coaching_1_1');
      expect(client.sessionsTotal).toBe(8);
      expect(client.sessionsRemaining).toBe(8);
      const expectedEnd = new Date();
      expectedEnd.setDate(expectedEnd.getDate() + 90);
      expect(client.planEndDate).toBe(expectedEnd.toISOString().slice(0, 10));

      const [updatedPayment] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, payment.id));
      expect(updatedPayment.status).toBe('succeeded');
      expect(updatedPayment.requiresApproval).toBe(false);
      expect(updatedPayment.appliedAt).not.toBeNull();
      const firstSucceededAt = updatedPayment.succeededAt;

      // Reenvío del mismo evento — no debe reactivar ni recalcular las fechas.
      const secondRes = await request(app).post('/api/wompi/webhook').send(buildTransactionUpdatedPayload('wompi-ref-approved-1', 'APPROVED'));
      expect(secondRes.status).toBe(200);
      const [paymentAfterRedelivery] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, payment.id));
      expect(paymentAfterRedelivery.succeededAt).toEqual(firstSucceededAt);
    });

    it('avisa al admin cuando el pago es un cambio de tipo de membresía (upgrade), aunque active directo sin aprobación', async () => {
      await db.update(clients).set({ clientType: 'mentoring' }).where(eq(clients.id, clientId));

      const [payment] = await db
        .insert(membershipPayments)
        .values({
          clientId,
          clientType: 'coaching_1_1', // distinto al clientType actual del cliente → upgrade
          durationMonths: 3,
          packageSize: 8,
          amountCents: 9900,
          currency: 'cop',
          provider: 'wompi',
          providerReference: 'wompi-ref-upgrade-1',
          status: 'pending',
        })
        .returning();

      const payload = buildTransactionUpdatedPayload('wompi-ref-upgrade-1', 'APPROVED');
      const res = await request(app).post('/api/wompi/webhook').send(payload);
      expect(res.status).toBe(200);

      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      expect(client.clientType).toBe('coaching_1_1'); // activado directo, sin aprobación

      const [updatedPayment] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, payment.id));
      expect(updatedPayment.requiresApproval).toBe(false);
      expect(updatedPayment.appliedAt).not.toBeNull();

      const notifications = await db
        .select()
        .from(adminNotifications)
        .where(and(eq(adminNotifications.clientId, clientId), eq(adminNotifications.type, 'membership_upgrade_applied')));
      expect(notifications).toHaveLength(1);

      await db.delete(adminNotifications).where(eq(adminNotifications.clientId, clientId));
    });

    it('no avisa al admin en una simple renovación del mismo tier', async () => {
      const [payment] = await db
        .insert(membershipPayments)
        .values({
          clientId,
          clientType: 'coaching_1_1', // mismo tipo que el cliente ya tiene tras el test anterior
          durationMonths: 3,
          packageSize: 8,
          amountCents: 9900,
          currency: 'cop',
          provider: 'wompi',
          providerReference: 'wompi-ref-renewal-1',
          status: 'pending',
        })
        .returning();

      const payload = buildTransactionUpdatedPayload('wompi-ref-renewal-1', 'APPROVED');
      const res = await request(app).post('/api/wompi/webhook').send(payload);
      expect(res.status).toBe(200);

      const notifications = await db
        .select()
        .from(adminNotifications)
        .where(and(eq(adminNotifications.clientId, clientId), eq(adminNotifications.type, 'membership_upgrade_applied')));
      expect(notifications).toHaveLength(0);

      await db.delete(membershipPayments).where(eq(membershipPayments.id, payment.id));
    });

    it('does not activate anything on a DECLINED transaction', async () => {
      const [payment] = await db
        .insert(membershipPayments)
        .values({
          clientId,
          clientType: 'coaching_1_1',
          durationMonths: 3,
          packageSize: 8,
          amountCents: 9900,
          currency: 'cop',
          provider: 'wompi',
          providerReference: 'wompi-ref-declined-1',
          status: 'pending',
        })
        .returning();

      const payload = buildTransactionUpdatedPayload('wompi-ref-declined-1', 'DECLINED');
      const res = await request(app).post('/api/wompi/webhook').send(payload);
      expect(res.status).toBe(200);

      const [unchangedPayment] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, payment.id));
      expect(unchangedPayment.status).toBe('pending');
    });
  });

  describe('cliente sin membresía paga previa (primer pago) — cola de aprobación, no activa solo', () => {
    const clientEmail = `wompi-webhook-newcomer-${Date.now()}@example.com`;
    let clientId: string;

    beforeAll(async () => {
      const [client] = await db
        .insert(clients)
        .values({ name: 'Newcomer Client', email: clientEmail, passwordHash: await hashPassword('x'), status: 'inactive', clientType: 'coaching_1_1' })
        .returning();
      clientId = client.id;
    });

    afterAll(async () => {
      await db.delete(adminNotifications).where(eq(adminNotifications.clientId, clientId));
      await db.delete(membershipPayments).where(eq(membershipPayments.clientId, clientId));
      await db.delete(clients).where(eq(clients.id, clientId));
    });

    it('marks the payment succeeded + requiresApproval, but does NOT activate the client or set any dates', async () => {
      const [payment] = await db
        .insert(membershipPayments)
        .values({
          clientId,
          clientType: 'coaching_1_1',
          durationMonths: 3,
          packageSize: 8,
          amountCents: 9900,
          currency: 'cop',
          provider: 'wompi',
          providerReference: 'wompi-ref-newcomer-1',
          status: 'pending',
        })
        .returning();

      const payload = buildTransactionUpdatedPayload('wompi-ref-newcomer-1', 'APPROVED');
      const res = await request(app).post('/api/wompi/webhook').send(payload);
      expect(res.status).toBe(200);

      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      expect(client.status).toBe('inactive'); // sin cambios — no se activó
      expect(client.planEndDate).toBeNull();
      expect(client.sessionsRemaining).toBeNull();

      const [updatedPayment] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, payment.id));
      expect(updatedPayment.status).toBe('succeeded'); // el dinero sí se confirmó
      expect(updatedPayment.requiresApproval).toBe(true);
      expect(updatedPayment.appliedAt).toBeNull();

      const notifications = await db.select().from(adminNotifications).where(eq(adminNotifications.clientId, clientId));
      expect(notifications.length).toBeGreaterThan(0);
    });
  });
});
