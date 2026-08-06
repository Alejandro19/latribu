import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

async function authorizedRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export type PersonalInfoUpdatePayload = {
  birthdate?: string;
  gender?: string;
  occupation?: string;
  marital_status?: string;
  country?: string;
  city?: string;
  phone_code?: string;
  phone_number?: string;
  weight?: number | null;
  height?: number | null;
  body_fat?: number | null;
  onboarding_report: Record<string, unknown>;
  complete: true;
};

export async function putPersonalInfo(clientId: string, payload: PersonalInfoUpdatePayload): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/personal-info`, 'PUT', payload);
  if (!body.success) throw new Error(body.error || 'Error al guardar tu información personal.');
}

export async function uploadPersonalInfoFile(
  clientId: string,
  file: File,
  onboardingReport: Record<string, unknown>
): Promise<{ file_url: string; file_name: string; uploaded_at: string }> {
  const formData = new FormData();
  formData.append('checkup_file', file);
  formData.append('onboarding_report', JSON.stringify(onboardingReport));
  const body = await authorizedRequest<{ success: boolean; file_url: string; file_name: string; uploaded_at: string; error?: string }>(
    `/api/clients/${clientId}/personal-info-file`,
    'POST',
    formData
  );
  if (!body.success) throw new Error(body.error || 'Error al subir el archivo de chequeo médico.');
  return body;
}

export type AnthropometricInput = {
  fecha: string;
  peso?: number | null;
  cintura?: number | null;
  brazos?: number | null;
  hombros?: number | null;
  piernas?: number | null;
  gluteo?: number | null;
  mes_num: number;
};

export async function createAnthropometric(clientId: string, input: AnthropometricInput): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/anthropometrics`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar tus medidas antropométricas.');
}

export async function createPhoto(clientId: string, file: File, angle: string, mesNum: number): Promise<void> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('angle', angle);
  formData.append('mes_num', String(mesNum));
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/photos`, 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir tu foto de progreso.');
}

export type InbodyRecordInput = {
  fecha: string;
  version?: string | null;
  peso_total?: number | null;
  smm?: number | null;
  grasa_pct?: number | null;
  imc?: number | null;
  peso_objetivo?: number | null;
  grasa_visceral?: number | null;
  bmr?: number | null;
  angulo_fase?: number | null;
  ecw_tbw?: number | null;
  masa_osea?: number | null;
  altura?: number | null;
  mes_num: number;
  file_url?: string | null;
  file_name?: string | null;
};

export async function createInbodyRecord(clientId: string, input: InbodyRecordInput): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}/inbody-records`, 'POST', input);
  if (!body.success) throw new Error(body.error || 'Error al guardar tu registro InBody.');
}

export async function uploadInbodyFile(clientId: string, file: File): Promise<{ file_url: string; file_name: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const body = await authorizedRequest<{ success: boolean; file_url: string; file_name: string; error?: string }>(
    `/api/clients/${clientId}/inbody-upload`,
    'POST',
    formData
  );
  if (!body.success) throw new Error(body.error || 'Error al adjuntar el archivo InBody.');
  return body;
}

export async function callOcr(clientId: string, base64: string): Promise<{ text: string; source: 'vision' | 'pdf-parse' }> {
  const body = await authorizedRequest<{ success: boolean; text: string; source: 'vision' | 'pdf-parse'; error?: string }>(
    `/api/clients/${clientId}/ocr-vision`,
    'POST',
    { base64 }
  );
  if (!body.success) throw new Error(body.error || 'Error al procesar el archivo con OCR.');
  return body;
}

export async function updateClientObjetivos(clientId: string, objetivos: Record<string, string>): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>(`/api/clients/${clientId}`, 'PUT', { objetivos });
  if (!body.success) throw new Error(body.error || 'Error al guardar tu objetivo.');
}
