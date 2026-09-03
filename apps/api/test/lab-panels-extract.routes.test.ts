import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, labPanels } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';
import { setVisionCallerForTests } from '../src/services/ocr.service.js';
import { setAiExtractorForTests } from '../src/services/lab-ai-extraction.service.js';

// PDF con texto real embebido (pdf-parse lo extrae sin necesitar
// GOOGLE_VISION_API_KEY) — mismo fixture que ocr.routes.test.ts.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePdfBuffer = fs.readFileSync(path.join(__dirname, 'fixtures/sample.pdf'));

describe('POST /clients/:id/lab-panels/extract (OCR + IA)', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Extract Client', email: `lab-extract-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(labPanels).where(eq(labPanels.clientId, clientId));
    setVisionCallerForTests(null);
    setAiExtractorForTests(null);
  });

  beforeEach(() => {
    setAiExtractorForTests(async () => [
      { marker_id: 'cortisol', value: 15, detected: true },
      { marker_id: 'glucosa', value: 90, detected: true },
    ]);
  });

  it('runs OCR + AI extraction and returns the structured grid without saving anything yet', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/lab-panels/extract`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('semana', '0')
      .attach('file', samplePdfBuffer, { filename: 'lab.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body.reused).toBe(false);
    expect(res.body.fileUrl).toMatch(/^https:\/\//);
    const cortisol = res.body.markers.find((m: { marker_id: string }) => m.marker_id === 'cortisol');
    expect(cortisol).toEqual({ marker_id: 'cortisol', value: 15, unit: 'ug/dL', detected: true });

    const [row] = await db.select().from(labPanels).where(eq(labPanels.clientId, clientId));
    expect(row).toBeUndefined();
  });

  it('rejects an invalid semana', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/lab-panels/extract`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('semana', '3')
      .attach('file', samplePdfBuffer, { filename: 'lab.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('reuses the previous extraction (never calls the AI again) when the exact same file is re-uploaded', async () => {
    const fileBuffer = samplePdfBuffer;
    const firstUpload = await request(app)
      .post(`/api/clients/${clientId}/lab-panels/extract`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('semana', '0')
      .attach('file', fileBuffer, { filename: 'lab.pdf', contentType: 'application/pdf' });

    await request(app)
      .put(`/api/clients/${clientId}/lab-panels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        semana: 0,
        fecha: '2026-08-01',
        datos: { cortisol: 15, glucosa: 90 },
        fileUrl: firstUpload.body.fileUrl,
        fileName: firstUpload.body.fileName,
        sourceFileHash: firstUpload.body.sourceFileHash,
      });

    // Un segundo intento de extracción con el MISMO archivo no debe volver a
    // llamar a OCR/IA — se detecta por el hash y se reusa lo ya guardado.
    setVisionCallerForTests(async () => {
      throw new Error('no debería llamarse a OCR de nuevo');
    });
    setAiExtractorForTests(async () => {
      throw new Error('no debería llamarse a la IA de nuevo');
    });

    const secondUpload = await request(app)
      .post(`/api/clients/${clientId}/lab-panels/extract`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('semana', '0')
      .attach('file', fileBuffer, { filename: 'lab.pdf', contentType: 'application/pdf' });

    expect(secondUpload.status).toBe(200);
    expect(secondUpload.body.reused).toBe(true);
    expect(secondUpload.body.sourceFileHash).toBe(firstUpload.body.sourceFileHash);
  });
});
