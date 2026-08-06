import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, adminNotifications, personalInfo } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

describe('auth routes', () => {
  const app = createApp();
  const adminEmail = `auth-admin-${Date.now()}@example.com`;
  const clientEmail = `auth-client-${Date.now()}@example.com`;
  let adminId: string;
  let clientId: string;

  beforeAll(async () => {
    const [admin] = await db
      .insert(admins)
      .values({ name: 'Test Admin', email: adminEmail, passwordHash: await hashPassword('admin-pass') })
      .returning();
    adminId = admin.id;

    const [client] = await db
      .insert(clients)
      .values({ name: 'Test Client', email: clientEmail, passwordHash: await hashPassword('client-pass'), status: 'active' })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(adminNotifications).where(eq(adminNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  afterEach(async () => {
    await db.delete(clients).where(eq(clients.email, 'new-register@example.com'));
  });

  it('logs an admin in with the correct password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'admin-pass' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects a login with the wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('logs a client in and reports their permissions', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'client-pass' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('cliente');
    expect(res.body.permissions).toBeDefined();
  });

  it('reports onboardingComplete as false for a client with no personal-info row', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'client-pass' });
    expect(res.status).toBe(200);
    expect(res.body.onboardingComplete).toBe(false);
  });

  it('reports onboardingComplete as true on /me once personal-info is completed', async () => {
    await db.insert(personalInfo).values({ clientId, completedAt: new Date() });
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email: clientEmail });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.onboardingComplete).toBe(true);
    await db.delete(personalInfo).where(eq(personalInfo.clientId, clientId));
  });

  it('rejects a login for an inactive client', async () => {
    await db.update(clients).set({ status: 'inactive' }).where(eq(clients.id, clientId));
    const res = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'client-pass' });
    expect(res.status).toBe(403);
    await db.update(clients).set({ status: 'active' }).where(eq(clients.id, clientId));
  });

  it('registers a new client as inactive and pending', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Register', email: 'new-register@example.com', password: 'secret' });
    expect(res.status).toBe(201);
    expect(res.body.pending).toBe(true);
  });

  it('rejects registering an email that already exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: adminEmail, password: 'secret' });
    expect(res.status).toBe(409);
  });

  it('returns the current admin on /me', async () => {
    const token = signToken({ id: adminId, role: 'admin', name: 'Test Admin', email: adminEmail });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(adminEmail);
  });

  it('changes the current user\'s password', async () => {
    const token = signToken({ id: clientId, role: 'cliente', name: 'Test Client', email: clientEmail });
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'client-pass', newPassword: 'new-client-pass' });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({ email: clientEmail, password: 'new-client-pass' });
    expect(loginRes.status).toBe(200);
  });
});
