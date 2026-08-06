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

// ── Tipos ────────────────────────────────────────────────────────────────────

export type EvolutionCheckin = {
  id: string;
  clientId: string;
  fecha: string;
  strengthScore: number | null;
  moodScore: number | null;
  confidenceScore: number | null;
  securityScore: number | null;
  energyScore: number | null;
  notes: string | null;
  sleepHours: number | null;
  adherencePct: number | null;
  painFlag: boolean | null;
  painNotes: string | null;
  stressScore: number | null;
  createdAt: string;
};

export type AnthropometricRecord = {
  id: string;
  clientId: string;
  fecha: string;
  semana: number | null;
  mesNum: number | null;
  peso: number | null;
  cintura: number | null;
  brazos: number | null;
  hombros: number | null;
  piernas: number | null;
  gluteo: number | null;
  notas: string | null;
  createdAt: string;
};

export type InbodyRecord = {
  id: string;
  clientId: string;
  fecha: string | null;
  version: string | null;
  pesoTotal: number | null;
  smm: number | null;
  grasaPct: number | null;
  imc: number | null;
  pesoObjetivo: number | null;
  grasaVisceral: number | null;
  bmr: number | null;
  anguloFase: number | null;
  ecwTbw: number | null;
  masaOsea: number | null;
  altura: number | null;
  mesNum: number | null;
  fileUrl: string | null;
  createdAt: string;
};

export type EvolutionData = {
  checkins: EvolutionCheckin[];
  anthropometrics: AnthropometricRecord[];
  inbody: InbodyRecord[];
};

export type PersonalRecord = {
  id: string;
  clientId: string;
  exerciseName: string;
  initialValue: string | null;
  currentValue: string | null;
  sortOrder: number;
  createdAt: string;
};

// ── Endpoints ────────────────────────────────────────────────────────────────

/** 1. GET /api/clients/:id/evolution — Dashboard completo */
export async function getEvolutionData(clientId: string): Promise<EvolutionData> {
  const body = await authorizedRequest<{
    success: boolean; checkins: EvolutionCheckin[];
    anthropometrics: AnthropometricRecord[]; inbody: InbodyRecord[]; error?: string;
  }>(`/api/clients/${clientId}/evolution`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener datos de evolución.');
  return { checkins: body.checkins, anthropometrics: body.anthropometrics, inbody: body.inbody };
}

/** 2. POST /api/clients/:id/evolution — Crear check-in */
export async function createCheckin(
  clientId: string,
  input: {
    fecha: string; strength_score?: number | null; mood_score?: number | null;
    confidence_score?: number | null; security_score?: number | null;
    energy_score?: number | null; sleep_hours?: number | null;
    adherence_pct?: number | null; pain_flag?: boolean | null;
    pain_notes?: string | null; stress_score?: number | null; notes?: string | null;
  }
): Promise<EvolutionCheckin> {
  const body = await authorizedRequest<{ success: boolean; checkin: EvolutionCheckin; error?: string }>(
    `/api/clients/${clientId}/evolution`, 'POST', input
  );
  if (!body.success) throw new Error(body.error || 'Error al crear check-in.');
  return body.checkin;
}

/** 3. GET /api/clients/:id/personal-records — Listar récords personales */
export async function listPersonalRecords(clientId: string): Promise<PersonalRecord[]> {
  const body = await authorizedRequest<{ success: boolean; records: PersonalRecord[]; error?: string }>(
    `/api/clients/${clientId}/personal-records`, 'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener récords.');
  return body.records;
}

/** 4. POST /api/clients/:id/personal-records — Crear récord (admin) */
export async function createPersonalRecord(
  clientId: string,
  input: { exercise_name: string; initial_value?: string | null; current_value?: string | null; sort_order?: number }
): Promise<PersonalRecord> {
  const body = await authorizedRequest<{ success: boolean; record: PersonalRecord; error?: string }>(
    `/api/clients/${clientId}/personal-records`, 'POST', input
  );
  if (!body.success) throw new Error(body.error || 'Error al crear récord.');
  return body.record;
}

/** 5. PUT /api/clients/:id/personal-records/:recordId — Editar récord (admin) */
export async function updatePersonalRecord(
  clientId: string, recordId: string,
  input: { exercise_name?: string; initial_value?: string | null; current_value?: string | null; sort_order?: number }
): Promise<PersonalRecord> {
  const body = await authorizedRequest<{ success: boolean; record: PersonalRecord; error?: string }>(
    `/api/clients/${clientId}/personal-records/${recordId}`, 'PUT', input
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar récord.');
  return body.record;
}

/** 6. DELETE /api/clients/:id/personal-records/:recordId — Eliminar récord (admin) */
export async function deletePersonalRecord(clientId: string, recordId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(
    `/api/clients/${clientId}/personal-records/${recordId}`, 'DELETE'
  );
  if (!body.success) throw new Error(body.error || 'Error al eliminar récord.');
}

/** 7. PATCH /api/clients/:id/next-checkin-date — Fecha próxima medición (admin) */
export async function updateNextCheckinDate(clientId: string, nextCheckinDate: string | null): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(
    `/api/clients/${clientId}/next-checkin-date`, 'PATCH',
    { next_checkin_date: nextCheckinDate }
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar fecha de próximo control.');
}

