import { eq, and, asc, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cortisolCompletions, cortisolCheckins, type CortisolCompletion, type CortisolCheckin } from '../models/schema.js';
import type { CortisolCheckinInput, CortisolCompletionInput } from '@latribu/shared-types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listCompletions(clientId: string): Promise<CortisolCompletion[]> {
  return db.select().from(cortisolCompletions).where(eq(cortisolCompletions.clientId, clientId)).orderBy(desc(cortisolCompletions.completedDate));
}

export async function markCompletion(
  clientId: string,
  input: CortisolCompletionInput
): Promise<{ completion: CortisolCompletion; created: boolean }> {
  const date = today();
  const existing = await db
    .select()
    .from(cortisolCompletions)
    .where(and(eq(cortisolCompletions.clientId, clientId), eq(cortisolCompletions.completedDate, date)));
  if (existing[0]) return { completion: existing[0], created: false };

  const [completion] = await db
    .insert(cortisolCompletions)
    .values({ clientId, techniqueId: input.technique_id ?? null, completedDate: date })
    .returning();
  return { completion, created: true };
}

export async function getTodayCheckin(clientId: string): Promise<CortisolCheckin | null> {
  const date = today();
  const rows = await db
    .select()
    .from(cortisolCheckins)
    .where(and(eq(cortisolCheckins.clientId, clientId), eq(cortisolCheckins.checkinDate, date)));
  return rows[0] ?? null;
}

export async function listCheckins(clientId: string): Promise<CortisolCheckin[]> {
  return db.select().from(cortisolCheckins).where(eq(cortisolCheckins.clientId, clientId)).orderBy(asc(cortisolCheckins.checkinDate));
}

export async function upsertCheckin(clientId: string, input: CortisolCheckinInput): Promise<CortisolCheckin> {
  const existing = await getTodayCheckin(clientId);
  if (existing) {
    const [updated] = await db
      .update(cortisolCheckins)
      .set({ emotion: input.emotion })
      .where(eq(cortisolCheckins.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(cortisolCheckins)
    .values({ clientId, emotion: input.emotion, checkinDate: today() })
    .returning();
  return created;
}
