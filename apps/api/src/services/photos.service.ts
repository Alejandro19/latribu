import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { progressPhotos, type ProgressPhoto } from '../models/schema.js';
import { uploadFile } from '../storage/index.js';
import { findAnthropometricById } from './anthropometrics.service.js';
import type { PhotoUploadMetadata } from '@latribu/shared-types';

export async function listPhotos(clientId: string): Promise<ProgressPhoto[]> {
  return db.select().from(progressPhotos).where(eq(progressPhotos.clientId, clientId)).orderBy(desc(progressPhotos.fecha));
}

export async function createPhoto(
  clientId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string },
  metadata: PhotoUploadMetadata
): Promise<ProgressPhoto> {
  const photoUrl = await uploadFile(`${clientId}/photos`, file.buffer, file.mimetype, file.originalname);

  let anthropometricRecordId: string | null = metadata.anthropometric_record_id ?? null;
  if (anthropometricRecordId) {
    const record = await findAnthropometricById(anthropometricRecordId);
    if (!record || record.clientId !== clientId) {
      anthropometricRecordId = null;
    }
  }

  const [photo] = await db
    .insert(progressPhotos)
    .values({
      clientId,
      anthropometricRecordId,
      angle: metadata.angle || 'frente',
      photoUrl,
      fecha: metadata.fecha || new Date().toISOString().slice(0, 10),
      mesNum: metadata.mes_num,
    })
    .returning();
  return photo;
}
