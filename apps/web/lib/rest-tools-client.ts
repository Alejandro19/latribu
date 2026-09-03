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

export type RestTool = {
  id: string;
  name: string;
  meta: string | null;
  action: string;
  minutes: number | null;
  seconds: number | null;
  audioUrl: string | null;
  audioName: string | null;
  active: boolean;
  sortOrder: number;
};

export async function listRestTools(): Promise<RestTool[]> {
  const body = await authorizedRequest<{ success: boolean; tools: RestTool[]; error?: string }>('/api/rest-tools', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las herramientas para dormir.');
  return body.tools;
}

export async function listAllRestTools(): Promise<RestTool[]> {
  const body = await authorizedRequest<{ success: boolean; tools: RestTool[]; error?: string }>('/api/admin/rest-tools', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las herramientas para dormir.');
  return body.tools;
}

export async function createRestTool(input: {
  name: string;
  meta?: string | null;
  action: string;
  minutes?: number | null;
  seconds?: number | null;
}): Promise<RestTool> {
  const body = await authorizedRequest<{ success: boolean; tool: RestTool; error?: string }>('/api/admin/rest-tools', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear la herramienta.');
  return body.tool;
}

export async function updateRestTool(
  id: string,
  patch: Partial<{
    name: string;
    meta: string | null;
    action: string;
    minutes: number | null;
    seconds: number | null;
    active: boolean;
    audioUrl: string | null;
    audioName: string | null;
  }>
): Promise<RestTool> {
  const body = await authorizedRequest<{ success: boolean; tool: RestTool; error?: string }>(`/api/admin/rest-tools/${id}`, 'PUT', patch);
  if (!body.success) throw new Error(body.error || 'Error al actualizar la herramienta.');
  return body.tool;
}

export async function deleteRestTool(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/rest-tools/${id}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la herramienta.');
}

export async function uploadRestToolAudio(id: string, file: File): Promise<RestTool> {
  const formData = new FormData();
  formData.append('audio', file);
  const body = await authorizedRequest<{ success: boolean; tool: RestTool; error?: string }>(
    `/api/admin/rest-tools/${id}/upload-audio`,
    'POST',
    formData
  );
  if (!body.success) throw new Error(body.error || 'Error al subir el audio.');
  return body.tool;
}

export async function removeRestToolAudio(id: string): Promise<RestTool> {
  return updateRestTool(id, { audioUrl: null, audioName: null });
}
