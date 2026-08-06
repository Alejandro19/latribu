import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients, adminNotifications } from '../src/models/schema.js';
import { hashPassword } from '../src/services/auth.service.js';
import { setGoogleVerifierForTests } from '../src/services/google-auth.service.js';

function fakePayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'google-user@example.com',
    email_verified: true,
    sub: 'google-sub-123',
    name: 'Google User',
    ...overrides,
  };
}

describe('POST /api/auth/google', () => {
  const app = createApp();
  const adminEmail = `google-admin-${Date.now()}@example.com`;
  let adminId: string;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    const [admin] = await db.insert(admins).values({ name: 'Google Admin', email: adminEmail, passwordHash: await hashPassword('x') }).returning();
    adminId = admin.id;
  });

  afterAll(async () => {
    await db.delete(admins).where(eq(admins.id, adminId));
  });

  beforeEach(() => {
    setGoogleVerifierForTests(null);
  });

  afterEach(async () => {
    // Scoped to the one client this file creates — never delete by `type`
    // alone, since other test files also insert 'new_registration' rows and
    // may run concurrently against the same test database.
    const created = await db.select().from(clients).where(eq(clients.email, 'google-user@example.com'));
    if (created[0]) {
      await db.delete(adminNotifications).where(eq(adminNotifications.clientId, created[0].id));
      await db.delete(clients).where(eq(clients.id, created[0].id));
    }
  });

  it('rejects an unverified Google token', async () => {
    setGoogleVerifierForTests({
      verifyIdToken: async () => ({ getPayload: () => fakePayload({ email_verified: false }) }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(401);
  });

  it('logs an existing admin in by matching email', async () => {
    setGoogleVerifierForTests({
      verifyIdToken: async () => ({ getPayload: () => fakePayload({ email: adminEmail }) }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('creates a new inactive client when no account matches', async () => {
    setGoogleVerifierForTests({
      verifyIdToken: async () => ({ getPayload: () => fakePayload() }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(201);
    expect(res.body.pending).toBe(true);

    const created = await db.select().from(clients).where(eq(clients.email, 'google-user@example.com'));
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe('inactive');
  });
});
