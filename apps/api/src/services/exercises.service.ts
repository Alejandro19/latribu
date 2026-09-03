import { and, eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { exercises, clients, clientNotifications, type Exercise } from '../models/schema.js';
import type { ExerciseInput } from '@latribu/shared-types';

export async function listExercisesByClient(clientId: string): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.clientId, clientId))
    .orderBy(asc(exercises.dayNumber), asc(exercises.category), asc(exercises.sortOrder));
}

const MODULE_LABELS: Record<string, string> = {
  training: 'Workout',
  nutrition: 'Nutrition',
  supplementation: 'suplementación',
  cortisol: 'Stress',
};

async function unlockModule(clientId: string, moduleKey: string): Promise<void> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client) return;
  const permissions = (client.permissions as Record<string, boolean>) || {};
  if (permissions[moduleKey] === true) return;
  await db
    .update(clients)
    .set({ permissions: { ...permissions, [moduleKey]: true } })
    .where(eq(clients.id, clientId));
  const label = MODULE_LABELS[moduleKey];
  if (label) {
    await db.insert(clientNotifications).values({ clientId, message: `Ahora tienes acceso a tu módulo de ${label}.` });
  }
}

function toExerciseFields(input: ExerciseInput) {
  return {
    title: input.title,
    dayNumber: input.day_number,
    category: input.category,
    series: input.series ?? null,
    reps: input.reps ?? null,
    duration: input.duration ?? null,
    restTime: input.rest_time ?? null,
    youtubeUrl: input.youtube_url ?? null,
    description: input.description ?? null,
    recommendations: input.recommendations ?? null,
  };
}

export async function createExercise(clientId: string, input: ExerciseInput): Promise<Exercise> {
  const siblings = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.clientId, clientId), eq(exercises.dayNumber, input.day_number), eq(exercises.category, input.category)));
  const nextSortOrder = siblings.reduce((max, ex) => Math.max(max, ex.sortOrder), -1) + 1;

  const [exercise] = await db
    .insert(exercises)
    .values({ clientId, ...toExerciseFields(input), sortOrder: nextSortOrder })
    .returning();

  await unlockModule(clientId, 'training');
  return exercise;
}

export async function updateExercise(exerciseId: string, input: ExerciseInput): Promise<Exercise | null> {
  const current = await findExerciseById(exerciseId);
  if (!current) return null;

  let sortOrder: number | undefined;
  if (input.day_number !== current.dayNumber || input.category !== current.category) {
    // Moving to a different day/category group — recompute sortOrder against
    // the NEW group the same way createExercise does, otherwise the row can
    // collide with (or land outside the range of) its new siblings.
    const newGroupSiblings = await db
      .select()
      .from(exercises)
      .where(and(eq(exercises.clientId, current.clientId), eq(exercises.dayNumber, input.day_number), eq(exercises.category, input.category)));
    sortOrder = newGroupSiblings.reduce((max, ex) => Math.max(max, ex.sortOrder), -1) + 1;
  }

  const [exercise] = await db
    .update(exercises)
    .set({ ...toExerciseFields(input), ...(sortOrder !== undefined ? { sortOrder } : {}), updatedAt: new Date() })
    .where(eq(exercises.id, exerciseId))
    .returning();
  return exercise ?? null;
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  await db.delete(exercises).where(eq(exercises.id, exerciseId));
}

export async function findExerciseById(exerciseId: string): Promise<Exercise | undefined> {
  const rows = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1);
  return rows[0];
}

async function siblingsOf(exercise: Exercise): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .where(and(eq(exercises.clientId, exercise.clientId), eq(exercises.dayNumber, exercise.dayNumber), eq(exercises.category, exercise.category)))
    .orderBy(asc(exercises.sortOrder));
}

// Legacy data (and schema.sql's default) leave sort_order at 0 for every row,
// so swapping two equal sortOrders between siblings is a permanent no-op.
// Before computing a swap, spread any duplicate sortOrders within the group
// into dense 0,1,2... ordinals (tiebroken by id for determinism) so a real
// swap becomes possible.
async function normalizeSortOrder(clientId: string, dayNumber: number, category: string): Promise<Exercise[]> {
  const siblings = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.clientId, clientId), eq(exercises.dayNumber, dayNumber), eq(exercises.category, category)))
    .orderBy(asc(exercises.sortOrder), asc(exercises.id));

  const sortOrders = siblings.map((ex) => ex.sortOrder);
  const hasDuplicates = new Set(sortOrders).size !== sortOrders.length;
  if (!hasDuplicates) return siblings;

  const normalized: Exercise[] = [];
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i].sortOrder !== i) {
      await db.update(exercises).set({ sortOrder: i }).where(eq(exercises.id, siblings[i].id));
      normalized.push({ ...siblings[i], sortOrder: i });
    } else {
      normalized.push(siblings[i]);
    }
  }
  return normalized;
}

export async function reorderExercise(exerciseId: string, direction: 'up' | 'down'): Promise<Exercise[]> {
  const current = await findExerciseById(exerciseId);
  if (!current) return [];
  const siblings = await normalizeSortOrder(current.clientId, current.dayNumber, current.category);

  const index = siblings.findIndex((ex) => ex.id === exerciseId);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= siblings.length) return siblings;

  const normalizedCurrent = siblings[index];
  const neighbor = siblings[neighborIndex];
  await db.update(exercises).set({ sortOrder: neighbor.sortOrder }).where(eq(exercises.id, normalizedCurrent.id));
  await db.update(exercises).set({ sortOrder: normalizedCurrent.sortOrder }).where(eq(exercises.id, neighbor.id));

  return siblingsOf(normalizedCurrent);
}
