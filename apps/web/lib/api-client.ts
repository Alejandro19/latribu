// ============================================================
// FASE 0 — API CLIENT SIMPLIFICADO
// URL base hardcodeada a localhost:3003. Sin cachés ni interceptores.
// ============================================================

const API_BASE = 'http://localhost:3003/api';

export type LoginResult = {
  success: boolean;
  token?: string;
  role?: 'admin' | 'cliente';
  user?: { id: string; name: string; email: string };
  onboardingComplete?: boolean;
  clientType?: string;
  permissions?: Record<string, boolean>;
  planExpired?: boolean;
  planEndDate?: string;
  error?: string;
  // Cuenta nueva creada por Google, queda inactiva hasta que un admin la confirme.
  pending?: boolean;
  message?: string;
};

export type RegisterResult = {
  success: boolean;
  token?: string;
  user?: { id: string; name: string; email: string };
  error?: string;
};

export type MeResult = {
  success: boolean;
  role?: 'admin' | 'cliente';
  user?: { id: string; name: string; email: string };
  onboardingComplete?: boolean;
  clientType?: string | null;
  permissions?: Record<string, boolean>;
  planExpired?: boolean;
  planEndDate?: string | null;
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

export async function registerRequest(name: string, email: string, password: string): Promise<RegisterResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
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

export async function fetchAuthMe(): Promise<MeResult> {
  const token = getSessionToken();
  if (!token) throw new Error('No hay sesión activa.');
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

