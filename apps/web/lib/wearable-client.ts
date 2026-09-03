import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type Dispositivo = 'garmin' | 'whoop' | 'oura' | 'polar';

export type WearableEstado = {
  dispositivo: Dispositivo;
  conectado: boolean;
  conectadoEn: string | null;
  ultimaSync: string | null;
  tokenExpirado: boolean;
};

export async function getWearableEstado(clientId: string): Promise<WearableEstado[]> {
  const body = await authorizedRequest<{ success: boolean; wearables: WearableEstado[]; error?: string }>(`/api/clients/${clientId}/wearable/estado`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el estado de wearables.');
  return body.wearables;
}

// Una fila por día capturada por wearableMetricas (apps/api) — solo lectura,
// nunca se escribe desde el frontend. Los campos numéricos vienen de columnas
// `numeric` de Postgres, que node-postgres puede serializar como string; se
// tratan como `number | string | null` y se normalizan con Number(...) al consumirlos.
export type WearableMetrica = {
  id: string;
  dispositivo: string;
  fecha: string;
  fcReposo: number | null;
  hrvNocturno: number | null;
  suenoTotalMinutos: number | null;
  suenoProfundoMinutos: number | null;
  suenoRemMinutos: number | null;
  suenoLigeroMinutos: number | null;
  suenoDespiertoMinutos: number | null;
  suenoScore: number | null;
  tasaRespiratoria: number | string | null;
  temperaturaPiel: number | string | null;
  horaDormir: string | null;
  horaDespertar: string | null;
};

export async function getMetricas(
  clientId: string,
  dias = 7,
  dispositivo?: Dispositivo
): Promise<{ total: number; promedios: Record<string, number | null>; data: WearableMetrica[] }> {
  const qs = new URLSearchParams({ dias: String(dias), ...(dispositivo ? { dispositivo } : {}) });
  const body = await authorizedRequest<{ success: boolean; total: number; promedios: Record<string, number | null>; data: WearableMetrica[]; error?: string }>(
    `/api/clients/${clientId}/wearable/metricas?${qs.toString()}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener las métricas del wearable.');
  return { total: body.total, promedios: body.promedios, data: body.data };
}

export function getWearableConnectUrl(dispositivo: Dispositivo, clientId: string): string {
  return `${API_BASE_URL}/api/wearable/${dispositivo}/connect?clienteId=${clientId}`;
}

export async function syncWearable(clientId: string, dispositivo: Dispositivo): Promise<{ success: boolean; sincronizados?: number; error?: string }> {
  return authorizedRequest(`/api/clients/${clientId}/wearable/${dispositivo}/sync`, 'POST', {});
}

export async function disconnectWearable(clientId: string, dispositivo: Dispositivo): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/wearable/${dispositivo}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al desconectar.');
}
