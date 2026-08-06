import type { Exercise, ExerciseCategory } from './training-client';

// Orden de una sesión típica: calentar, la fuerza principal, accesorio de
// core, el finisher de cardio, y estiramiento como cierre — cada categoría
// se desbloquea al completar la anterior (ver getCategoryLockState).
export const CATEGORY_ORDER: ExerciseCategory[] = ['warmup', 'strength', 'core', 'cardio', 'stretching'];

export type CategoryLockState = 'no_asignada' | 'locked' | 'active' | 'done';

export function getCategoryLockState(
  category: ExerciseCategory,
  dayExercises: Exercise[],
  completedIds: Set<string>
): CategoryLockState {
  const categoryExercises = dayExercises.filter((ex) => ex.category === category);
  if (categoryExercises.length === 0) return 'no_asignada';

  const allDone = categoryExercises.every((ex) => completedIds.has(ex.id));
  if (allDone) return 'done';

  const priorCategories = CATEGORY_ORDER.slice(0, CATEGORY_ORDER.indexOf(category)).filter((c) =>
    dayExercises.some((ex) => ex.category === c)
  );
  const priorDone = priorCategories.every((c) => dayExercises.filter((ex) => ex.category === c).every((ex) => completedIds.has(ex.id)));

  return priorDone ? 'active' : 'locked';
}
