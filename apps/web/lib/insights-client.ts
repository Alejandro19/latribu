import { getSessionToken, PermissionDeniedError } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) {
    const errorBody = await res.json().catch(() => ({}));
    throw new PermissionDeniedError(errorBody.error || 'No tienes acceso a este módulo.');
  }
  return res.json();
}

export type InsightTipo = 'optimizar' | 'vigilar' | 'derivar_medico' | 'regla_sistema';

export type RuleResult = {
  id: string;
  tipo: InsightTipo;
  mensaje: string;
  validoHastaProximoCheckpoint?: boolean;
};

export type ModuleKey = 'cortisol' | 'sueno' | 'entrenamiento' | 'nutricion' | 'puntoCiego' | 'miEvolucion';

export type FaseCiclo = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea_temprana' | 'lutea_tardia';
export type FaseCicloResumen = { fase: FaseCiclo; confianza: 'alta' | 'media' | 'estimado'; mensaje: string };

export type InsightsResponse =
  | { applicable: false }
  | { applicable: true; excluded: 'embarazo_lactancia'; mensaje: string }
  | { applicable: true; excluded: null; fase: FaseCicloResumen | null; modules: Record<ModuleKey, RuleResult[]> };

export async function getInsights(clientId: string): Promise<InsightsResponse> {
  return authorizedRequest<InsightsResponse>(`/api/clients/${clientId}/insights`, 'GET');
}
