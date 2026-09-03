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

export type NutritionTip = { id: string; content: string; active: boolean };

export async function listTips(): Promise<NutritionTip[]> {
  const body = await authorizedRequest<{ success: boolean; tips: NutritionTip[]; error?: string }>('/api/admin/nutrition-tips', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener los tips.');
  return body.tips;
}

export async function createTip(content: string): Promise<NutritionTip> {
  const body = await authorizedRequest<{ success: boolean; tip: NutritionTip; error?: string }>('/api/admin/nutrition-tips', 'POST', { content });
  if (!body.success) throw new Error(body.error || 'Error al crear el tip.');
  return body.tip;
}

export async function updateTip(tipId: string, patch: { content?: string; active?: boolean }): Promise<NutritionTip> {
  const body = await authorizedRequest<{ success: boolean; tip: NutritionTip; error?: string }>(`/api/admin/nutrition-tips/${tipId}`, 'PATCH', patch);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el tip.');
  return body.tip;
}

export async function deleteTip(tipId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/admin/nutrition-tips/${tipId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el tip.');
}

export async function listActiveTips(clientId: string): Promise<NutritionTip[]> {
  const body = await authorizedRequest<{ success: boolean; tips: NutritionTip[]; error?: string }>(`/api/clients/${clientId}/nutrition-tips`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener los tips.');
  return body.tips;
}
