// ============================================================
// FASE 0 — API CLIENT SIMPLIFICADO
// Sin cachés ni interceptores.
// ============================================================

const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3003'}/api`;

// Lanzado por los *-client.ts cuando el backend responde 403 a un módulo
// protegido por requirePermission/requirePersonalInfoAccess — permite a los
// paneles distinguir "no tienes acceso a este módulo" (mostrar LockedOverlay)
// de cualquier otro error (mostrar el mensaje genérico de siempre). Ver plan
// "Roles y Perfiles" — así se aplica el bloqueo de acceso en la siguiente
// navegación/refresco, sin cachear permisos en el cliente.
export class PermissionDeniedError extends Error {}

export type LoginResult = {
  success: boolean;
  token?: string;
  role?: 'admin' | 'cliente' | 'terapeuta';
  user?: { id: string; name: string; email: string };
  onboardingComplete?: boolean;
  // true cuando el admin le asignó una contraseña temporal al crear la
  // cuenta — el login debe mandar a definir una nueva antes de entrar.
  mustChangePassword?: boolean;
  clientType?: string;
  permissions?: Record<string, boolean>;
  // "Puedo acceder a este módulo" ya resuelto por el backend contra la
  // matriz de Roles y Perfiles (client_type_module_permissions) + los
  // permisos finos del cliente — ver ClientTopbar.tsx, que lo usa para
  // decidir el ícono de candado sin mantener su propia lista aparte.
  moduleAccess?: Record<string, boolean>;
  planExpired?: boolean;
  planEndDate?: string;
  // Idioma de la interfaz fija (Configuración > Idioma) — 'es' | 'en'.
  language?: string;
  error?: string;
};

// Payload que produce AceptacionRegistro.jsx al completar el paso legal —
// usado hoy por el flujo de re-aceptación en el panel de Configuración.
export type LegalAcceptancePayload = {
  dataPolicyVersion: string;
  termsVersion: string;
  acceptedAt: string;
  sensitiveDataConsent: boolean;
};

export type SimpleResult = {
  success: boolean;
  message?: string;
  token?: string;
  error?: string;
};

export type MeResult = {
  success: boolean;
  role?: 'admin' | 'cliente' | 'terapeuta';
  user?: { id: string; name: string; email: string };
  onboardingComplete?: boolean;
  clientType?: string | null;
  permissions?: Record<string, boolean>;
  moduleAccess?: Record<string, boolean>;
  planExpired?: boolean;
  planEndDate?: string | null;
  language?: string;
  error?: string;
};

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
}

export async function fetchGoogleClientId(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const data: { success: boolean; googleClientId: string | null } = await res.json();
    return data.googleClientId ?? null;
  } catch {
    return null;
  }
}

export async function fetchAppleClientId(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const data: { success: boolean; appleClientId: string | null } = await res.json();
    return data.appleClientId ?? null;
  } catch {
    return null;
  }
}

export async function appleLoginRequest(identityToken: string, name?: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken, name }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
}

export async function googleLoginRequest(credential: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
}

export async function forgotPasswordRequest(email: string): Promise<SimpleResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<SimpleResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
}

// Canjea el token de invitación (alta de cliente Mentoría) por una
// contraseña + sesión activa — devuelve el mismo shape que loginRequest
// porque el backend hace auto-login (ver auth.controller.ts::acceptInvitation).
export async function acceptInvitationRequest(token: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/accept-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
}

export async function changePasswordRequest(currentPassword: string, newPassword: string): Promise<SimpleResult> {
  try {
    const token = getSessionToken();
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Error de conexión. Intenta de nuevo.' };
  }
}

// Lanzado únicamente cuando el token en sí es inválido/expiró (401/403) —
// distinto de un fallo transitorio de red o del servidor, que no debe cerrar
// una sesión recién iniciada (ver refreshAuth en auth-context.tsx).
export class AuthInvalidError extends Error {}

export async function fetchAuthMe(): Promise<MeResult> {
  const token = getSessionToken();
  if (!token) throw new AuthInvalidError('No hay sesión activa.');
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new AuthInvalidError('Sesión inválida o expirada.');
  }
  const data: MeResult = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo validar la sesión.');
  return data;
}

// Decodifica el payload de un JWT en el cliente sin verificar la firma
// (la firma ya fue validada por el backend al emitir/aceptar el token).
export function decodeTokenPayload<T>(token: string): T | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = decodeURIComponent(
      atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// Session helpers mínimos
// El middleware de Next.js corre en el servidor y solo puede leer cookies,
// no sessionStorage — por eso el token se espeja también en una cookie.
export function saveSession(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('latribu_token', token);
  document.cookie = `latribu_token=${token}; path=/; SameSite=Lax`;
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('latribu_token');
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('latribu_token');
  document.cookie = 'latribu_token=; path=/; max-age=0';
}

