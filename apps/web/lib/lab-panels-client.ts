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

export type LabPanelStatus = 'pendiente' | 'en_revision' | 'aprobado';

export type LabPanel = {
  id: string;
  semanaNumero: number;
  fecha: string | null;
  datos: Record<string, number>;
  status: LabPanelStatus;
  fileUrl: string | null;
  fileName: string | null;
  approvedAt: string | null;
  edadBiologica: number | null;
  edadCronologicaCalculo: number | null;
  edadBiologicaCalculadaEn: string | null;
};

export type ExtractedMarker = {
  marker_id: string;
  value: number | null;
  unit: string | null;
  detected: boolean;
};

export async function listLabPanels(clientId: string): Promise<LabPanel[]> {
  const body = await authorizedRequest<{ success: boolean; panels: LabPanel[]; error?: string }>(`/api/clients/${clientId}/lab-panels`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener los paneles de laboratorio.');
  return body.panels;
}

export async function upsertLabPanel(
  clientId: string,
  input: {
    semana: number;
    fecha: string;
    datos: Record<string, number>;
    diaCicloPanel?: number | null;
    fileUrl?: string;
    fileName?: string;
    sourceFileHash?: string;
  }
): Promise<LabPanel> {
  const body = await authorizedRequest<{ success: boolean; panel: LabPanel; error?: string }>(`/api/clients/${clientId}/lab-panels`, 'PUT', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar el panel de laboratorio.');
  return body.panel;
}

// Sube el PDF/imagen, corre OCR + extracción por IA en el backend, y
// devuelve el grid estructurado — todavía sin guardar (ver upsertLabPanel,
// que persiste lo que el cliente confirme/corrija).
export async function extractLabPanel(
  clientId: string,
  semana: number,
  file: File
): Promise<{ markers: ExtractedMarker[]; fileUrl: string; fileName: string; sourceFileHash: string; reused: boolean }> {
  const token = getSessionToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('semana', String(semana));
  const res = await fetch(`${API_BASE_URL}/api/clients/${clientId}/lab-panels/extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Error al procesar el laboratorio.');
  return body;
}

// Aprobación del admin — datos es opcional, solo se manda si corrigió algo.
export async function approveLabPanel(clientId: string, semana: number, datos?: Record<string, number>): Promise<LabPanel> {
  const body = await authorizedRequest<{ success: boolean; panel: LabPanel; error?: string }>(
    `/api/clients/${clientId}/lab-panels/${semana}/approve`,
    'POST',
    { datos }
  );
  if (!body.success) throw new Error(body.error || 'Error al aprobar el panel de laboratorio.');
  return body.panel;
}
