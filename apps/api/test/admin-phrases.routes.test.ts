import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, phrases } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('admin phrases routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientToken: string;
  let clientId: string;
  const createdPhraseIds: string[] = [];

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
    const [client] = await db
      .insert(clients)
      .values({ name: 'Admin Phrases Client', email: `adminphrases-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    for (const id of createdPhraseIds) {
      await db.delete(phrases).where(eq(phrases.id, id)).catch(() => {});
    }
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects a client on every admin phrases route', async () => {
    const getRes = await request(app).get('/api/admin/phrases').set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.status).toBe(403);
    const postRes = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'x', context: 'ambas' });
    expect(postRes.status).toBe(403);
  });

  it('rejects an empty text on create', async () => {
    const res = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: '', context: 'ambas' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid context on create', async () => {
    const res = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Frase válida', context: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty text on update', async () => {
    const [created] = await db.insert(phrases).values({ text: 'Frase editable', context: 'ambas', active: true }).returning();

    const res = await request(app)
      .patch(`/api/admin/phrases/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: '   ' });
    expect(res.status).toBe(400);

    const unchanged = await db.select().from(phrases).where(eq(phrases.id, created.id));
    expect(unchanged[0].text).toBe('Frase editable');

    await db.delete(phrases).where(eq(phrases.id, created.id));
  });

  it('creates, lists (including inactive), updates, and deletes a phrase', async () => {
    const createRes = await request(app)
      .post('/api/admin/phrases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Cada sesión cuenta', context: 'confirmacion' });
    expect(createRes.status).toBe(201);
    const phraseId = createRes.body.phrase.id;
    createdPhraseIds.push(phraseId);

    const updateRes = await request(app)
      .patch(`/api/admin/phrases/${phraseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.phrase.active).toBe(false);

    const listRes = await request(app).get('/api/admin/phrases').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.phrases.some((p: { id: string; active: boolean }) => p.id === phraseId && p.active === false)).toBe(true);

    const deleteRes = await request(app).delete(`/api/admin/phrases/${phraseId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    const afterDelete = await request(app).get('/api/admin/phrases').set('Authorization', `Bearer ${adminToken}`);
    expect(afterDelete.body.phrases.some((p: { id: string }) => p.id === phraseId)).toBe(false);
  });

  it('excludes the given id from GET /admin/phrases/random when more than one candidate is eligible', async () => {
    const [p1] = await db.insert(phrases).values({ text: 'Frase uno', context: 'instagram', active: true }).returning();
    const [p2] = await db.insert(phrases).values({ text: 'Frase dos', context: 'instagram', active: true }).returning();
    createdPhraseIds.push(p1.id, p2.id);

    const res = await request(app)
      .get(`/api/admin/phrases/random?context=instagram&exclude=${p1.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.phrase.id).toBe(p2.id);
  });

  it('returns null from GET /admin/phrases/random when there are no eligible phrases', async () => {
    const res = await request(app)
      .get('/api/admin/phrases/random?context=confirmacion')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.phrase).toBeNull();
  });

  // Fase 3 del plan de optimización de navegación: GET /admin/phrases debe
  // marcarse "private, no-cache" (revalidar siempre, nunca servir de caché
  // sin preguntarle al servidor) y soportar conditional GET vía el ETag que
  // Express ya genera — sin esto, el header queda sin usarse nunca.
  it('sets Cache-Control: private, no-cache and answers a matching If-None-Match with 304', async () => {
    const first = await request(app).get('/api/admin/phrases').set('Authorization', `Bearer ${adminToken}`);
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('private, no-cache');
    const etag = first.headers['etag'];
    expect(etag).toBeTruthy();

    const revalidated = await request(app)
      .get('/api/admin/phrases')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('If-None-Match', etag);
    expect(revalidated.status).toBe(304);
    expect(revalidated.text).toBe('');
  });
});
