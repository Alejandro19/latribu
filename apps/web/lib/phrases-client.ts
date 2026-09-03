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

export type AdminPhrase = {
  id: string;
  text: string;
  context: string;
  active: boolean;
};

export async function listPhrases(): Promise<AdminPhrase[]> {
  const body = await authorizedRequest<{ success: boolean; phrases: AdminPhrase[]; error?: string }>('/api/admin/phrases', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener las frases.');
  return body.phrases;
}

export async function createPhrase(text: string, context: string): Promise<AdminPhrase> {
  const body = await authorizedRequest<{ success: boolean; phrase: AdminPhrase; error?: string }>('/api/admin/phrases', 'POST', {
    text,
    context,
  });
  if (!body.success) throw new Error(body.error || 'Error al crear la frase.');
  return body.phrase;
}

export async function updatePhrase(
  id: string,
  patch: { text?: string; context?: string; active?: boolean }
): Promise<AdminPhrase> {
  const body = await authorizedRequest<{ success: boolean; phrase: AdminPhrase; error?: string }>(
    `/api/admin/phrases/${id}`,
    'PATCH',
    patch
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar la frase.');
  return body.phrase;
}

export async function deletePhrase(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/phrases/${id}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la frase.');
}

export async function drawPreviewPhrase(context: string, excludeId?: string): Promise<AdminPhrase | null> {
  const qs = new URLSearchParams({ context });
  if (excludeId) qs.set('exclude', excludeId);
  const body = await authorizedRequest<{ success: boolean; phrase: AdminPhrase | null; error?: string }>(
    `/api/admin/phrases/random?${qs.toString()}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al sortear la frase.');
  return body.phrase;
}
