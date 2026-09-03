import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, progressPhotos, anthropometricRecords } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('photos routes', () => {
  const app = createApp();
  let clientId: string;
  let token: string;
  let otherClientId: string;
  let otherAnthropometricRecordId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Photo Client', email: `photo-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    token = signToken({ id: clientId, role: 'cliente', name: 'Photo Client', email: client.email });

    const [otherClient] = await db
      .insert(clients)
      .values({ name: 'Other Client', email: `photo-other-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    otherClientId = otherClient.id;
    const [otherRecord] = await db
      .insert(anthropometricRecords)
      .values({ clientId: otherClientId, fecha: '2026-01-01', peso: 70 })
      .returning();
    otherAnthropometricRecordId = otherRecord.id;
  });

  afterAll(async () => {
    await db.delete(progressPhotos).where(eq(progressPhotos.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
    await db.delete(anthropometricRecords).where(eq(anthropometricRecords.clientId, otherClientId));
    await db.delete(clients).where(eq(clients.id, otherClientId));
  });

  it('uploads a progress photo', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .field('angle', 'frente')
      .field('fecha', '2026-01-01')
      .attach('photo', Buffer.from('fake image bytes'), { filename: 'front.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.photo.photoUrl).toMatch(/^https:\/\//);
    expect(res.body.photo.angle).toBe('frente');
  });

  it('rejects an upload with no file', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .field('angle', 'frente');
    expect(res.status).toBe(400);
  });

  it('ignores an anthropometric_record_id belonging to another client', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .field('angle', 'frente')
      .field('fecha', '2026-01-02')
      .field('anthropometric_record_id', otherAnthropometricRecordId)
      .attach('photo', Buffer.from('fake image bytes'), { filename: 'front2.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.photo.anthropometricRecordId).toBeNull();
  });

  it('lists photos for a client', async () => {
    const res = await request(app).get(`/api/clients/${clientId}/photos`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.photos.length).toBeGreaterThanOrEqual(1);
  });
});
