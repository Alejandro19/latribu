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

export type Supplement = {
  id: string;
  name: string;
  brand: string | null;
  dose: string | null;
  timing: string | null;
  benefit: string | null;
  category: string | null;
  active: boolean;
};

export async function listSupplements(clientId: string): Promise<Supplement[]> {
  const body = await authorizedRequest<{ success: boolean; supplements: Supplement[]; error?: string }>(`/api/clients/${clientId}/supplements`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener suplementos.');
  return body.supplements;
}

export async function createSupplement(clientId: string, input: { name: string; brand?: string; dose?: string; timing?: string; benefit?: string; category?: string }): Promise<Supplement> {
  const body = await authorizedRequest<{ success: boolean; supplement: Supplement; error?: string }>(`/api/clients/${clientId}/supplements`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al asignar el suplemento.');
  return body.supplement;
}

export async function updateSupplement(clientId: string, suppId: string, input: { name: string; brand?: string; dose?: string; timing?: string; benefit?: string; category?: string }): Promise<Supplement> {
  const body = await authorizedRequest<{ success: boolean; supplement: Supplement; error?: string }>(`/api/clients/${clientId}/supplements/${suppId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el suplemento.');
  return body.supplement;
}

export async function deleteSupplement(clientId: string, suppId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/supplements/${suppId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el suplemento.');
}
