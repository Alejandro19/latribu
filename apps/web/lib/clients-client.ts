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
  plan_end_date?: string;
  plan_start_date?: string;
  plan_duration_days?: number;
};

export type ClientDetail = ClientSummary & {
  training_days?: number;
  trainingDays?: number;
  objetivos?: Record<string, string>;
  nextCheckinDate?: string | null;
  inbodyCadenceType?: string;
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
  password: string;
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

