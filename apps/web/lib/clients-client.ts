import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

export type ClientSummary = {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  clientType: string;
  client_type?: string;
  // El backend siempre serializa estos tres en camelCase (son columnas
  // `plan_end_date`/etc. en Postgres, pero Drizzle expone la propiedad JS
  // con el nombre camelCase del schema, sin conversión) — nunca snake_case.
  planEndDate?: string | null;
  planStartDate?: string | null;
  planDurationDays?: number | null;
  deletionRequestedAt?: string | null;
  // Indicadores de onboarding Mentoría (ver clients.service.ts::listClients) — solo Mentoría, "-" para Cliente 1:1.
  baselineComplete?: boolean;
  wearableDaysConDatos?: number | null;
  labWeek0Status?: string | null;
  wearableBaselineReadyAt?: string | null;
};

export type NotificationPreferences = {
  streakReminders: boolean;
  events: boolean;
  news: boolean;
};

export type ClientDetail = ClientSummary & {
  training_days?: number;
  trainingDays?: number;
  objetivos?: Record<string, string>;
  nextCheckinDate?: string | null;
  inbodyCadenceType?: string;
  // Autoasignado al activar el cliente (ver updateStatus en clients.service.ts) — null hasta entonces.
  memberNumber?: number | null;
  activatedAt?: string | null;
  googleId?: string | null;
  appleId?: string | null;
  avatarUrl?: string | null;
  notificationPreferences?: NotificationPreferences;
  // Idioma de la interfaz fija (Configuración > Idioma) — 'es' | 'en', 'es' por defecto.
  language?: string;
  deletionRequestedAt?: string | null;
  // Solo relevante para Mentoría — true mientras el cliente nunca haya
  // creado su contraseña desde el link de invitación (ver clients.controller.ts::getClient).
  hasPendingInvitation?: boolean;
  // Saldo de clases del paquete Presencial vigente — null para cualquier
  // otro tipo de cliente (ver activatePaidPlan en apps/api).
  sessionsTotal?: number | null;
  sessionsRemaining?: number | null;
  // Onboarding obligatorio Mentoría (ver onboarding-approvals.service.ts) — todos null para Cliente 1:1.
  baselineApprovedAt?: string | null;
  wearableApprovedAt?: string | null;
  wearableBaselineReadyAt?: string | null;
  wearableBaselineStableAt?: string | null;
  week1ActivatedAt?: string | null;
};

export type MembershipPayment = {
  id: string;
  clientId: string;
  clientType: string;
  durationMonths: number;
  packageSize: number | null;
  amountCents: number;
  currency: string;
  provider: 'wompi' | 'stripe';
  status: 'pending' | 'succeeded' | 'failed';
  requiresApproval: boolean;
  appliedAt: string | null;
  trmUsed: string | null;
  trmDate: string | null;
  marginApplied: string | null;
  createdAt: string;
  succeededAt: string | null;
};

export async function fetchClients(): Promise<ClientSummary[]> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al listar clientes.');
  return body.clients;
}

export async function fetchClient(id: string): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al obtener cliente.');
  return body.client;
}

export async function createClient(payload: {
  name: string;
  email: string;
  password?: string;
  mustChangePassword?: boolean;
  client_type?: string;
}): Promise<void> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al crear cliente.');
}

export async function activateClient(id: string, clientType: string): Promise<ClientDetail> {
  const token = getSessionToken();
  // First set client type, then activate
  await fetch(`${API_BASE_URL}/api/clients/${id}/client-type`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ client_type: clientType }),
  });
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'active' }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al activar cliente.');
  return body.client;
}

export async function deactivateClient(id: string): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'inactive' }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al desactivar cliente.');
  return body.client;
}

export async function updateClientProfile(id: string, patch: { name?: string; email?: string }): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al actualizar tu perfil.');
  return body.client;
}

export async function resendInvitation(id: string): Promise<void> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}/resend-invitation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al reenviar la invitación.');
}

export async function approveBaseline(id: string): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}/onboarding/approve-baseline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al aprobar el baseline.');
  return body.client;
}

export async function approveWearable(id: string): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}/onboarding/approve-wearable`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al aprobar el wearable.');
  return body.client;
}

export async function resolveDeletionRequest(id: string): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}/deletion-request/resolve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al resolver la solicitud.');
  return body.client;
}

export async function saveClientType(id: string, clientType: string): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${id}/client-type`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ client_type: clientType }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al actualizar tipo de cliente.');
  return body.client;
}

export async function fetchMembershipPayments(clientId: string): Promise<MembershipPayment[]> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${clientId}/membership-payments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al obtener el historial de pagos.');
  return body.payments;
}

export async function approveMembershipPayment(clientId: string, paymentId: string): Promise<ClientDetail> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}/api/clients/${clientId}/membership-payments/${paymentId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al aprobar el pago.');
  return body.client;
}

