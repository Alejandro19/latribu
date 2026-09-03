import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recipes, type Recipe } from '../models/schema.js';
import { deleteFile } from '../storage/index.js';

export async function listAllRecipes(): Promise<Recipe[]> {
  return db.select().from(recipes).orderBy(asc(recipes.sortOrder), asc(recipes.createdAt));
}

export async function listActiveRecipes(): Promise<Recipe[]> {
  return db
    .select()
    .from(recipes)
    .where(eq(recipes.active, true))
    .orderBy(asc(recipes.sortOrder), asc(recipes.createdAt));
}

export async function createRecipe(name: string, category: string | null, pdfUrl: string, pdfName: string): Promise<Recipe> {
  const [recipe] = await db.insert(recipes).values({ name, category, pdfUrl, pdfName }).returning();
  return recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  if (!recipe) return;
  await db.delete(recipes).where(eq(recipes.id, id));
  await deleteFile(recipe.pdfUrl);
}
