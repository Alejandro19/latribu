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

export type EventReservation = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  eventLocation: string | null;
  clientName: string;
  clientPhone: string | null;
};

export type TherapyReservation = {
  id: string;
  therapyId: string;
  therapyTitle: string;
  therapyProvider: string | null;
  therapyDiscountPct: number | null;
  clientName: string;
  clientPhone: string | null;
};

export async function getConfirmedReservations(): Promise<{ eventReservations: EventReservation[]; therapyReservations: TherapyReservation[] }> {
  const body = await authorizedRequest<{
    success: boolean;
    eventReservations: EventReservation[];
    therapyReservations: TherapyReservation[];
    error?: string;
  }>('/api/community/reservations', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener reservaciones.');
  return {
    eventReservations: body.eventReservations,
    therapyReservations: body.therapyReservations,
  };
}
