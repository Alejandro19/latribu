import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, cortisolTechniques, clientNotifications } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('cortisol techniques routes', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;
  let clientToken: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Cortisol Client', email: `cortisol-${Date.now()}@example.com`, status: 'active', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterAll(async () => {
    await db.delete(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(cortisolTechniques).where(eq(cortisolTechniques.clientId, clientId));
  });

  it('a client with permissions.cortisol=true and no techniques yet gets an empty list', async () => {
    await db.update(clients).set({ permissions: { cortisol: true } }).where(eq(clients.id, clientId));
    const res = await request(app).get(`/api/clients/${clientId}/cortisol-techniques`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.techniques).toEqual([]);
    await db.update(clients).set({ permissions: {} }).where(eq(clients.id, clientId));
  });

  it('rejects a client from assigning their own technique (admin-only)', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Respiración 4-7-8' });
    expect(res.status).toBe(403);
  });

  it('admin assigns a technique, which unlocks the cortisol module and notifies the client', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Respiración 4-7-8', type: 'Respiración', duration_minutes: 5 });
    expect(res.status).toBe(201);
    expect(res.body.technique.title).toBe('Respiración 4-7-8');

    const [updatedClient] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect((updatedClient.permissions as Record<string, boolean>).cortisol).toBe(true);

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('Stress'))).toBe(true);
  });

  it('creates a technique flagged as a Rox Ritual, and a later partial edit does not clear the flag', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Respiración de descarga', is_ritual: true });
    expect(createRes.status).toBe(201);
    expect(createRes.body.technique.isRitual).toBe(true);
    const techId = createRes.body.technique.id;

    // Editar SOLO el título (sin volver a marcar is_ritual) no debe apagar
    // el flag — regresión real: un `?? false` en el mapeo de campos del
    // servicio apagaba isRitual en cualquier PATCH parcial que no lo tocara.
    const updateRes = await request(app)
      .put(`/api/clients/${clientId}/cortisol-techniques/${techId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Respiración de descarga (editada)' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.technique.isRitual).toBe(true);
  });

  it('admin updates and deletes a technique', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Meditación guiada' });
    const techId = createRes.body.technique.id;

    const updateRes = await request(app)
      .put(`/api/clients/${clientId}/cortisol-techniques/${techId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Meditación guiada 10 min', type: 'Meditación' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.technique.title).toBe('Meditación guiada 10 min');

    const deleteRes = await request(app).delete(`/api/clients/${clientId}/cortisol-techniques/${techId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
  });

  it('uploads a video and attaches it to the technique', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Con video' });
    const techId = createRes.body.technique.id;

    const res = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques/${techId}/upload`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('video', Buffer.from('fake-video-bytes'), 'clip.mp4');
    expect(res.status).toBe(200);
    expect(res.body.technique.videoName).toBe('clip.mp4');
    expect(res.body.technique.videoUrl).toEqual(expect.stringContaining('http'));
  });

  it('uploads audio, then replacing it deletes the old file via storage and stores the new one', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Con audio' });
    const techId = createRes.body.technique.id;

    const firstUpload = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques/${techId}/upload-audio`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('audio', Buffer.from('fake-audio-bytes-1'), 'first.mp3');
    expect(firstUpload.status).toBe(200);
    const firstAudioUrl = firstUpload.body.technique.audioUrl;

    const secondUpload = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques/${techId}/upload-audio`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('audio', Buffer.from('fake-audio-bytes-2'), 'second.mp3');
    expect(secondUpload.status).toBe(200);
    expect(secondUpload.body.technique.audioUrl).not.toBe(firstAudioUrl);
  });

  it('asigna una técnica de Neurowellness (Exposición Controlada) con nota de precaución, y la actualiza', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ducha fría 2 min', type: 'Exposición Controlada', precaution_note: 'No recomendado con hipertensión no controlada.' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.technique.type).toBe('Exposición Controlada');
    expect(createRes.body.technique.precautionNote).toBe('No recomendado con hipertensión no controlada.');

    const techId = createRes.body.technique.id;
    const updateRes = await request(app)
      .put(`/api/clients/${clientId}/cortisol-techniques/${techId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ducha fría 2 min', type: 'Respiración Vagal', precaution_note: null });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.technique.type).toBe('Respiración Vagal');
    expect(updateRes.body.technique.precautionNote).toBeNull();
  });

  it('acepta el tipo "Recuperación Activa"', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Caminata entre bloques', type: 'Recuperación Activa' });
    expect(res.status).toBe(201);
    expect(res.body.technique.type).toBe('Recuperación Activa');
  });

  it('PUT with audio_url: null clears the audio field and deletes the stored file', async () => {
    const createRes = await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Para limpiar audio' });
    const techId = createRes.body.technique.id;
    await request(app)
      .post(`/api/clients/${clientId}/cortisol-techniques/${techId}/upload-audio`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('audio', Buffer.from('fake-audio-bytes'), 'clip.mp3');

    const clearRes = await request(app)
      .put(`/api/clients/${clientId}/cortisol-techniques/${techId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Para limpiar audio', audio_url: null });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.technique.audioUrl).toBeNull();
  });
});
