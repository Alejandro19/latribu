import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients } from '../src/models/schema.js';
import { hashPassword, signToken } from '../src/services/auth.service.js';

describe('clients routes (CRUD)', () => {
  const app = createApp();
  const adminEmail = `clients-admin-${Date.now()}@example.com`;
  let adminId: string;
  let adminToken: string;
  let createdClientId: string;

  beforeAll(async () => {
    const [admin] = await db.insert(admins).values({ name: 'CRUD Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
    adminToken = signToken({ id: adminId, role: 'admin', name: 'CRUD Admin', email: adminEmail });
  });

  afterAll(async () => {
    if (createdClientId) await db.delete(clients).where(eq(clients.id, createdClientId));
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  it('rejects a non-admin from listing clients', async () => {
    const fakeClientToken = signToken({ id: 'someone', role: 'cliente', name: 'X', email: 'x@x.com' });
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${fakeClientToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a client as admin', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'CRUD Client', email: `crud-client-${Date.now()}@example.com`, password: 'secret' });
    expect(res.status).toBe(201);
    expect(res.body.client.name).toBe('CRUD Client');
    createdClientId = res.body.client.id;
  });

  it('lists clients as admin, including the one just created', async () => {
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.clients.some((c: { id: string }) => c.id === createdClientId)).toBe(true);
  });

  it('gets a single client by id', async () => {
    const res = await request(app).get(`/api/clients/${createdClientId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.client.id).toBe(createdClientId);
  });

  it('updates a client', async () => {
    const res = await request(app)
      .put(`/api/clients/${createdClientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed Client' });
    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Renamed Client');
  });

  it('rejects creating a client with a duplicate email', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', email: adminEmail, password: 'secret' });
    expect(res.status).toBe(409);
  });

  it('deletes a client', async () => {
    const res = await request(app).delete(`/api/clients/${createdClientId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const remaining = await db.select().from(clients).where(eq(clients.id, createdClientId));
    expect(remaining).toHaveLength(0);
    createdClientId = '';
  });
});
