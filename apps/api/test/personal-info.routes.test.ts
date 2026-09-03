import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, personalInfo, adminNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('personal-info routes', () => {
  const app = createApp();
  let coachingClientId: string;
  let unclassifiedClientId: string;
  let coachingToken: string;
  let unclassifiedToken: string;

  beforeAll(async () => {
    const [coachingClient] = await db
      .insert(clients)
      .values({ name: 'Coaching Client', email: `coaching-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    coachingClientId = coachingClient.id;
    coachingToken = signToken({ id: coachingClientId, role: 'cliente', name: 'Coaching Client', email: coachingClient.email });

    // Tipo inexistente en la matriz — ni personal_info ni
    // personal_info_mentoring quedan permitidos (cerrado por defecto),
    // insertado directo porque el enum de CLIENT_TYPES solo se valida en la
    // ruta PATCH, no a nivel de columna.
    const [unclassifiedClient] = await db
      .insert(clients)
      .values({ name: 'Unclassified Client', email: `unclassified-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'sin_clasificar' })
      .returning();
    unclassifiedClientId = unclassifiedClient.id;
    unclassifiedToken = signToken({ id: unclassifiedClientId, role: 'cliente', name: 'Unclassified Client', email: unclassifiedClient.email });
  });

  afterAll(async () => {
    await db.delete(adminNotifications).where(eq(adminNotifications.clientId, coachingClientId));
    await db.delete(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    await db.delete(clients).where(eq(clients.id, coachingClientId));
    await db.delete(clients).where(eq(clients.id, unclassifiedClientId));
  });

  it('blocks a client whose type is not in the matrix from reading personal-info', async () => {
    const res = await request(app)
      .get(`/api/clients/${unclassifiedClientId}/personal-info`)
      .set('Authorization', `Bearer ${unclassifiedToken}`);
    expect(res.status).toBe(403);
  });

  it('returns an empty object when a coaching client has no personal-info row yet', async () => {
    const res = await request(app)
      .get(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`);
    expect(res.status).toBe(200);
    expect(res.body.personalInfo).toEqual({});
  });

  it('creates personal-info on first PUT and inserts an admin notification when complete', async () => {
    const res = await request(app)
      .put(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .send({ country: 'México', city: 'CDMX', weight: 70, complete: true });
    expect(res.status).toBe(200);
    expect(res.body.personalInfo.country).toBe('México');
    expect(res.body.personalInfo.completedAt).not.toBeNull();

    const notifications = await db.select().from(adminNotifications).where(eq(adminNotifications.clientId, coachingClientId));
    expect(notifications.some((n) => n.type === 'onboarding_complete')).toBe(true);
  });

  it('does not insert a second admin notification when already complete', async () => {
    await request(app)
      .put(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .send({ city: 'Guadalajara', complete: true });

    const notifications = await db
      .select()
      .from(adminNotifications)
      .where(eq(adminNotifications.clientId, coachingClientId));
    expect(notifications.filter((n) => n.type === 'onboarding_complete')).toHaveLength(1);
  });

  it('uploads a checkup file and merges its URL into onboarding_report', async () => {
    const res = await request(app)
      .post(`/api/clients/${coachingClientId}/personal-info-file`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .attach('checkup_file', Buffer.from('%PDF-1.4 fake'), { filename: 'checkup.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.file_url).toMatch(/^https:\/\//);

    const [info] = await db.select().from(personalInfo).where(eq(personalInfo.clientId, coachingClientId));
    expect((info.onboardingReport as Record<string, unknown>).checkup_file_url).toBe(res.body.file_url);
  });

  it('saves cargo_type and sector (segmentación de Mentoría, la llena un admin)', async () => {
    const res = await request(app)
      .put(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .send({ cargo_type: 'C-level', sector: 'Tecnología' });
    expect(res.status).toBe(200);
    expect(res.body.personalInfo.cargoType).toBe('C-level');
    expect(res.body.personalInfo.sector).toBe('Tecnología');
  });

  it('rejects an invalid cargo_type/sector value', async () => {
    const res = await request(app)
      .put(`/api/clients/${coachingClientId}/personal-info`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .send({ cargo_type: 'no-existe' });
    expect(res.status).toBe(400);
  });

  it('rejects a checkup file with an invalid mimetype', async () => {
    const res = await request(app)
      .post(`/api/clients/${coachingClientId}/personal-info-file`)
      .set('Authorization', `Bearer ${coachingToken}`)
      .attach('checkup_file', Buffer.from('not a real gif'), { filename: 'checkup.gif', contentType: 'image/gif' });
    expect(res.status).toBe(400);
  });
});
