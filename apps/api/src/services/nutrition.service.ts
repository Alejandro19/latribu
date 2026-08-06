import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { nutritionPlans, meals, clients, clientNotifications, type NutritionPlan, type Meal } from '../models/schema.js';
import type { NutritionPlanUpdate, MealInput, MealUpdateInput } from '@latribu/shared-types';

async function unlockModule(clientId: string, moduleKey: string): Promise<void> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client) return;
  const permissions = (client.permissions as Record<string, boolean>) || {};
  if (permissions[moduleKey] === true) return;
  await db.update(clients).set({ permissions: { ...permissions, [moduleKey]: true } }).where(eq(clients.id, clientId));
  await db.insert(clientNotifications).values({ clientId, message: 'Ahora tienes acceso a tu módulo de nutrición.' });
}

export async function getPlanAndMeals(clientId: string): Promise<{ plan: NutritionPlan | Record<string, never>; meals: Meal[] }> {
  const [planRows, mealRows] = await Promise.all([
    db.select().from(nutritionPlans).where(eq(nutritionPlans.clientId, clientId)).limit(1),
    db.select().from(meals).where(eq(meals.clientId, clientId)).orderBy(asc(meals.sortOrder)),
  ]);
  return { plan: planRows[0] || {}, meals: mealRows };
}

export async function upsertPlan(clientId: string, patch: NutritionPlanUpdate): Promise<NutritionPlan> {
  const fields: Record<string, unknown> = {};
  if (patch.daily_cals !== undefined) fields.dailyCals = patch.daily_cals;
  if (patch.protein_g !== undefined) fields.proteinG = patch.protein_g;
  if (patch.carbs_g !== undefined) fields.carbsG = patch.carbs_g;
  if (patch.fat_g !== undefined) fields.fatG = patch.fat_g;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  if (patch.client_observations !== undefined) fields.clientObservations = patch.client_observations;
  if (patch.summary !== undefined) fields.summary = patch.summary;
  if (patch.menu_plan !== undefined) fields.menuPlan = patch.menu_plan;
  if (patch.recommendations !== undefined) fields.recommendations = patch.recommendations;
  if (patch.closing_message !== undefined) fields.closingMessage = patch.closing_message;

  const [plan] = await db
    .insert(nutritionPlans)
    .values({ clientId, ...fields })
    .onConflictDoUpdate({ target: nutritionPlans.clientId, set: { ...fields, updatedAt: new Date() } })
    .returning();

  await unlockModule(clientId, 'nutrition');
  return plan;
}

export async function attachPdf(clientId: string, pdfUrl: string, pdfName: string): Promise<NutritionPlan> {
  const [plan] = await db
    .insert(nutritionPlans)
    .values({ clientId, pdfUrl, pdfName })
    .onConflictDoUpdate({ target: nutritionPlans.clientId, set: { pdfUrl, pdfName, updatedAt: new Date() } })
    .returning();
  return plan;
}

// MealInputSchema exposes snake_case keys (meal_time, protein_g, carbs_g, fat_g)
// but the `meals` table's Drizzle columns are camelCase (mealTime, proteinG,
// carbsG, fatG) — spread the raw input directly into insert/update would
// leave the required `mealTime` column unset. Map explicitly, same pattern
// as `toExerciseFields` in exercises.service.ts.
function toMealFields(input: MealInput) {
  return {
    mealTime: input.meal_time,
    name: input.name,
    calories: input.calories,
    proteinG: input.protein_g,
    carbsG: input.carbs_g,
    fatG: input.fat_g,
    tags: input.tags,
  };
}

// Only include keys the caller actually sent — a PUT to /meals/:id is a
// partial edit, not a full replace, so fields the admin didn't touch must
// not be overwritten (e.g. macros must not be zeroed by an update that only
// changes the meal name).
function toMealUpdateFields(input: MealUpdateInput) {
  const fields: Record<string, unknown> = {};
  if (input.meal_time !== undefined) fields.mealTime = input.meal_time;
  if (input.name !== undefined) fields.name = input.name;
  if (input.calories !== undefined) fields.calories = input.calories;
  if (input.protein_g !== undefined) fields.proteinG = input.protein_g;
  if (input.carbs_g !== undefined) fields.carbsG = input.carbs_g;
  if (input.fat_g !== undefined) fields.fatG = input.fat_g;
  if (input.tags !== undefined) fields.tags = input.tags;
  return fields;
}

export async function createMeal(clientId: string, input: MealInput): Promise<Meal> {
  const [meal] = await db.insert(meals).values({ clientId, ...toMealFields(input) }).returning();
  await unlockModule(clientId, 'nutrition');
  return meal;
}

export async function updateMeal(clientId: string, mealId: string, input: MealUpdateInput): Promise<Meal | null> {
  const [meal] = await db
    .update(meals)
    .set(toMealUpdateFields(input))
    .where(and(eq(meals.id, mealId), eq(meals.clientId, clientId)))
    .returning();
  return meal ?? null;
}

export async function deleteMeal(clientId: string, mealId: string): Promise<void> {
  await db.delete(meals).where(and(eq(meals.id, mealId), eq(meals.clientId, clientId)));
}
