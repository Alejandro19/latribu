import { getSessionToken } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

export type PersonalInfo = {
  country: string | null;
  city: string | null;
  weight: number | null;
  height: number | null;
};

export type AnthropometricRecord = {
  id: string;
  fecha: string;
  peso: number | null;
  cintura: number | null;
};

export type ProgressPhoto = {
  id: string;
  angle: string | null;
  photoUrl: string;
  fecha: string;
};

export type InbodyRecord = {
  id: string;
  fecha: string | null;
  pesoTotal: number | null;
  grasaPct: number | null;
};

async function authorizedGet<T>(path: string): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

export async function getPersonalInfo(clientId: string): Promise<PersonalInfo> {
  const body = await authorizedGet<{ success: boolean; personalInfo: PersonalInfo; error?: string }>(`/api/clients/${clientId}/personal-info`);
  if (!body.success) throw new Error(body.error || 'Error al obtener información personal.');
  return body.personalInfo;
}

export async function getAnthropometrics(clientId: string): Promise<AnthropometricRecord[]> {
  const body = await authorizedGet<{ success: boolean; records: AnthropometricRecord[]; error?: string }>(`/api/clients/${clientId}/anthropometrics`);
  if (!body.success) throw new Error(body.error || 'Error al obtener medidas.');
  return body.records;
}

export async function getPhotos(clientId: string): Promise<ProgressPhoto[]> {
  const body = await authorizedGet<{ success: boolean; photos: ProgressPhoto[]; error?: string }>(`/api/clients/${clientId}/photos`);
  if (!body.success) throw new Error(body.error || 'Error al obtener fotos.');
  return body.photos;
}

export async function getInbodyRecords(clientId: string): Promise<InbodyRecord[]> {
  const body = await authorizedGet<{ success: boolean; records: InbodyRecord[]; error?: string }>(`/api/clients/${clientId}/inbody-records`);
  if (!body.success) throw new Error(body.error || 'Error al obtener registros InBody.');
  return body.records;
}
