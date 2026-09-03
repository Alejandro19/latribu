import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cortisolTips, type CortisolTip } from '../models/schema.js';
import type { CortisolTipUpdate } from '@latribu/shared-types';

export async function listTips(): Promise<CortisolTip[]> {
  return db.select().from(cortisolTips).orderBy(desc(cortisolTips.createdAt));
}

export async function createTip(content: string): Promise<CortisolTip> {
  const [tip] = await db.insert(cortisolTips).values({ content }).returning();
  return tip;
}

export async function updateTip(id: string, patch: CortisolTipUpdate): Promise<CortisolTip | null> {
  const [tip] = await db.update(cortisolTips).set(patch).where(eq(cortisolTips.id, id)).returning();
  return tip ?? null;
}

export async function deleteTip(id: string): Promise<void> {
  await db.delete(cortisolTips).where(eq(cortisolTips.id, id));
}

export async function getTipOfTheDay(): Promise<CortisolTip | null> {
  const pool = await db.select().from(cortisolTips).where(eq(cortisolTips.active, true));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
