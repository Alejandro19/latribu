import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';
import type Stripe from 'stripe';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, membershipPrices, membershipPayments } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';
import { setStripeClientForTests } from '../src/services/stripe.service.js';
import { setTrmFetcherForTests } from '../src/services/trm.service.js';

function fakeStripeClient(paymentIntentId: string): Stripe {
  return {
    paymentIntents: {
      create: async () => ({ id: paymentIntentId, client_secret: `secret_${paymentIntentId}` }),
    },
  } as unknown as Stripe;
}

function fakeTrmFetch(valor: string, vigenciadesde: string) {
  return async () => ({ ok: true, status: 200, json: async () => [{ valor, vigenciadesde }] }) as unknown as Response;
}

describe('account membership checkout', () => {
  const app = createApp();
  const clientEmail = `checkout-client-${Date.now()}@example.com`;
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Checkout Client', email: clientEmail, passwordHash: await hashPassword('x'), status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: 'Checkout Client', email: clientEmail, clientType: client.clientType });
  });

  afterAll(async () => {
    await db.delete(membershipPayments).where(eq(membershipPayments.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    setStripeClientForTests(null);
    setTrmFetcherForTests(null);
  });

  it('rejects mentoring with a 1-month duration (server-side, never trusts the client)', async () => {
    const res = await request(app)
      .post('/api/account/membership/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ client_type: 'mentoring', duration_months: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects Presencial without a package_size (required for that tier only)', async () => {
    const res = await request(app)
      .post('/api/account/membership/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ client_type: 'coaching_1_1', duration_months: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects a checkout whose price row was temporarily zeroed out', async () => {
    const [price] = await db
      .select()
      .from(membershipPrices)
      .where(and(eq(membershipPrices.clientType, 'coaching_1_1'), eq(membershipPrices.durationMonths, 1), eq(membershipPrices.packageSize, 8)));
    await db.update(membershipPrices).set({ amountCents: 0 }).where(eq(membershipPrices.id, price.id));
    try {
      const res = await request(app)
        .post('/api/account/membership/checkout')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ client_type: 'coaching_1_1', duration_months: 1, package_size: 8 });
      expect(res.status).toBe(409);
    } finally {
      await db.update(membershipPrices).set({ amountCents: price.amountCents }).where(eq(membershipPrices.id, price.id));
    }
  });

  it('creates a Wompi charge for Presencial with the real seeded price (no mocking needed), and lets the client poll its own status', async () => {
    const res = await request(app)
      .post('/api/account/membership/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ client_type: 'coaching_1_1', duration_months: 1, package_size: 12 });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('wompi');
    expect(res.body.amountInCents).toBe(87000000); // 870.000 COP
    expect(res.body.currency).toBe('COP'); // Wompi exige la moneda en mayúscula
    const { membershipPaymentId } = res.body;

    const [row] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, membershipPaymentId));
    expect(row.status).toBe('pending');
    expect(row.provider).toBe('wompi');

    const statusRes = await request(app)
      .get(`/api/account/membership/payments/${membershipPaymentId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('pending');
  });

  it("rejects reading another client's payment status", async () => {
    const checkoutRes = await request(app)
      .post('/api/account/membership/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ client_type: 'coaching_1_1', duration_months: 1, package_size: 12 });
    const { membershipPaymentId } = checkoutRes.body;

    const [otherClient] = await db
      .insert(clients)
      .values({ name: 'Other Checkout Client', email: `other-checkout-${Date.now()}@example.com`, passwordHash: await hashPassword('x'), status: 'active' })
      .returning();
    const otherToken = signToken({ id: otherClient.id, role: 'cliente', name: 'Other', email: otherClient.email, clientType: otherClient.clientType });

    const res = await request(app)
      .get(`/api/account/membership/payments/${membershipPaymentId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);

    await db.delete(clients).where(eq(clients.id, otherClient.id));
  });

  it('creates a Presencial charge for the exact package × duration price combination, and snapshots package_size on the payment row', async () => {
    const res = await request(app)
      .post('/api/account/membership/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ client_type: 'coaching_1_1', duration_months: 3, package_size: 12 });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('wompi');
    expect(res.body.amountInCents).toBe(251000000); // 2.510.000 COP

    const [row] = await db.select().from(membershipPayments).where(eq(membershipPayments.providerReference, res.body.providerReference));
    expect(row.packageSize).toBe(12);
    expect(row.durationMonths).toBe(3);
  });

  it('Elite vía Stripe (disponible en el entorno de test) cobra el USD de referencia directo, sin el puente TRM', async () => {
    setStripeClientForTests(fakeStripeClient('pi_elite_stripe_1'));
    const res = await request(app)
      .post('/api/account/membership/checkout')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ client_type: 'mentoring', duration_months: 3 });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('stripe');
    expect(res.body.clientSecret).toBe('secret_pi_elite_stripe_1');

    const [row] = await db.select().from(membershipPayments).where(eq(membershipPayments.providerReference, 'pi_elite_stripe_1'));
    expect(row.amountCents).toBe(400000); // $4.000 USD directo
    expect(row.currency).toBe('usd');
    expect(row.trmUsed).toBeNull();
  });

  it('Elite vía el puente Wompi (Stripe no disponible) convierte el USD de referencia a COP con la TRM + margen, y audita la conversión', async () => {
    const originalStripeKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    setTrmFetcherForTests(fakeTrmFetch('4000', '2026-08-20T00:00:00.000'));
    try {
      const res = await request(app)
        .post('/api/account/membership/checkout')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ client_type: 'mentoring', duration_months: 3 });
      expect(res.status).toBe(201);
      expect(res.body.provider).toBe('wompi');
      const expectedAmountCents = Math.round(4000 * 4000 * 1.03 * 100); // $4.000 * TRM 4000 * margen 3% por defecto
      expect(res.body.amountInCents).toBe(expectedAmountCents);
      expect(res.body.currency).toBe('COP'); // Wompi exige la moneda en mayúscula

      const [row] = await db.select().from(membershipPayments).where(eq(membershipPayments.providerReference, res.body.providerReference));
      expect(Number(row.trmUsed)).toBe(4000);
      expect(row.trmDate).toBe('2026-08-20');
      expect(Number(row.marginApplied)).toBe(0.03);
    } finally {
      if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = originalStripeKey;
      setTrmFetcherForTests(null);
    }
  });

  it('reports which payment providers are currently available', async () => {
    const res = await request(app).get('/api/account/membership/providers').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    const names = res.body.providers.map((p: { name: string }) => p.name);
    expect(names).toEqual(expect.arrayContaining(['wompi', 'stripe']));
  });
});
