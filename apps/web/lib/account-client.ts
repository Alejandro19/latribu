import { getSessionToken, PermissionDeniedError } from './api-client';
import type { ClientDetail, NotificationPreferences } from './clients-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003';

// Todas las rutas de /api/account son "mi cuenta" — el backend siempre usa
// req.user.id, nunca reciben un clientId por parámetro.
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
  if (res.status === 403) {
    const errorBody = await res.json().catch(() => ({}));
    throw new PermissionDeniedError(errorBody.error || 'No tienes acceso a esta sección.');
  }
  return res.json();
}

export type LegalAcceptance = {
  dataPolicyVersion: string;
  termsVersion: string;
  sensitiveDataConsent: boolean;
  acceptedAt: string;
};

export type LegalAcceptancePayload = LegalAcceptance;

export async function getLegalAcceptance(): Promise<LegalAcceptance | null> {
  const body = await authorizedRequest<{ success: boolean; acceptance: LegalAcceptance | null; error?: string }>(
    '/api/account/legal-acceptance',
    'GET'
  );
  if (!body.success) throw new Error(body.error || 'Error al obtener tu consentimiento.');
  return body.acceptance;
}

export async function submitLegalAcceptance(payload: LegalAcceptancePayload): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>('/api/account/legal-acceptance', 'POST', payload);
  if (!body.success) throw new Error(body.error || 'Error al registrar tu autorización.');
}

export async function uploadAvatar(file: File): Promise<ClientDetail> {
  const formData = new FormData();
  formData.append('avatar', file);
  const body = await authorizedRequest<{ success: boolean; client: ClientDetail; error?: string }>('/api/account/avatar', 'POST', formData);
  if (!body.success) throw new Error(body.error || 'Error al subir la foto.');
  return body.client;
}

export async function updateNotificationPreferences(patch: Partial<NotificationPreferences>): Promise<ClientDetail> {
  const body = await authorizedRequest<{ success: boolean; client: ClientDetail; error?: string }>(
    '/api/account/notification-preferences',
    'PATCH',
    patch
  );
  if (!body.success) throw new Error(body.error || 'Error al guardar tus preferencias.');
  return body.client;
}

export async function updateLanguage(language: 'es' | 'en'): Promise<ClientDetail> {
  const body = await authorizedRequest<{ success: boolean; client: ClientDetail; error?: string }>(
    '/api/account/language',
    'PATCH',
    { language }
  );
  if (!body.success) throw new Error(body.error || 'Error al guardar tu idioma.');
  return body.client;
}

export async function requestAccountDeletion(): Promise<void> {
  const body = await authorizedRequest<{ success: boolean; error?: string }>('/api/account/deletion-request', 'POST');
  if (!body.success) throw new Error(body.error || 'Error al enviar tu solicitud.');
}

export type AccountExport = {
  profile: { name: string; email: string; avatarUrl: string | null };
  membership: {
    clientType: string;
    memberNumber: number | null;
    activatedAt: string | null;
    status: string;
    plan: string;
  };
  legalAcceptances: LegalAcceptance[];
  exportedAt: string;
};

export async function getAccountExport(): Promise<AccountExport> {
  const body = await authorizedRequest<{ success: boolean; data: AccountExport; error?: string }>('/api/account/export', 'GET');
  if (!body.success) throw new Error(body.error || 'Error al generar tu export de datos.');
  return body.data;
}
