import { getSessionToken, PermissionDeniedError } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) {
    const errorBody = await res.json().catch(() => ({}));
    throw new PermissionDeniedError(errorBody.error || 'No tienes acceso a este módulo.');
  }
  return res.json();
}

export type CheckinsStatus = {
  dailyDoneToday: boolean;
  weeklyDueThisWeek: boolean;
  periodConfirmationDue: boolean;
  lastResponseAt: string | null;
  dailyStreakDays: number;
  weeklyStreakWeeks: number;
  weeklyRitualWindowOpen: boolean;
};

export type WeeklyReflectionInput = {
  estresCronico: number;
  tecnicasManejoUsadas?: string;
  despertaresNocturnosSemana?: 'Ninguno' | '1-2' | '3+';
};

export type DailyCheckinRecord = {
  id: string;
  fecha: string;
  pulsoAnimo: number;
  createdAt: string;
} | null;

export type WeeklyReflectionRecord = {
  id: string;
  semanaInicio: string;
  estresCronico: number;
  tecnicasManejoUsadas: string | null;
  despertaresNocturnosSemana: string | null;
  createdAt: string;
} | null;

export async function getCheckinsStatus(clientId: string): Promise<CheckinsStatus> {
  const body = await authorizedRequest<{ success: boolean } & CheckinsStatus>(`/api/clients/${clientId}/checkins-status`, 'GET');
  return body;
}

export async function getTodayCheckin(clientId: string): Promise<DailyCheckinRecord> {
  const body = await authorizedRequest<{ success: boolean; checkin: DailyCheckinRecord }>(`/api/clients/${clientId}/daily-checkin/today`, 'GET');
  return body.checkin;
}

export async function postDailyCheckin(clientId: string, pulsoAnimo: number): Promise<void> {
  await authorizedRequest(`/api/clients/${clientId}/daily-checkin`, 'POST', { pulsoAnimo });
}

export async function getCurrentWeekReflection(clientId: string): Promise<WeeklyReflectionRecord> {
  const body = await authorizedRequest<{ success: boolean; reflection: WeeklyReflectionRecord }>(`/api/clients/${clientId}/weekly-reflection/current`, 'GET');
  return body.reflection;
}

export async function postWeeklyReflection(clientId: string, input: WeeklyReflectionInput): Promise<void> {
  await authorizedRequest(`/api/clients/${clientId}/weekly-reflection`, 'POST', input);
}
