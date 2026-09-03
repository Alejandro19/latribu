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

export type SleepProtocol = {
  protocolText: string | null;
  sleepWindow: string | null;
  supplement: string | null;
} | null;

export type SleepLog = {
  id: string;
  date: string;
  hours: string | number;
  quality: number;
  loggedAt: string;
};

export async function getProtocol(clientId: string): Promise<SleepProtocol> {
  const body = await authorizedRequest<{ success: boolean; protocol: SleepProtocol; error?: string }>(`/api/clients/${clientId}/sleep-protocol`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el protocolo de sueño.');
  return body.protocol;
}

export async function saveProtocol(clientId: string, patch: { protocol_text?: string | null; sleep_window?: string | null; supplement?: string | null }): Promise<SleepProtocol> {
  const body = await authorizedRequest<{ success: boolean; protocol: SleepProtocol; error?: string }>(`/api/clients/${clientId}/sleep-protocol`, 'PUT', patch);
  if (!body.success) throw new Error(body.error || 'Error al guardar el protocolo.');
  return body.protocol;
}

export async function getTodayLog(clientId: string): Promise<SleepLog | null> {
  const body = await authorizedRequest<{ success: boolean; log: SleepLog | null; error?: string }>(`/api/clients/${clientId}/sleep-log-today`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el registro de hoy.');
  return body.log;
}

export async function listLogs(clientId: string): Promise<SleepLog[]> {
  const body = await authorizedRequest<{ success: boolean; logs: SleepLog[]; error?: string }>(`/api/clients/${clientId}/sleep-logs`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el historial de sueño.');
  return body.logs;
}

export async function logSleep(clientId: string, input: { hours: number; quality: number }): Promise<SleepLog> {
  const body = await authorizedRequest<{ success: boolean; log: SleepLog; error?: string }>(`/api/clients/${clientId}/sleep-log`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar el registro.');
  return body.log;
}
