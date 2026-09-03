import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { restTools, type RestTool } from '../models/schema.js';
import { deleteFile, uploadFile } from '../storage/index.js';

const DEFAULT_REST_TOOLS = [
  { name: 'Sonidos para dormir', meta: 'Ruido blanco + respiración guiada · 20 min', action: 'play', minutes: 20, seconds: null },
  { name: 'NSDR · Descanso profundo sin dormir', meta: '10 min · para siestas o resets a media tarde', action: 'play', minutes: 10, seconds: null },
  { name: 'Diario de descarga mental', meta: 'Escribe lo que ronda tu cabeza antes de apagar la luz', action: 'write', minutes: null, seconds: null },
];

async function seedIfEmpty(): Promise<void> {
  const existing = await db.select().from(restTools).limit(1);
  if (existing.length > 0) return;
  await Promise.all(DEFAULT_REST_TOOLS.map((t, i) => db.insert(restTools).values({ ...t, sortOrder: i })));
}

export async function listActiveForClient(): Promise<RestTool[]> {
  await seedIfEmpty();
  return db.select().from(restTools).where(eq(restTools.active, true)).orderBy(asc(restTools.sortOrder));
}

export async function listAllForAdmin(): Promise<RestTool[]> {
  await seedIfEmpty();
  return db.select().from(restTools).orderBy(asc(restTools.sortOrder));
}

export async function createTool(input: {
  name: string;
  meta?: string | null;
  action: string;
  minutes?: number | null;
  seconds?: number | null;
}): Promise<RestTool> {
  const [created] = await db.insert(restTools).values(input).returning();
  return created;
}

export async function updateTool(
  id: string,
  patch: Partial<{
    name: string;
    meta: string | null;
    action: string;
    minutes: number | null;
    seconds: number | null;
    active: boolean;
    audioUrl: string | null;
    audioName: string | null;
  }>
): Promise<RestTool | null> {
  if (patch.audioUrl === null) {
    const [existing] = await db.select().from(restTools).where(eq(restTools.id, id)).limit(1);
    if (existing) await deleteFile(existing.audioUrl);
  }
  const [updated] = await db
    .update(restTools)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(restTools.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteTool(id: string): Promise<void> {
  const [existing] = await db.select().from(restTools).where(eq(restTools.id, id)).limit(1);
  await db.delete(restTools).where(eq(restTools.id, id));
  if (existing) await deleteFile(existing.audioUrl);
}

export async function uploadAudio(
  id: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<RestTool | null> {
  const [existing] = await db.select().from(restTools).where(eq(restTools.id, id)).limit(1);
  if (!existing) return null;
  const audioUrl = await uploadFile(`rest-tools/${id}`, file.buffer, file.mimetype, file.originalname);
  const [updated] = await db
    .update(restTools)
    .set({ audioUrl, audioName: file.originalname, updatedAt: new Date() })
    .where(eq(restTools.id, id))
    .returning();
  if (existing.audioUrl) await deleteFile(existing.audioUrl);
  return updated;
}
