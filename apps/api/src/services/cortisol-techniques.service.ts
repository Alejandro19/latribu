import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cortisolTechniques, clients, clientNotifications, type CortisolTechnique } from '../models/schema.js';
import { uploadFile, deleteFile } from '../storage/index.js';
import type { CortisolTechniqueInput } from '@latribu/shared-types';

async function unlockModule(clientId: string): Promise<void> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client) return;
  const permissions = (client.permissions as Record<string, boolean>) || {};
  if (permissions.cortisol === true) return;
  await db.update(clients).set({ permissions: { ...permissions, cortisol: true } }).where(eq(clients.id, clientId));
  await db.insert(clientNotifications).values({ clientId, message: 'Ahora tienes acceso a tu módulo de gestión de cortisol.' });
}

function toTechniqueFields(input: CortisolTechniqueInput) {
  return {
    title: input.title,
    type: input.type ?? null,
    duration: input.duration ?? null,
    durationMinutes: input.duration_minutes ?? null,
    durationSeconds: input.duration_seconds ?? null,
    description: input.description ?? null,
    youtubeUrl: input.youtube_url ?? null,
  };
}

export async function listTechniques(clientId: string): Promise<CortisolTechnique[]> {
  return db.select().from(cortisolTechniques).where(eq(cortisolTechniques.clientId, clientId)).orderBy(asc(cortisolTechniques.sortOrder));
}

export async function createTechnique(clientId: string, input: CortisolTechniqueInput): Promise<CortisolTechnique> {
  const [technique] = await db.insert(cortisolTechniques).values({ clientId, ...toTechniqueFields(input) }).returning();
  await unlockModule(clientId);
  return technique;
}

export async function findTechniqueById(techId: string): Promise<CortisolTechnique | undefined> {
  const rows = await db.select().from(cortisolTechniques).where(eq(cortisolTechniques.id, techId)).limit(1);
  return rows[0];
}

export async function updateTechnique(
  techId: string,
  input: CortisolTechniqueInput & { audio_url?: null }
): Promise<CortisolTechnique | null> {
  const fields: Record<string, unknown> = toTechniqueFields(input);
  if (input.audio_url === null) {
    const existing = await findTechniqueById(techId);
    if (existing?.audioUrl) await deleteFile(existing.audioUrl);
    fields.audioUrl = null;
    fields.audioName = null;
  }
  const [technique] = await db.update(cortisolTechniques).set(fields).where(eq(cortisolTechniques.id, techId)).returning();
  return technique ?? null;
}

export async function deleteTechnique(techId: string): Promise<void> {
  const existing = await findTechniqueById(techId);
  await db.delete(cortisolTechniques).where(eq(cortisolTechniques.id, techId));
  if (existing?.audioUrl) await deleteFile(existing.audioUrl);
}

export async function uploadVideo(
  techId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<CortisolTechnique | null> {
  const existing = await findTechniqueById(techId);
  if (!existing) return null;
  const videoUrl = await uploadFile(`${existing.clientId}/cortisol`, file.buffer, file.mimetype, file.originalname);
  const [technique] = await db
    .update(cortisolTechniques)
    .set({ videoUrl, videoName: file.originalname })
    .where(eq(cortisolTechniques.id, techId))
    .returning();
  return technique;
}

export async function uploadAudio(
  techId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<CortisolTechnique | null> {
  const existing = await findTechniqueById(techId);
  if (!existing) return null;
  const audioUrl = await uploadFile(`${existing.clientId}/cortisol`, file.buffer, file.mimetype, file.originalname);
  const [technique] = await db
    .update(cortisolTechniques)
    .set({ audioUrl, audioName: file.originalname })
    .where(eq(cortisolTechniques.id, techId))
    .returning();
  if (existing.audioUrl) await deleteFile(existing.audioUrl);
  return technique;
}
