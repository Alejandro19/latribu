import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type ExerciseCategory = 'warmup' | 'strength' | 'core' | 'cardio' | 'stretching';

export type Exercise = {
  id: string;
  clientId: string;
  title: string;
  dayNumber: number;
  category: ExerciseCategory;
  series: number | null;
  reps: string | null;
  duration: string | null;
  restTime: string | null;
  youtubeUrl: string | null;
  description: string | null;
  recommendations: string | null;
  sortOrder: number;
};

export type ExerciseInput = {
  title: string;
  day_number: number;
  category: ExerciseCategory;
  series?: number | null;
  reps?: string | null;
  duration?: string | null;
  rest_time?: string | null;
  youtube_url?: string | null;
  description?: string | null;
  recommendations?: string | null;
};

export async function getClientTrainingDays(clientId: string): Promise<number> {
  const body = await authorizedRequest<{ success: boolean; client: { trainingDays: number | null }; error?: string }>(
    `/api/clients/${clientId}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener el cliente.');
  return body.client.trainingDays || 0;
}

export async function getClientName(clientId: string): Promise<string> {
  const body = await authorizedRequest<{ success: boolean; client: { name: string }; error?: string }>(
    `/api/clients/${clientId}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener el cliente.');
  return body.client.name;
}

export async function listExercises(clientId: string): Promise<Exercise[]> {
  const body = await authorizedRequest<{ success: boolean; exercises: Exercise[]; error?: string }>(
    `/api/clients/${clientId}/exercises`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener los ejercicios.');
  return body.exercises;
}

export async function createExercise(clientId: string, input: ExerciseInput): Promise<Exercise> {
  const body = await authorizedRequest<{ success: boolean; exercise: Exercise; error?: string }>(
    `/api/clients/${clientId}/exercises`,
    'POST',
    input
  );
  if (!body.success) throw new Error(body.error || 'Error al crear el ejercicio.');
  return body.exercise;
}

export async function updateExercise(clientId: string, exerciseId: string, input: ExerciseInput): Promise<Exercise> {
  const body = await authorizedRequest<{ success: boolean; exercise: Exercise; error?: string }>(
    `/api/clients/${clientId}/exercises/${exerciseId}`,
    'PUT',
    input
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar el ejercicio.');
  return body.exercise;
}

export async function deleteExercise(clientId: string, exerciseId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/exercises/${exerciseId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el ejercicio.');
}

export async function reorderExercise(clientId: string, exerciseId: string, direction: 'up' | 'down'): Promise<Exercise[]> {
  const body = await authorizedRequest<{ success: boolean; exercises: Exercise[]; error?: string }>(
    `/api/clients/${clientId}/exercises/${exerciseId}/order`,
    'PATCH',
    { direction }
  );
  if (!body.success) throw new Error(body.error || 'Error al reordenar el ejercicio.');
  return body.exercises;
}

export async function updateTrainingDays(clientId: string, trainingDays: number): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/training-days`, 'PATCH', {
    training_days: trainingDays,
  });
  if (!body.success) throw new Error(body.error || 'Error al actualizar los días de entrenamiento.');
}

export type TrainingCompletion = {
  id: string;
  clientId: string;
  dayNumber: number;
  completedDate: string;
  source: 'manual' | 'nfc';
};

export async function listTrainingCompletions(clientId: string): Promise<TrainingCompletion[]> {
  const body = await authorizedRequest<{ success: boolean; completions: TrainingCompletion[]; error?: string }>(
    `/api/clients/${clientId}/training-completions`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener el historial de entrenamiento.');
  return body.completions;
}

export type TrainingStreak = {
  streakWeeks: number;
  sessionsDoneThisWeek: number;
  sessionsRequiredThisWeek: number;
  protectorAvailable: boolean;
  protectorUsedThisWeek: boolean;
  atRisk: boolean;
};

export async function getStreak(clientId: string, tz: string): Promise<TrainingStreak> {
  const body = await authorizedRequest<{ success: boolean; streak: TrainingStreak; error?: string }>(
    `/api/clients/${clientId}/training/streak?tz=${encodeURIComponent(tz)}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener la racha.');
  return body.streak;
}

export async function useProtector(clientId: string, tz: string): Promise<TrainingStreak> {
  const body = await authorizedRequest<{ success: boolean; streak: TrainingStreak; error?: string }>(
    `/api/clients/${clientId}/training/use-protector`,
    'POST',
    { tz }
  );
  if (!body.success) throw new Error(body.error || 'Error al usar el protector.');
  return body.streak;
}

export type Achievement = {
  id: string;
  clientId: string;
  type: 'medalla' | 'copa';
  weekNumber: number;
  earnedAt: string;
};

export async function getAchievements(clientId: string): Promise<Achievement[]> {
  const body = await authorizedRequest<{ success: boolean; achievements: Achievement[]; error?: string }>(
    `/api/clients/${clientId}/training/achievements`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener los logros.');
  return body.achievements;
}

export async function confirmSession(
  clientId: string,
  tz: string,
  source: 'manual' | 'nfc' = 'manual'
): Promise<{ alreadyConfirmedToday: boolean; dayNumber: number | null; streak: TrainingStreak; phrase: string | null }> {
  const body = await authorizedRequest<{
    success: boolean;
    alreadyConfirmedToday: boolean;
    dayNumber: number | null;
    streak: TrainingStreak;
    phrase: string | null;
    error?: string;
  }>(`/api/clients/${clientId}/training/confirm-session`, 'POST', { tz, source });
  if (!body.success) throw new Error(body.error || 'Error al confirmar la sesión.');
  return { alreadyConfirmedToday: body.alreadyConfirmedToday, dayNumber: body.dayNumber, streak: body.streak, phrase: body.phrase };
}

export async function getPhraseByContext(clientId: string, context: 'confirmacion' | 'instagram'): Promise<string | null> {
  const body = await authorizedRequest<{ success: boolean; phrase: string | null; error?: string }>(
    `/api/clients/${clientId}/training/phrase?context=${context}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener la frase.');
  return body.phrase;
}
