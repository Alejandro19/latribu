import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { admins, clients } from '../src/models/schema.js';
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

  it('rejects a brand new identity with no existing account — the platform has no public self-registration', async () => {
    setGoogleVerifierForTests({
      verifyIdToken: async () => ({ getPayload: () => fakePayload() }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();

    const created = await db.select().from(clients).where(eq(clients.email, 'google-user@example.com'));
    expect(created).toHaveLength(0);
  });

  it('still finds a client by googleId when their platform email no longer matches the Google account (changed via the account panel)', async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Renamed Email Client',
        email: 'renamed-email-client@example.com',
        googleId: 'google-sub-changed-email',
        status: 'active',
      })
      .returning();

    setGoogleVerifierForTests({
      // Google sigue devolviendo el email original con el que se vinculó la
      // cuenta — ya no coincide con el que el cliente guardó desde el panel.
      verifyIdToken: async () => ({ getPayload: () => fakePayload({ email: 'original-google-email@example.com', sub: 'google-sub-changed-email' }) }),
    });
    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('cliente');
    expect(res.body.user.id).toBe(client.id);
    // No debe haber creado una cuenta nueva ni pisado el email guardado.
    expect(res.body.user.email).toBe('renamed-email-client@example.com');

    await db.delete(clients).where(eq(clients.id, client.id));
  });
});
