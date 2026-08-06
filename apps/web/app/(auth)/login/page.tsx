'use client';

import React, { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  loginRequest, saveSession, type LoginResult,
  fetchGoogleClientId, googleLoginRequest,
  fetchAppleClientId, appleLoginRequest,
} from '@/lib/api-client';

// Tipado mínimo de los namespaces globales que inyectan los scripts de
// Google Identity Services y Sign in with Apple JS (cargados en layout.tsx)
// — ninguno de los dos publica un paquete npm oficial con tipos.
type GoogleCredentialResponse = { credential: string };
interface GoogleIdentityNamespace {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        use_fedcm_for_prompt?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: { theme?: string; size?: string; shape?: string; width?: number; text?: string }
      ) => void;
    };
  };
}
type AppleAuthorizationResponse = {
  authorization: { id_token: string; code: string; state?: string };
  user?: { name?: { firstName?: string; lastName?: string }; email?: string };
};
interface AppleIDNamespace {
  auth: {
    init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
    signIn: () => Promise<AppleAuthorizationResponse>;
  };
}
declare global {
  interface Window {
    google?: GoogleIdentityNamespace;
    AppleID?: AppleIDNamespace;
  }
}

// ============================================================
// FASE 0 — PÁGINA DE LOGIN AUTOCONTENIDA (CERO DEPENDENCIAS EXTERNAS)
// Split Screen: izquierda (identidad La Tribu) / derecha (formulario)
// Tema día/noche por hora real del dispositivo (no prefers-color-scheme),
// portado 1:1 del front antiguo: antes de las 18:00 tema "light", desde
// las 18:00 tema "dark" — los paneles hero/formulario intercambian toda
// su paleta entre uno y otro (ver .theme-login-* en globals.css).
// ============================================================

// Código fuente del script que fija el tema en <html> ANTES del primer
// pintado (se ejecuta durante el parseo del HTML, antes de que React
// hidrate) — así no hay flash del tema equivocado ni salto de color al
// refrescar la página.
const LOGIN_THEME_SCRIPT = `(function(){try{
  var h=new Date().getHours();
  var theme=h<18?'theme-login-light':'theme-login-dark';
  var other=theme==='theme-login-light'?'theme-login-dark':'theme-login-light';
  var root=document.documentElement;
  if(!root.classList.contains(theme))root.classList.add(theme);
  root.classList.remove(other);
}catch(e){}})();`;

function applyLoginTheme(): void {
  const hour = new Date().getHours();
  const theme = hour < 18 ? 'theme-login-light' : 'theme-login-dark';
  const other = theme === 'theme-login-light' ? 'theme-login-dark' : 'theme-login-light';
  const root = document.documentElement;
  if (!root.classList.contains(theme)) root.classList.add(theme);
  root.classList.remove(other);
}

export default function LoginPage(): React.ReactElement {
  const [view, setView] = useState<'login' | 'register'>('login');

  // --- Login state ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // --- Register state ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  // --- Pantalla transitoria de entrada (login normal y Google comparten esto) ---
  const [enteringLabel, setEnteringLabel] = useState<string | null>(null);

  // --- Mensaje de "cuenta pendiente de confirmar" (Google o Apple) ---
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // --- Google Sign-In ---
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);

  // --- Apple Sign-In ---
  // appleReady solo pasa a true si el backend tiene APPLE_CLIENT_ID
  // configurado (vía /api/config) — mientras tanto se muestra el botón
  // deshabilitado de más abajo. El SDK y el flujo ya quedan completos acá,
  // listos para activarse solos apenas exista la cuenta de desarrollador.
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    // Cubre navegación interna (SPA) hacia /login, donde el <script>
    // inline no vuelve a ejecutarse. Redundante pero inofensivo en la
    // carga inicial (mismo tema, sin parpadeo).
    applyLoginTheme();
    const interval = setInterval(applyLoginTheme, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retriesLeft = 60;
    // Se pide en paralelo con la espera del script, no después — así no se
    // suman los dos tiempos de espera (script listo + ida y vuelta a /api/config).
    const clientIdPromise = fetchGoogleClientId();

    async function handleGoogleCredentialResponse(response: GoogleCredentialResponse): Promise<void> {
      setLoginError(null);
      setAuthMessage(null);
      setEnteringLabel('Cargando sesión…');
      let navigating = false;
      try {
        const result = await googleLoginRequest(response.credential);
        if (result.pending) {
          setAuthMessage(result.message || 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.');
          return;
        }
        if (!result.success || !result.token) {
          setLoginError(result.error || 'No se pudo iniciar sesión con Google.');
          return;
        }
        saveSession(result.token);
        navigating = true;
        window.location.href = '/';
      } finally {
        // Si hubo éxito, el overlay se deja visible a propósito: cubre hasta
        // que "/" termine de cargar, en vez de mostrar un instante de login
        // sin cambios antes de que arranque la navegación completa.
        if (!navigating) setEnteringLabel(null);
      }
    }

    // El script de Google (accounts.google.com/gsi/client, cargado con
    // strategy="beforeInteractive" en layout.tsx) normalmente ya está listo
    // para cuando este efecto corre, pero se reintenta con backoff corto en
    // vez de asumirlo, por si la red va lenta.
    async function initGoogleSignIn(): Promise<void> {
      if (cancelled) return;
      if (typeof window === 'undefined' || !window.google?.accounts) {
        if (retriesLeft > 0) {
          retriesLeft -= 1;
          setTimeout(initGoogleSignIn, 100);
        }
        return;
      }
      const clientId = await clientIdPromise;
      if (cancelled || !clientId || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        // FedCM: diálogo nativo del navegador en vez del popup con la
        // pantalla completa de accounts.google.com — bastante más rápido y
        // es el flujo que Google recomienda de aquí en adelante.
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        width: 280,
        text: 'continue_with',
      });
      setGoogleReady(true);
    }

    initGoogleSignIn();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retriesLeft = 60;
    const clientIdPromise = fetchAppleClientId();

    // Mismo patrón: reintenta con backoff corto hasta que el SDK de Apple
    // (cargado con strategy="beforeInteractive" en layout.tsx) esté listo.
    async function initAppleSignIn(): Promise<void> {
      if (cancelled) return;
      if (typeof window === 'undefined' || !window.AppleID?.auth) {
        if (retriesLeft > 0) {
          retriesLeft -= 1;
          setTimeout(initAppleSignIn, 100);
        }
        return;
      }
      const clientId = await clientIdPromise;
      // Sin APPLE_CLIENT_ID en el backend, el botón se queda en su versión
      // deshabilitada (ver JSX) — el resto de la lógica ya queda lista para
      // cuando exista la cuenta de desarrollador de Apple.
      if (cancelled || !clientId) return;
      window.AppleID.auth.init({
        clientId,
        scope: 'name email',
        redirectURI: `${window.location.origin}/login`,
        usePopup: true,
      });
      setAppleReady(true);
    }

    initAppleSignIn();
    return () => { cancelled = true; };
  }, []);

  async function handleAppleClick(): Promise<void> {
    if (!window.AppleID?.auth) return;
    setLoginError(null);
    setAuthMessage(null);
    try {
      const response = await window.AppleID.auth.signIn();
      // Apple solo manda el nombre la primera vez que el usuario autoriza
      // la app — en logins posteriores response.user viene undefined.
      const fullName = response.user?.name
        ? [response.user.name.firstName, response.user.name.lastName].filter(Boolean).join(' ')
        : undefined;
      setEnteringLabel('Cargando sesión…');
      let navigating = false;
      try {
        const result = await appleLoginRequest(response.authorization.id_token, fullName);
        if (result.pending) {
          setAuthMessage(result.message || 'Tu cuenta fue creada y quedará activa cuando el administrador la confirme.');
          return;
        }
        if (!result.success || !result.token) {
          setLoginError(result.error || 'No se pudo iniciar sesión con Apple.');
          return;
        }
        saveSession(result.token);
        navigating = true;
        window.location.href = '/';
      } finally {
        if (!navigating) setEnteringLabel(null);
      }
    } catch {
      // Cerrar el popup de Apple sin completar el login también cae acá —
      // no es un error real del usuario, así que no se muestra nada.
    }
  }

  async function handleLogin(e: FormEvent): Promise<void> {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    let navigating = false;
    try {
      const result: LoginResult = await loginRequest(loginEmail, loginPassword);
      if (!result.success || !result.token) {
        setLoginError(result.error || 'Error al iniciar sesión.');
        return;
      }
      if (typeof window !== 'undefined') {
        saveSession(result.token);
        // Igual que el login con Google: el anillo cubre el tramo hasta que
        // "/" termine de cargar, en vez de un instante de login sin cambios.
        setEnteringLabel('Cargando sesión…');
        navigating = true;
        window.location.href = '/';
      }
    } catch {
      setLoginError('Error de conexión. Intenta de nuevo.');
    } finally {
      if (!navigating) setLoginLoading(false);
    }
  }

  async function handleRegister(e: FormEvent): Promise<void> {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirm) {
      setRegError('Las contraseñas no coinciden.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setRegLoading(true);
    try {
      const res = await fetch('http://localhost:3003/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
      });
      const data: LoginResult = await res.json();
      if (!data.success || !data.token) {
        setRegError(data.error || 'Error al registrarse.');
        return;
      }
      if (typeof window !== 'undefined') {
        saveSession(data.token);
        window.location.href = '/';
      }
    } catch {
      setRegError('Error de conexión. Intenta de nuevo.');
    } finally {
      setRegLoading(false);
    }
  }

  const inputClasses: string = 'block w-full h-11 rounded-xl px-4 text-sm transition-all duration-200 ease-in-out outline-none bg-[var(--lf-input-bg)] border border-[var(--lf-input-border)] text-[var(--lf-input-text)] placeholder:text-[var(--lf-label)] placeholder:opacity-60 focus:border-[var(--lf-link)] focus:ring-4 focus:ring-[var(--lf-link)]/10';
  const labelClasses: string = 'block text-sm font-medium text-[var(--lf-label)] transition-colors duration-[600ms]';

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script dangerouslySetInnerHTML={{ __html: LOGIN_THEME_SCRIPT }} />

      {/* Pantalla transitoria mientras se procesa el login (con Google o con
          email/contraseña) y se entra a la plataforma — cubre el tramo hasta
          la navegación a "/", que si no se cubre se ve como si "regresara"
          al login sin cambios por un instante. */}
      {enteringLabel && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[var(--cream)]">
          <svg className="animate-spin" viewBox="0 0 100 100" width="64" height="64" aria-hidden="true" style={{ animationDuration: '1.4s' }}>
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray="76 176" strokeDashoffset="0" opacity=".7" stroke="var(--ring-morning)" />
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray="76 176" strokeDashoffset="-83.8" opacity=".7" stroke="var(--ring-afternoon)" />
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray="76 176" strokeDashoffset="-167.6" opacity=".7" stroke="var(--ring-evening)" />
          </svg>
          <div className="flex flex-col items-center gap-1">
            <p className="font-serif text-xl font-bold text-[var(--ink)]">La Tribu</p>
            <p className="text-sm text-[var(--ink-soft)]">{enteringLabel}</p>
          </div>
        </div>
      )}

      <div className="min-h-screen w-full bg-[var(--cream)] flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden shadow-[0_30px_80px_-15px_rgba(43,36,32,0.18)]">

          {/* ========== LADO IZQUIERDO — IDENTIDAD LA TRIBU ========== */}
          <div className="relative overflow-hidden p-12 flex flex-col items-center justify-center text-center bg-[var(--lh-bg)] transition-colors duration-[600ms]">
            <div className="absolute w-[280px] h-[280px] rounded-full blur-[50px] opacity-40 pointer-events-none -top-[70px] -left-[70px]" style={{ background: '#D9A441' }} />
            <div className="absolute w-[280px] h-[280px] rounded-full blur-[50px] opacity-40 pointer-events-none -bottom-[90px] left-[28%]" style={{ background: '#7C8B6F' }} />
            <div className="absolute w-[280px] h-[280px] rounded-full blur-[50px] opacity-40 pointer-events-none top-[15%] -right-[90px]" style={{ background: '#8A5FA0' }} />

            <svg className="relative z-[1] -rotate-90" viewBox="0 0 100 100" width="56" height="56" aria-hidden="true">
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray="76 176" strokeDashoffset="0" opacity=".5" stroke="var(--ring-morning)" />
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray="76 176" strokeDashoffset="-83.8" opacity=".5" stroke="var(--ring-afternoon)" />
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray="76 176" strokeDashoffset="-167.6" opacity=".5" stroke="var(--ring-evening)" />
            </svg>
            <h1 className="relative z-[1] font-serif text-[32px] font-bold text-[var(--lh-word)] mt-[18px] mb-1.5 transition-colors duration-[600ms]">La Tribu</h1>
            <p className="relative z-[1] font-serif italic text-[15px] text-[var(--lh-slogan)] transition-colors duration-[600ms]">Comunidad de bienestar y alto rendimiento.</p>
          </div>

          {/* ========== LADO DERECHO — FORMULARIO ========== */}
          <div className="bg-[var(--lf-bg)] p-12 flex flex-col justify-center transition-colors duration-[600ms]">
            <h2 className="text-2xl font-semibold tracking-tight mb-6 text-[var(--lf-title)] transition-colors duration-[600ms]">
              {view === 'login' ? 'Qué bueno verte de nuevo' : 'Crea tu cuenta premium'}
            </h2>

            {view === 'login' ? (
              <form onSubmit={handleLogin} className="w-full space-y-4" noValidate>
                {loginError && (
                  <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {loginError}
                  </div>
                )}
                {authMessage && (
                  <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                    {authMessage}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className={labelClasses}>Email</label>
                  <input id="login-email" type="email" autoComplete="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="login-password" className={labelClasses}>Contraseña</label>
                  <input id="login-password" type="password" autoComplete="current-password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" className={inputClasses} />
                </div>
                <button type="submit" disabled={loginLoading} className="relative inline-flex w-full items-center justify-center h-11 rounded-xl bg-[var(--lf-btn-bg)] text-[var(--lf-btn-text)] font-semibold tracking-wide transition-all duration-200 ease-out active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 gap-2">
                  {loginLoading ? (<span className="flex items-center gap-2"><svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>Ingresando…</span>) : 'Entrar'}
                </button>

                {(googleReady || appleReady) && (
                  <div className="flex items-center gap-2.5 my-4">
                    <span className="flex-1 h-px bg-[var(--lf-input-border)] transition-colors duration-[600ms]" />
                    <span className="text-[11px] uppercase tracking-wide text-[var(--lf-foot)] transition-colors duration-[600ms]">o</span>
                    <span className="flex-1 h-px bg-[var(--lf-input-border)] transition-colors duration-[600ms]" />
                  </div>
                )}
                {/* Google Identity Services renderiza su propio botón (iframe) acá dentro */}
                <div ref={googleButtonRef} className="flex justify-center" />

                {appleReady ? (
                  <button
                    type="button"
                    onClick={handleAppleClick}
                    className="w-full h-11 mt-2.5 rounded-xl bg-black text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.08-2.383 1.39-2.383 4.26 0 3.4 2.982 4.55 3.043 4.57z" />
                    </svg>
                    Continuar con Apple
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Próximamente"
                    aria-disabled="true"
                    className="w-full h-11 mt-2.5 rounded-xl border border-[var(--lf-input-border)] bg-[var(--lf-input-bg)] text-[var(--lf-input-text)] text-sm font-medium flex items-center justify-center gap-2 opacity-60 cursor-not-allowed transition-colors duration-[600ms]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.08-2.383 1.39-2.383 4.26 0 3.4 2.982 4.55 3.043 4.57z" />
                    </svg>
                    Continuar con Apple
                  </button>
                )}
              </form>
            ) : (
              <form onSubmit={handleRegister} className="w-full space-y-4" noValidate>
                {regError && (
                  <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {regError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="register-name" className={labelClasses}>Nombre completo</label>
                  <input id="register-name" type="text" autoComplete="name" required value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Tu nombre completo" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="register-email" className={labelClasses}>Email</label>
                  <input id="register-email" type="email" autoComplete="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="register-password" className={labelClasses}>Contraseña</label>
                  <input id="register-password" type="password" autoComplete="new-password" required value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="register-confirm" className={labelClasses}>Confirmar contraseña</label>
                  <input id="register-confirm" type="password" autoComplete="new-password" required value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} placeholder="Repite tu contraseña" className={inputClasses} />
                </div>
                <button type="submit" disabled={regLoading} className="relative inline-flex w-full items-center justify-center h-11 rounded-xl bg-[var(--lf-btn-bg)] text-[var(--lf-btn-text)] font-semibold tracking-wide transition-all duration-200 ease-out active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 gap-2">
                  {regLoading ? (<span className="flex items-center gap-2"><svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>Creando cuenta…</span>) : 'Crear cuenta'}
                </button>
              </form>
            )}

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => { setView(view === 'login' ? 'register' : 'login'); setLoginError(null); setRegError(null); }}
                className="text-[var(--lf-link)] hover:opacity-80 underline underline-offset-4 transition-colors duration-[600ms] font-medium text-sm"
              >
                {view === 'login' ? '¿Aún no tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
