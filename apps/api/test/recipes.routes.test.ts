import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, recipes } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('recipes routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({
        name: 'Recipes Client',
        email: `recipes-${Date.now()}@example.com`,
        status: 'active',
        clientType: 'coaching_1_1',
        permissions: { nutrition: true },
      })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(recipes);
  });

  it('rejects a client from reading the admin recipe list', async () => {
    const res = await request(app).get('/api/admin/recipes').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects creating a recipe without a name', async () => {
    const res = await request(app)
      .post('/api/admin/recipes')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', '')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), { filename: 'receta.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-PDF upload', async () => {
    const res = await request(app)
      .post('/api/admin/recipes')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Bowl de proteína')
      .attach('pdf', Buffer.from('not a pdf'), { filename: 'receta.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('admin uploads a recipe, the client sees it in the active list, and admin can delete it', async () => {
    const createRes = await request(app)
      .post('/api/admin/recipes')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Bowl de proteína')
      .field('category', 'Almuerzo')
      .attach('pdf', Buffer.from('%PDF-1.4 fake'), { filename: 'bowl.pdf', contentType: 'application/pdf' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.recipe.name).toBe('Bowl de proteína');
    expect(createRes.body.recipe.pdfName).toBe('bowl.pdf');
    expect(createRes.body.recipe.pdfUrl).toEqual(expect.stringContaining('http'));
    const recipeId = createRes.body.recipe.id;

    const listRes = await request(app).get(`/api/clients/${clientId}/recipes`).set('Authorization', `Bearer ${clientToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.recipes.some((r: { id: string }) => r.id === recipeId)).toBe(true);

    const deleteRes = await request(app).delete(`/api/admin/recipes/${recipeId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const [gone] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(gone).toBeUndefined();
  });

  it('rejects a client without the nutrition permission from reading the recipe list', async () => {
    await db.update(clients).set({ permissions: { nutrition: false } }).where(eq(clients.id, clientId));
    const res = await request(app).get(`/api/clients/${clientId}/recipes`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
    await db.update(clients).set({ permissions: { nutrition: true } }).where(eq(clients.id, clientId));
  });
});
