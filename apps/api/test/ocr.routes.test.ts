import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import { setVisionCallerForTests } from '../src/services/ocr.service.js';

// Módulos ESM no tienen __dirname — mismo patrón que test/helpers/setupTestEnv.ts.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePdfBase64 = fs.readFileSync(path.join(__dirname, 'fixtures/sample.pdf')).toString('base64');

describe('POST /api/clients/:id/ocr-vision', () => {
  const app = createApp();
  let clientId: string;
  let token: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'OCR Client', email: `ocr-${Date.now()}@example.com`, passwordHash: 'x', clientType: 'coaching_1_1' })
      .returning();
    clientId = client.id;
    token = signToken({ id: clientId, role: 'cliente', name: 'OCR Client', email: client.email });
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  beforeEach(() => {
    setVisionCallerForTests(null);
  });

  it('extracts text from a PDF using pdf-parse, never calling Vision', async () => {
    setVisionCallerForTests(async () => {
      throw new Error('Vision API should not be called when pdf-parse succeeds');
    });
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: samplePdfBase64 });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('pdf-parse');
    expect(res.body.text).toContain('INBODY TEST REPORT');
  });

  it('calls the injected Vision caller for a non-PDF image and returns its text', async () => {
    process.env.GOOGLE_VISION_API_KEY = 'test-key';
    setVisionCallerForTests(async () => 'texto extraído de la imagen');
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: 'aW1hZ2Vub3RhcGRm' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('vision');
    expect(res.body.text).toBe('texto extraído de la imagen');
    delete process.env.GOOGLE_VISION_API_KEY;
  });

  it('returns 501 for a non-PDF image when Vision is not configured', async () => {
    delete process.env.GOOGLE_VISION_API_KEY;
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: 'aW1hZ2Vub3RhcGRm' });
    expect(res.status).toBe(501);
  });

  it('rejects an empty base64 payload', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/ocr-vision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: '' });
    expect(res.status).toBe(400);
  });
});
