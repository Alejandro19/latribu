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

export type CommunityTherapy = {
  id: string;
  title: string;
  description: string | null;
  discountPct: number | null;
  provider: string | null;
  active: boolean;
  confirmed_count: number;
};

export async function listTherapies(): Promise<CommunityTherapy[]> {
  const body = await authorizedRequest<{ success: boolean; therapies: CommunityTherapy[]; error?: string }>('/api/community/therapies', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener terapias.');
  return body.therapies;
}

export async function createTherapy(input: { title: string; description?: string; discount_pct?: number; provider?: string }): Promise<CommunityTherapy> {
  const body = await authorizedRequest<{ success: boolean; therapy: CommunityTherapy; error?: string }>('/api/community/therapies', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear la terapia.');
  return body.therapy;
}

export async function updateTherapy(therapyId: string, input: Partial<{ title: string; description: string; discount_pct: number; provider: string; active: boolean }>): Promise<CommunityTherapy> {
  const body = await authorizedRequest<{ success: boolean; therapy: CommunityTherapy; error?: string }>(`/api/community/therapies/${therapyId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar la terapia.');
  return body.therapy;
}

export async function deleteTherapy(therapyId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/therapies/${therapyId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar la terapia.');
}

export async function reserveTherapy(therapyId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/therapies/${therapyId}/reserve`, 'POST');
  if (!body.success) throw new Error(body.error || 'Error al reservar.');
}

export async function cancelTherapyReservation(therapyId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/therapies/${therapyId}/reserve`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al cancelar la reserva.');
}

export async function listMyTherapyReservations(clientId: string): Promise<Array<{ therapyId: string; status: string }>> {
  const body = await authorizedRequest<{ success: boolean; reservations: Array<{ therapyId: string; status: string }>; error?: string }>(`/api/clients/${clientId}/therapy-reservations`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener tus reservas.');
  return body.reservations;
}