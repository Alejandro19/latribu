"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  getSessionToken,
  saveSession,
  clearSession,
  fetchAuthMe,
  loginRequest,
  decodeTokenPayload,
  AuthInvalidError,
  type LoginResult,
} from "./api-client";

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthState = {
  token: string | null;
  role: "admin" | "cliente" | "terapeuta" | null;
  user: AuthUser | null;
  permissions: Record<string, boolean>;
  moduleAccess: Record<string, boolean>;
  clientType: string | null;
  onboardingComplete: boolean;
  planExpired: boolean;
  planEndDate: string | null;
  // Idioma de la interfaz fija (Configuración > Idioma) — 'es' | 'en', 'es' por defecto.
  language: string;
  isLoading: boolean;
  isAuthLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  showAuthLoading: () => void;
  hideAuthLoading: () => void;
  // Actualiza el estado en memoria de inmediato (toda la app cambia de
  // idioma sin recargar) — quien llame a esto es responsable de persistirlo
  // en el backend (ver PanelConfiguracion.jsx).
  setLanguage: (language: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  token: null,
  role: null,
  user: null,
  permissions: {},
  moduleAccess: {},
  clientType: null,
  onboardingComplete: false,
  planExpired: false,
  planEndDate: null,
  language: "es",
  isLoading: true,
  isAuthLoading: false,
};

function decodeUserFromToken(token: string): AuthUser | null {
  const payload = decodeTokenPayload<{ id?: string; name?: string; email?: string }>(token);
  if (!payload?.id) return null;
  return { id: payload.id, name: payload.name ?? "", email: payload.email ?? "" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const showAuthLoading = useCallback(() => {
    setState((prev) => ({ ...prev, isAuthLoading: true }));
  }, []);

  const hideAuthLoading = useCallback(() => {
    setState((prev) => ({ ...prev, isAuthLoading: false }));
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setState({ ...initialState, isLoading: false, isAuthLoading: false });
  }, []);

  const refreshAuth = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      setState((prev) => ({ ...prev, isLoading: false, isAuthLoading: false }));
      return;
    }
    // Justo después de un login (ej. redirect de NFC a través de un túnel),
    // esta primera llamada a /auth/me puede fallar por un motivo transitorio
    // (red, cold-start del túnel) sin que el token en sí sea inválido —
    // tratarlo igual que un 401 real cerraba una sesión recién iniciada y
    // obligaba a loguearse dos veces. Solo un AuthInvalidError (401/403)
    // cierra sesión de inmediato; cualquier otro fallo reintenta un par de
    // veces antes de darse por vencido.
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await fetchAuthMe();
        setState({
          token,
          role: data.role ?? null,
          user: data.user ?? decodeUserFromToken(token),
          permissions: data.permissions ?? {},
          moduleAccess: data.moduleAccess ?? {},
          clientType: data.clientType ?? null,
          onboardingComplete: !!data.onboardingComplete,
          planExpired: !!data.planExpired,
          planEndDate: data.planEndDate ?? null,
          language: data.language ?? "es",
          isLoading: false,
          isAuthLoading: false,
        });
        return;
      } catch (e: unknown) {
        const isAuthInvalid = e instanceof AuthInvalidError;
        if (!isAuthInvalid && attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }
        // Token realmente inválido (JWT_SECRET diferente entre APIs, expirado,
        // cuenta inactiva) o fallo transitorio persistente tras reintentar:
        // limpiar sesión y forzar redirect a login para que el middleware de
        // Next.js redirija correctamente. Sin window.location.href, las
        // páginas protegidas harían flash del contenido antes de redirigir.
        clearSession();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        setState({ ...initialState, isLoading: false, isAuthLoading: false });
        return;
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    if (result.success && result.token) {
      saveSession(result.token);
      setState({
        token: result.token,
        role: result.role ?? null,
        user: result.user ?? decodeUserFromToken(result.token),
        permissions: result.permissions ?? {},
        moduleAccess: result.moduleAccess ?? {},
        clientType: result.clientType ?? null,
        onboardingComplete: !!result.onboardingComplete,
        planExpired: !!result.planExpired,
        planEndDate: result.planEndDate ?? null,
        language: result.language ?? "es",
        isLoading: false,
        isAuthLoading: false,
      });
    }
    return result;
  }, []);

  const setLanguage = useCallback((language: string) => {
    setState((prev) => ({ ...prev, language }));
  }, []);

  useEffect(() => { refreshAuth(); }, [refreshAuth]);

  const value: AuthContextValue = {
    ...state, login, logout, refreshAuth,
    showAuthLoading, hideAuthLoading, setLanguage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}