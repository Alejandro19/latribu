import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, mindsetQuotes } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('admin quotes routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientToken: string;
  let clientId: string;
  const createdQuoteIds: string[] = [];

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
    const [client] = await db
      .insert(clients)
      .values({ name: 'Admin Quotes Client', email: `adminquotes-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    for (const id of createdQuoteIds) {
      await db.delete(mindsetQuotes).where(eq(mindsetQuotes.id, id)).catch(() => {});
    }
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('rejects a client on every admin quotes route', async () => {
    const getRes = await request(app).get('/api/admin/quotes').set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.status).toBe(403);
    const postRes = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ quote: 'x' });
    expect(postRes.status).toBe(403);
  });

  it('rejects an empty quote on create', async () => {
    const res = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: '' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty quote on update', async () => {
    const [created] = await db.insert(mindsetQuotes).values({ quote: 'Frase editable', active: true }).returning();
    createdQuoteIds.push(created.id);

    const res = await request(app)
      .patch(`/api/admin/quotes/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: '   ' });
    expect(res.status).toBe(400);

    const unchanged = await db.select().from(mindsetQuotes).where(eq(mindsetQuotes.id, created.id));
    expect(unchanged[0].quote).toBe('Frase editable');
  });

  it('creates, lists, updates, and deletes a quote', async () => {
    const createRes = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: 'Estoy trabajando en mi cuerpo con amor y disciplina', author: 'La Tribu' });
    expect(createRes.status).toBe(201);
    const quoteId = createRes.body.quote.id;
    createdQuoteIds.push(quoteId);
    expect(createRes.body.quote.author).toBe('La Tribu');

    const updateRes = await request(app)
      .patch(`/api/admin/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: 'Texto actualizado', active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.quote.quote).toBe('Texto actualizado');
    expect(updateRes.body.quote.active).toBe(false);

    const listRes = await request(app).get('/api/admin/quotes').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.quotes.some((q: { id: string }) => q.id === quoteId)).toBe(true);

    const deleteRes = await request(app).delete(`/api/admin/quotes/${quoteId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    const afterDelete = await request(app).get('/api/admin/quotes').set('Authorization', `Bearer ${adminToken}`);
    expect(afterDelete.body.quotes.some((q: { id: string }) => q.id === quoteId)).toBe(false);
  });

  it('allows creating a quote with no author', async () => {
    const res = await request(app)
      .post('/api/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quote: 'Frase sin autor' });
    expect(res.status).toBe(201);
    expect(res.body.quote.author).toBeNull();
    createdQuoteIds.push(res.body.quote.id);
  });
});
