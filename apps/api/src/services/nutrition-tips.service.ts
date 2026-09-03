import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { nutritionTips, type NutritionTip } from '../models/schema.js';
import type { NutritionTipUpdate } from '@latribu/shared-types';

export async function listTips(): Promise<NutritionTip[]> {
  return db.select().from(nutritionTips).orderBy(asc(nutritionTips.sortOrder), asc(nutritionTips.createdAt));
}

export async function listActiveTips(): Promise<NutritionTip[]> {
  return db
    .select()
    .from(nutritionTips)
    .where(eq(nutritionTips.active, true))
    .orderBy(asc(nutritionTips.sortOrder), asc(nutritionTips.createdAt));
}

export async function createTip(content: string): Promise<NutritionTip> {
  const [tip] = await db.insert(nutritionTips).values({ content }).returning();
  return tip;
}

export async function updateTip(id: string, patch: NutritionTipUpdate): Promise<NutritionTip | null> {
  const [tip] = await db.update(nutritionTips).set(patch).where(eq(nutritionTips.id, id)).returning();
  return tip ?? null;
}

export async function deleteTip(id: string): Promise<void> {
  await db.delete(nutritionTips).where(eq(nutritionTips.id, id));
}
