import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, clientInvitations } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';
import { generateRawToken, hashToken } from '../src/services/token-hashing.js';

describe('client invitations (alta Mentoría)', () => {
  const app = createApp();
  const adminEmail = `invite-admin-${Date.now()}@example.com`;
  let adminId: string;
  let adminToken: string;
  const createdClientIds: string[] = [];

  beforeAll(async () => {
    const [admin] = await db.insert(admins).values({ name: 'Invite Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
    adminToken = signToken({ id: adminId, role: 'admin', name: 'Invite Admin', email: adminEmail });
  });

  afterAll(async () => {
    for (const id of createdClientIds) await db.delete(clients).where(eq(clients.id, id));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  it('rejects creating a coaching_1_1 client without a password', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No Password', email: `no-pw-${Date.now()}@example.com`, client_type: 'coaching_1_1' });
    expect(res.status).toBe(400);
  });

  it('creates a mentoring client with no password and sends an invitation instead', async () => {
    const email = `mentoring-invite-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mentoring Client', email, client_type: 'mentoring' });
    expect(res.status).toBe(201);
    expect(res.body.client.passwordHash).toBeNull();
    expect(res.body.client.clientType).toBe('mentoring');
    createdClientIds.push(res.body.client.id);

    const getRes = await request(app).get(`/api/clients/${res.body.client.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.client.hasPendingInvitation).toBe(true);
  });

  it('accepts a valid invitation token, sets the password, and auto-logs the client in', async () => {
    const email = `accept-invite-${Date.now()}@example.com`;
    const createRes = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Accept Invite Client', email, client_type: 'mentoring' });
    const clientId = createRes.body.client.id;
    createdClientIds.push(clientId);

    // El email va a no-op en test (sin SMTP configurado) — se genera un token
    // fresco directamente contra la tabla para simular el link real.
    const rawToken = generateRawToken();
    await db.update(clientInvitations).set({ tokenHash: hashToken(rawToken) }).where(eq(clientInvitations.clientId, clientId));

    const acceptRes = await request(app).post('/api/auth/accept-invitation').send({ token: rawToken, password: 'nueva-clave-123' });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.role).toBe('cliente');
    expect(typeof acceptRes.body.token).toBe('string');
    expect(acceptRes.body.onboardingComplete).toBe(false);

    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.passwordHash).not.toBeNull();
    expect(client.mustChangePassword).toBe(false);

    // El mismo token no puede reusarse.
    const secondAttempt = await request(app).post('/api/auth/accept-invitation').send({ token: rawToken, password: 'otra-clave-456' });
    expect(secondAttempt.status).toBe(400);
  });

  it('rejects an expired invitation token with an explicit error', async () => {
    const email = `expired-invite-${Date.now()}@example.com`;
    const [client] = await db.insert(clients).values({ name: 'Expired Invite', email, passwordHash: null, clientType: 'mentoring' }).returning();
    createdClientIds.push(client.id);

    const rawToken = generateRawToken();
    await db.insert(clientInvitations).values({
      clientId: client.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).post('/api/auth/accept-invitation').send({ token: rawToken, password: 'nueva-clave-123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/venció|expiró|reenvíe/i);
  });

  it('lets the admin resend an invitation, invalidating the previous token', async () => {
    const email = `resend-invite-${Date.now()}@example.com`;
    const createRes = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Resend Invite Client', email, client_type: 'mentoring' });
    const clientId = createRes.body.client.id;
    createdClientIds.push(clientId);

    const [oldRow] = await db.select().from(clientInvitations).where(eq(clientInvitations.clientId, clientId));
    const oldRawToken = generateRawToken();
    await db.update(clientInvitations).set({ tokenHash: hashToken(oldRawToken) }).where(eq(clientInvitations.id, oldRow.id));

    const resendRes = await request(app).post(`/api/clients/${clientId}/resend-invitation`).set('Authorization', `Bearer ${adminToken}`);
    expect(resendRes.status).toBe(200);

    // El token viejo ya no sirve.
    const oldAttempt = await request(app).post('/api/auth/accept-invitation').send({ token: oldRawToken, password: 'clave-vieja-123' });
    expect(oldAttempt.status).toBe(400);
  });

  it('never allows resending an invitation once the client already has a password', async () => {
    const email = `already-active-${Date.now()}@example.com`;
    const [client] = await db.insert(clients).values({ name: 'Already Active', email, passwordHash: await hashPassword('x'), clientType: 'mentoring' }).returning();
    createdClientIds.push(client.id);

    const res = await request(app).post(`/api/clients/${client.id}/resend-invitation`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('reports hasPendingInvitation as false for a regular coaching_1_1 client', async () => {
    const email = `regular-client-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Regular Client', email, password: 'secret' });
    createdClientIds.push(res.body.client.id);

    const getRes = await request(app).get(`/api/clients/${res.body.client.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.client.hasPendingInvitation).toBe(false);
  });
});
