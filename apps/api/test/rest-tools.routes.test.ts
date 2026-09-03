import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, restTools } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import * as storageModule from '../src/storage/index.js';

describe('rest-tools routes', () => {
  const app = createApp();
  let adminToken: string;
  let clientToken: string;
  let clientId: string;

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
    const [client] = await db
      .insert(clients)
      .values({ name: 'Rest Tools Client', email: `resttools-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    clientToken = signToken({ id: clientId, role: 'cliente', name: client.name, email: client.email });
  });

  afterEach(async () => {
    await db.delete(restTools);
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  it('seeds the 3 default tools on first GET /rest-tools when the table is empty, and does not duplicate on a second call', async () => {
    const first = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(first.status).toBe(200);
    expect(first.body.tools).toHaveLength(3);
    expect(first.body.tools.map((t: { name: string }) => t.name)).toEqual([
      'Sonidos para dormir',
      'NSDR · Descanso profundo sin dormir',
      'Diario de descarga mental',
    ]);

    const second = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(second.status).toBe(200);
    expect(second.body.tools).toHaveLength(3);
  });

  it('any authenticated client can read GET /rest-tools (no ownerOrAdmin/permission gate)', async () => {
    const res = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /rest-tools only returns active tools, ordered by sortOrder', async () => {
    await db.insert(restTools).values([
      { name: 'Inactiva', action: 'play', active: false, sortOrder: 0 },
      { name: 'Segunda', action: 'play', active: true, sortOrder: 2 },
      { name: 'Primera', action: 'play', active: true, sortOrder: 1 },
    ]);
    const res = await request(app).get('/api/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tools.map((t: { name: string }) => t.name)).toEqual(['Primera', 'Segunda']);
  });

  it('GET /admin/rest-tools returns all tools including inactive ones', async () => {
    await db.insert(restTools).values([
      { name: 'Activa', action: 'play', active: true, sortOrder: 0 },
      { name: 'Inactiva', action: 'play', active: false, sortOrder: 1 },
    ]);
    const res = await request(app).get('/api/admin/rest-tools').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(2);
  });

  it('rejects a client on every /admin/rest-tools route', async () => {
    const getRes = await request(app).get('/api/admin/rest-tools').set('Authorization', `Bearer ${clientToken}`);
    expect(getRes.status).toBe(403);
    const postRes = await request(app)
      .post('/api/admin/rest-tools')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ name: 'x', action: 'write' });
    expect(postRes.status).toBe(403);
  });

  it('creates, updates, and deletes a tool', async () => {
    const createRes = await request(app)
      .post('/api/admin/rest-tools')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Respiración 4-7-8', meta: 'Técnica de respiración', action: 'play', minutes: 5, seconds: 30 });
    expect(createRes.status).toBe(201);
    const toolId = createRes.body.tool.id;
    expect(createRes.body.tool.minutes).toBe(5);
    expect(createRes.body.tool.seconds).toBe(30);

    const updateRes = await request(app)
      .put(`/api/admin/rest-tools/${toolId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Respiración 4-7-8 (actualizada)', active: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tool.name).toBe('Respiración 4-7-8 (actualizada)');
    expect(updateRes.body.tool.active).toBe(false);

    const deleteRes = await request(app).delete(`/api/admin/rest-tools/${toolId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    const listRes = await request(app).get('/api/admin/rest-tools').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.tools.some((t: { id: string }) => t.id === toolId)).toBe(false);
  });

  it('PUT with audioUrl: null clears the audio fields and calls deleteFile with the existing audio URL', async () => {
    const deleteSpy = vi.spyOn(storageModule, 'deleteFile').mockResolvedValue(undefined);
    const [tool] = await db
      .insert(restTools)
      .values({ name: 'Con audio', action: 'play', audioUrl: 'https://x.supabase.co/storage/v1/object/public/latribu-files/rest-tools/abc/song.mp3', audioName: 'song.mp3' })
      .returning();

    const updateRes = await request(app)
      .put(`/api/admin/rest-tools/${tool.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ audioUrl: null, audioName: null });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tool.audioUrl).toBeNull();
    expect(updateRes.body.tool.audioName).toBeNull();
    expect(deleteSpy).toHaveBeenCalledWith(tool.audioUrl);
  });

  it('deleting a tool with audio does not throw even if the file is already gone, and calls deleteFile with the audio URL', async () => {
    const deleteSpy = vi.spyOn(storageModule, 'deleteFile').mockResolvedValue(undefined);
    const [tool] = await db
      .insert(restTools)
      .values({ name: 'Con audio a borrar', action: 'play', audioUrl: 'https://x.supabase.co/storage/v1/object/public/latribu-files/rest-tools/xyz/gone.mp3', audioName: 'gone.mp3' })
      .returning();
    const res = await request(app).delete(`/api/admin/rest-tools/${tool.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith(tool.audioUrl);
  });

  describe('POST /admin/rest-tools/:id/upload-audio', () => {
    it('rejects a client', async () => {
      const [tool] = await db.insert(restTools).values({ name: 'Para audio', action: 'play' }).returning();
      const res = await request(app)
        .post(`/api/admin/rest-tools/${tool.id}/upload-audio`)
        .set('Authorization', `Bearer ${clientToken}`)
        .attach('audio', Buffer.from('fake-audio-bytes'), 'clip.mp3');
      expect(res.status).toBe(403);
    });

    it('rejects a request with no file attached', async () => {
      const [tool] = await db.insert(restTools).values({ name: 'Para audio', action: 'play' }).returning();
      const res = await request(app).post(`/api/admin/rest-tools/${tool.id}/upload-audio`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('uploads audio and updates audioUrl/audioName', async () => {
      const [tool] = await db.insert(restTools).values({ name: 'Para audio', action: 'play' }).returning();
      const res = await request(app)
        .post(`/api/admin/rest-tools/${tool.id}/upload-audio`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('audio', Buffer.from('fake-audio-bytes'), 'clip.mp3');
      expect(res.status).toBe(200);
      expect(res.body.tool.audioUrl).toEqual(expect.stringContaining('http'));
      expect(res.body.tool.audioName).toBe('clip.mp3');
    });

    it('returns 404 when the rest tool does not exist', async () => {
      const res = await request(app)
        .post('/api/admin/rest-tools/00000000-0000-0000-0000-000000000000/upload-audio')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('audio', Buffer.from('fake-audio-bytes'), 'clip.mp3');
      expect(res.status).toBe(404);
    });

    it('replaces an existing audio file: deletes the old file via storage and stores the new one', async () => {
      const oldAudioUrl = 'https://x.supabase.co/storage/v1/object/public/latribu-files/rest-tools/old-id/old-clip.mp3';
      const [tool] = await db
        .insert(restTools)
        .values({ name: 'Con audio previo', action: 'play', audioUrl: oldAudioUrl, audioName: 'old-clip.mp3' })
        .returning();
      const deleteSpy = vi.spyOn(storageModule, 'deleteFile').mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/admin/rest-tools/${tool.id}/upload-audio`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('audio', Buffer.from('fake-audio-bytes-2'), 'new-clip.mp3');

      expect(res.status).toBe(200);
      expect(res.body.tool.audioName).toBe('new-clip.mp3');
      expect(res.body.tool.audioUrl).toEqual(expect.stringContaining('http'));
      expect(res.body.tool.audioUrl).not.toBe(oldAudioUrl);
      expect(deleteSpy).toHaveBeenCalledWith(oldAudioUrl);
    });
  });
});
