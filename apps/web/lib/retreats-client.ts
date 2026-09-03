import { getSessionToken, PermissionDeniedError } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(isFormData ? {} : { 'Content-Type': 'application/json' }) },
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) {
    const errorBody = await res.json().catch(() => ({}));
    throw new PermissionDeniedError(errorBody.error || 'No tienes acceso a este módulo.');
  }
  return res.json();
}

export type CommunityRetreat = {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  capacity: number | null;
  priceCents: number | null;
  imageUrl: string | null;
  active: boolean;
  confirmed_count: number;
};

export async function listRetreats(): Promise<CommunityRetreat[]> {
  const body = await authorizedRequest<{ success: boolean; retreats: CommunityRetreat[]; error?: string }>('/api/community/retreats', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener retiros.');
  return body.retreats;
}

export async function createRetreat(input: { title: string; description?: string; start_date?: string; end_date?: string; location?: string; capacity?: number; price_cents?: number }): Promise<CommunityRetreat> {
  const body = await authorizedRequest<{ success: boolean; retreat: CommunityRetreat; error?: string }>('/api/community/retreats', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear el retiro.');
  return body.retreat;
}

export async function updateRetreat(retreatId: string, input: Partial<{ title: string; description: string; start_date: string; end_date: string; location: string; capacity: number; price_cents: number; active: boolean }>): Promise<CommunityRetreat> {
  const body = await authorizedRequest<{ success: boolean; retreat: CommunityRetreat; error?: string }>(`/api/community/retreats/${retreatId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el retiro.');
  return body.retreat;
}

export async function uploadRetreatImage(retreatId: string, file: File): Promise<CommunityRetreat> {
  const formData = new FormData();
  formData.append('image', file);
  const body = await authorizedRequest<{ success: boolean; retreat: CommunityRetreat; error?: string }>(`/api/community/retreats/${retreatId}/upload-image`, 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir la foto.');
  return body.retreat;
}

export async function deleteRetreat(retreatId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/retreats/${retreatId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el retiro.');
}

export async function reserveRetreat(retreatId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/retreats/${retreatId}/reserve`, 'POST');
  if (!body.success) throw new Error(body.error || 'Error al reservar.');
}

export async function cancelRetreatReservation(retreatId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/retreats/${retreatId}/reserve`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al cancelar la reserva.');
}

export async function listMyRetreatReservations(clientId: string): Promise<Array<{ retreatId: string; status: string }>> {
  const body = await authorizedRequest<{ success: boolean; reservations: Array<{ retreatId: string; status: string }>; error?: string }>(`/api/clients/${clientId}/retreat-reservations`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener tus reservas.');
  return body.reservations;
}
