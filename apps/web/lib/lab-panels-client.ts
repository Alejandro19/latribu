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

export type LabPanel = { id: string; semanaNumero: number; fecha: string | null; datos: Record<string, number> };

export async function listLabPanels(clientId: string): Promise<LabPanel[]> {
  const body = await authorizedRequest<{ success: boolean; panels: LabPanel[]; error?: string }>(`/api/clients/${clientId}/lab-panels`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener los paneles de laboratorio.');
  return body.panels;
}

export async function upsertLabPanel(
  clientId: string,
  input: { semana: number; fecha: string; datos: Record<string, number> }
): Promise<LabPanel> {
  const body = await authorizedRequest<{ success: boolean; panel: LabPanel; error?: string }>(`/api/clients/${clientId}/lab-panels`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar el panel de laboratorio.');
  return body.panel;
}
