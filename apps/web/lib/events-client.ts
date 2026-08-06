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

export type CommunityEvent = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  location: string | null;
  capacity: number | null;
  active: boolean;
  confirmed_count: number;
};

export async function listEvents(): Promise<CommunityEvent[]> {
  const body = await authorizedRequest<{ success: boolean; events: CommunityEvent[]; error?: string }>('/api/community/events', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener eventos.');
  return body.events;
}

export async function createEvent(input: { title: string; description?: string; event_date?: string; location?: string; capacity?: number }): Promise<CommunityEvent> {
  const body = await authorizedRequest<{ success: boolean; event: CommunityEvent; error?: string }>('/api/community/events', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear el evento.');
  return body.event;
}

export async function updateEvent(eventId: string, input: Partial<{ title: string; description: string; event_date: string; location: string; capacity: number; active: boolean }>): Promise<CommunityEvent> {
  const body = await authorizedRequest<{ success: boolean; event: CommunityEvent; error?: string }>(`/api/community/events/${eventId}`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el evento.');
  return body.event;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/events/${eventId}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el evento.');
}

export async function reserveEvent(eventId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/events/${eventId}/reserve`, 'POST');
  if (!body.success) throw new Error(body.error || 'Error al reservar.');
}

export async function cancelEventReservation(eventId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/community/events/${eventId}/reserve`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al cancelar la reserva.');
}

export async function listMyEventReservations(clientId: string): Promise<Array<{ eventId: string; status: string }>> {
  const body = await authorizedRequest<{ success: boolean; reservations: Array<{ eventId: string; status: string }>; error?: string }>(`/api/clients/${clientId}/event-reservations`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener tus reservas.');
  return body.reservations;
}