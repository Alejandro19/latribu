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

export type BlindspotCaseStatus = 'evaluando' | 'referido' | 'en_proceso' | 'cerrado';
export type BlindspotTaskStatus = 'pendiente' | 'completada' | 'omitida';
export type BlindspotProgressMarker = 'avance' | 'estable' | 'retroceso' | 'cerrado';

export type BlindspotCase = {
  id: string;
  caseNumber: number;
  clientId: string;
  therapistId: string | null;
  status: BlindspotCaseStatus;
  initialAssessment: { motivoConsulta: string; areaPercibida: string; prioridad: 'alta' | 'media' | 'baja' };
  adminPrivateNotes?: string | null;
  crisisFlag: boolean;
  crisisFlaggedAt: string | null;
  crisisFlaggedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlindspotTask = {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: BlindspotTaskStatus;
  createdBy: string;
  completedAt: string | null;
  createdAt: string;
};

export type BlindspotSessionLog = {
  id: string;
  caseId?: string;
  sessionDate: string;
  progressMarker: BlindspotProgressMarker;
  internalSummary?: string | null;
  clientNote: string | null;
  createdAt?: string;
};

export type Therapist = {
  id: string;
  name: string;
  email: string;
  specialty: string | null;
  phone?: string | null;
  active: boolean;
  createdAt?: string;
};

// ==== ADMIN ====

export async function adminListCases(): Promise<BlindspotCase[]> {
  const body = await authorizedRequest<{ success: boolean; cases: BlindspotCase[]; error?: string }>('/api/blindspot/cases', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener los casos.');
  return body.cases;
}

export async function adminGetCase(id: string): Promise<{ case: BlindspotCase; tasks: BlindspotTask[]; sessionLogs: BlindspotSessionLog[] }> {
  const body = await authorizedRequest<{ success: boolean; case: BlindspotCase; tasks: BlindspotTask[]; sessionLogs: BlindspotSessionLog[]; error?: string }>(
    `/api/blindspot/cases/${id}`,
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener el caso.');
  return { case: body.case, tasks: body.tasks, sessionLogs: body.sessionLogs };
}

export async function adminCreateCase(input: {
  clientId: string;
  initialAssessment: { motivoConsulta: string; areaPercibida: string; prioridad: 'alta' | 'media' | 'baja' };
}): Promise<BlindspotCase> {
  const body = await authorizedRequest<{ success: boolean; case: BlindspotCase; error?: string }>('/api/blindspot/cases', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear el caso.');
  return body.case;
}

export async function adminUpdateCase(
  id: string,
  input: Partial<{ status: BlindspotCaseStatus; therapistId: string | null; adminPrivateNotes: string | null }>
): Promise<BlindspotCase> {
  const body = await authorizedRequest<{ success: boolean; case: BlindspotCase; error?: string }>(`/api/blindspot/cases/${id}`, 'PATCH', input);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el caso.');
  return body.case;
}

export async function adminAcknowledgeCrisis(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/blindspot/cases/${id}/crisis/acknowledge`, 'PATCH');
  if (!body.success) throw new Error(body.error || 'Error al atender la alerta.');
}

export async function adminListTherapists(): Promise<Therapist[]> {
  const body = await authorizedRequest<{ success: boolean; therapists: Therapist[]; error?: string }>('/api/blindspot/therapists', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener terapeutas.');
  return body.therapists;
}

export async function adminCreateTherapist(input: { name: string; email: string; password: string; specialty?: string; phone?: string }): Promise<Therapist> {
  const body = await authorizedRequest<{ success: boolean; therapist: Therapist; error?: string }>('/api/blindspot/therapists', 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear el terapeuta.');
  return body.therapist;
}

export async function adminSetTherapistActive(id: string, active: boolean): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/blindspot/therapists/${id}`, 'PATCH', { active });
  if (!body.success) throw new Error(body.error || 'Error al actualizar el terapeuta.');
}

export async function adminUpdateTherapist(
  id: string,
  patch: Partial<{ name: string; email: string; specialty: string | null; phone: string | null; active: boolean }>
): Promise<Therapist> {
  const body = await authorizedRequest<{ success: boolean; therapist: Therapist; error?: string }>(`/api/blindspot/therapists/${id}`, 'PATCH', patch);
  if (!body.success) throw new Error(body.error || 'Error al actualizar el terapeuta.');
  return body.therapist;
}

export async function adminDeleteTherapist(id: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/blindspot/therapists/${id}`, 'DELETE');
  if (!body.success) throw new Error(body.error || 'Error al eliminar el terapeuta.');
}

// ==== TERAPEUTA ====

export type TherapistCaseListItem = BlindspotCase & { clientName: string; lastSessionAt: string | null };

export type TherapistCaseClient = {
  id: string;
  name: string;
  email: string;
  cedula: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
};

export async function therapistListCases(): Promise<TherapistCaseListItem[]> {
  const body = await authorizedRequest<{ success: boolean; cases: TherapistCaseListItem[]; error?: string }>('/api/blindspot/therapist/cases', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener tus casos.');
  return body.cases;
}

export async function therapistGetCase(id: string): Promise<{ case: BlindspotCase; tasks: BlindspotTask[]; sessionLogs: BlindspotSessionLog[]; client: TherapistCaseClient | null }> {
  const body = await authorizedRequest<{
    success: boolean;
    case: BlindspotCase;
    tasks: BlindspotTask[];
    sessionLogs: BlindspotSessionLog[];
    client: TherapistCaseClient | null;
    error?: string;
  }>(`/api/blindspot/therapist/cases/${id}`, 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener el caso.');
  return { case: body.case, tasks: body.tasks, sessionLogs: body.sessionLogs, client: body.client };
}

export async function therapistCreateTask(caseId: string, input: { title: string; description?: string; dueDate?: string }): Promise<BlindspotTask> {
  const body = await authorizedRequest<{ success: boolean; task: BlindspotTask; error?: string }>(`/api/blindspot/therapist/cases/${caseId}/tasks`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al crear la tarea.');
  return body.task;
}

export async function therapistUpdateTask(caseId: string, taskId: string, status: BlindspotTaskStatus): Promise<BlindspotTask> {
  const body = await authorizedRequest<{ success: boolean; task: BlindspotTask; error?: string }>(
    `/api/blindspot/therapist/cases/${caseId}/tasks/${taskId}`,
    'PATCH',
    { status }
  );
  if (!body.success) throw new Error(body.error || 'Error al actualizar la tarea.');
  return body.task;
}

export async function therapistCreateSession(
  caseId: string,
  input: { sessionDate: string; progressMarker: BlindspotProgressMarker; internalSummary?: string; clientNote?: string }
): Promise<BlindspotSessionLog> {
  const body = await authorizedRequest<{ success: boolean; sessionLog: BlindspotSessionLog; error?: string }>(
    `/api/blindspot/therapist/cases/${caseId}/sessions`,
    'POST',
    input
  );
  if (!body.success) throw new Error(body.error || 'Error al registrar la sesión.');
  return body.sessionLog;
}

export async function therapistRaiseCrisis(caseId: string): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/blindspot/therapist/cases/${caseId}/crisis`, 'POST');
  if (!body.success) throw new Error(body.error || 'Error al levantar la alerta.');
}

export async function therapistLogin(email: string, password: string): Promise<{ token: string; mustChangePassword: boolean; user: { id: string; name: string; email: string; specialty: string | null } }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/therapist/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Credenciales incorrectas.');
  return { token: body.token, mustChangePassword: Boolean(body.mustChangePassword), user: body.user };
}

// ==== CLIENTE ====

export async function clientGetMyCase(): Promise<{ case: { id: string; caseNumber: number; status: BlindspotCaseStatus; therapistName: string | null } | null; tasks: BlindspotTask[]; sessionLogs: BlindspotSessionLog[] }> {
  const body = await authorizedRequest<{
    success: boolean;
    case: { id: string; caseNumber: number; status: BlindspotCaseStatus; therapistName: string | null } | null;
    tasks: BlindspotTask[];
    sessionLogs: BlindspotSessionLog[];
    error?: string;
  }>('/api/blindspot/my-case', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al obtener tu caso.');
  return { case: body.case, tasks: body.tasks, sessionLogs: body.sessionLogs };
}

export async function clientCompleteTask(taskId: string): Promise<BlindspotTask> {
  const body = await authorizedRequest<{ success: boolean; task: BlindspotTask; error?: string }>(`/api/blindspot/my-case/tasks/${taskId}`, 'PATCH');
  if (!body.success) throw new Error(body.error || 'Error al actualizar la tarea.');
  return body.task;
}

export async function clientRequestHelp(): Promise<string> {
  const body = await authorizedRequest<{ success: boolean; message: string; error?: string }>('/api/blindspot/my-case/help', 'POST');
  if (!body.success) throw new Error(body.error || 'Error al enviar la solicitud.');
  return body.message;
}
