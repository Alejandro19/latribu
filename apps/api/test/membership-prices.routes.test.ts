import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, membershipPrices } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

describe('membership-prices routes', () => {
  const app = createApp();
  const adminEmail = `pricing-admin-${Date.now()}@example.com`;
  const clientEmail = `pricing-client-${Date.now()}@example.com`;
  let adminId: string;
  let adminToken: string;
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [admin] = await db.insert(admins).values({ name: 'Pricing Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
    adminToken = signToken({ id: adminId, role: 'admin', name: 'Pricing Admin', email: adminEmail });

    const [client] = await db.insert(clients).values({ name: 'Pricing Client', email: clientEmail, passwordHash: await hashPassword('x'), status: 'active' }).returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: 'Pricing Client', email: clientEmail, clientType: client.clientType });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  it('requires a token to list prices', async () => {
    const res = await request(app).get('/api/membership-prices');
    expect(res.status).toBe(401);
  });

  it('lets any logged-in role read the seeded prices', async () => {
    const res = await request(app).get('/api/membership-prices').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.prices.length).toBeGreaterThanOrEqual(3);
    const combos = res.body.prices.map((p: { clientType: string; durationMonths: number }) => `${p.clientType}-${p.durationMonths}`);
    expect(combos).toEqual(expect.arrayContaining(['coaching_1_1-1', 'coaching_1_1-3', 'mentoring-3']));
  });

  it('rejects a non-admin trying to edit a price', async () => {
    const [price] = await db.select().from(membershipPrices).limit(1);
    const res = await request(app)
      .patch(`/api/membership-prices/${price.id}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount_cents: 50000 });
    expect(res.status).toBe(403);
  });

  it('lets an admin update a price', async () => {
    const [price] = await db.select().from(membershipPrices).where(eq(membershipPrices.clientType, 'mentoring')).limit(1);
    const res = await request(app)
      .patch(`/api/membership-prices/${price.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount_cents: 400000 });
    expect(res.status).toBe(200);
    expect(res.body.price.amountCents).toBe(400000);

    // Restaurar al valor que tenía antes del test (no hardcodear 0 — mentoring
    // arranca con un precio de referencia real, $4.000 USD, no en $0).
    await db.update(membershipPrices).set({ amountCents: price.amountCents }).where(eq(membershipPrices.id, price.id));
  });

  it('rejects a negative amount', async () => {
    const [price] = await db.select().from(membershipPrices).limit(1);
    const res = await request(app)
      .patch(`/api/membership-prices/${price.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount_cents: -100 });
    expect(res.status).toBe(400);
  });
});
