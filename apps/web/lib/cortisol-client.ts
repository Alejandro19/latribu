import { getSessionToken, PermissionDeniedError } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) {
    const errorBody = await res.json().catch(() => ({}));
    throw new PermissionDeniedError(errorBody.error || 'No tienes acceso a este módulo.');
  }
  return res.json();
}

export type CortisolTechnique = {
  id: string;
  title: string;
  type: string | null;
  duration: string | null;
  durationMinutes: number | null;
  durationSeconds: number | null;
  description: string | null;
  videoUrl: string | null;
  videoName: string | null;
  youtubeUrl: string | null;
  audioUrl: string | null;
  audioName: string | null;
  emotion: string | null;
  precautionNote: string | null;
  isRitual: boolean;
};

export type CortisolTip = { id: string; content: string } | null;
export type CortisolCheckin = { id: string; emotion: string; checkinDate: string } | null;
export type CortisolCheckinRecord = { id: string; emotion: string; checkinDate: string };
export type CortisolCompletion = { id: string; techniqueId: string | null; completedDate: string };

export type CortisolTechniquePatch = {
  title?: string;
  type?: string;
  duration?: string | null;
  duration_minutes?: number | null;
  duration_seconds?: number | null;
  description?: string;
  youtube_url?: string;
  audio_url?: null;
  audio_name?: null;
  emotion?: string | null;
  precaution_note?: string | null;
  is_ritual?: boolean;
};

export async function listTechniques(clientId: string): Promise<CortisolTechnique[]> {
  const body = await authorizedRequest<{ success: boolean; techniques: CortisolTechnique[]; error?: string }>(`/api/clients/${clientId}/cortisol-techniques`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener técnicas.');
  return body.techniques;
}

export async function listCheckins(clientId: string): Promise<CortisolCheckinRecord[]> {
  const body = await authorizedRequest<{ success: boolean; checkins: CortisolCheckinRecord[]; error?: string }>(`/api/clients/${clientId}/cortisol-checkins`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el historial de emociones.');
  return body.checkins;
}

export async function listCompletions(clientId: string): Promise<CortisolCompletion[]> {
  const body = await authorizedRequest<{ success: boolean; completions: CortisolCompletion[]; error?: string }>(`/api/clients/${clientId}/cortisol-completions`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el historial.');
  return body.completions;
}

export async function createTechnique(clientId: string, input: CortisolTechniquePatch): Promise<CortisolTechnique> {
  const body = await authorizedRequest<{ success: boolean; technique: CortisolTechnique; error?: string }>(`/api/clients/${clientId}/cortisol-techniques`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al asignar la técnica.');
  return body.technique;
}

export async function updateTechnique(clientId: string, techId: string, patch: CortisolTechniquePatch): Promise<CortisolTechnique> {
  const body = await authorizedRequest<{ success: boolean; technique: CortisolTechnique; error?: string }>(`/api/clients/${clientId}/cortisol-techniques/${techId}`, 'PUT', patch);
  if (!body.success) throw new Error(body.error || 'Error al actualizar la técnica.');
  return body.technique;
}

export async function deleteTechnique(clientId: string, techId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/cortisol-techniques/${techId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la técnica.');
}

export async function uploadTechniqueVideo(clientId: string, techId: string, file: File): Promise<CortisolTechnique> {
  const formData = new FormData();
  formData.append('video', file);
  const body = await authorizedRequest<{ success: boolean; technique: CortisolTechnique; error?: string }>(`/api/clients/${clientId}/cortisol-techniques/${techId}/upload`, 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir el video.');
  return body.technique;
}

export async function uploadTechniqueAudio(clientId: string, techId: string, file: File): Promise<CortisolTechnique> {
  const formData = new FormData();
  formData.append('audio', file);
  const body = await authorizedRequest<{ success: boolean; technique: CortisolTechnique; error?: string }>(`/api/clients/${clientId}/cortisol-techniques/${techId}/upload-audio`, 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir el audio.');
  return body.technique;
}

export async function getTipOfTheDay(clientId: string): Promise<CortisolTip> {
  const body = await authorizedRequest<{ success: boolean; tip: CortisolTip; error?: string }>(`/api/clients/${clientId}/cortisol-tip-of-the-day`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el tip del día.');
  return body.tip;
}

export async function markCompletion(clientId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/cortisol-completions`, 'POST', {});
  if (!body.success) throw new Error(body.error || 'Error al marcar como completado.');
}

export async function getTodayCheckin(clientId: string): Promise<CortisolCheckin> {
  const body = await authorizedRequest<{ success: boolean; checkin: CortisolCheckin; error?: string }>(`/api/clients/${clientId}/cortisol-checkin`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el check-in.');
  return body.checkin;
}

export async function postCheckin(clientId: string, emotion: string): Promise<CortisolCheckin> {
  const body = await authorizedRequest<{ success: boolean; checkin: CortisolCheckin; error?: string }>(`/api/clients/${clientId}/cortisol-checkin`, 'POST', { emotion });
  if (!body.success) throw new Error(body.error || 'Error al guardar el check-in.');
  return body.checkin;
}

// Check-in matutino de autorreporte (reemplaza la fuente inexistente de
// "Cortisol AM") — energía/tensión/claridad 1-5, una vez por día.
export type MorningCheckin = {
  id: string;
  fecha: string;
  energia: number;
  tension: number;
  claridad: number;
  activacionMatutina: number;
} | null;

export async function getTodayMorningCheckin(clientId: string): Promise<MorningCheckin> {
  const body = await authorizedRequest<{ success: boolean; checkin: MorningCheckin; error?: string }>(`/api/clients/${clientId}/morning-checkin/today`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el check-in matutino.');
  return body.checkin;
}

export async function postMorningCheckin(clientId: string, input: { energia: number; tension: number; claridad: number }): Promise<MorningCheckin> {
  const body = await authorizedRequest<{ success: boolean; checkin: MorningCheckin; error?: string }>(`/api/clients/${clientId}/morning-checkin`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar el check-in matutino.');
  return body.checkin;
}

// Carga Cognitiva diaria — puntaje de hoy (si ya corrió el job nocturno),
// tendencia de 14 días, umbral sostenible personalizado y racha/alerta.
export type CognitiveLoadOverview = {
  today: number | null;
  trend: Array<{ fecha: string; score: number }>;
  threshold: number | null;
  consecutiveDaysOverThreshold: number;
  alert: boolean;
  alertStreakThreshold: number;
  latest: { hrv: number | null; activacionMatutina: number | null; recuperacionPct: number | null };
};

export async function getCognitiveLoadOverview(clientId: string): Promise<CognitiveLoadOverview> {
  const body = await authorizedRequest<CognitiveLoadOverview & { success: boolean; error?: string }>(`/api/clients/${clientId}/cognitive-load`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener la carga cognitiva.');
  const { success: _success, error: _error, ...overview } = body;
  return overview;
}
