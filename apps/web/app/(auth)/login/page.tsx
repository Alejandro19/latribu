'use client';

import React, { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import {
  loginRequest, saveSession, type LoginResult,
  fetchGoogleClientId, googleLoginRequest,
  fetchAppleClientId, appleLoginRequest,
  forgotPasswordRequest,
} from '@/lib/api-client';
import { getSafeRedirectTarget, getSetPasswordUrl } from '@/lib/login-redirect';
import Isotipo from '@/components/ui/Isotipo';
import Button from '@/components/ui/Button';

// "Recuérdame" solo guarda el email localmente (nunca la contraseña — un
// checkbox de la app no debe controlar si se persiste texto plano de una
// contraseña en el navegador). El gestor de contraseñas nativo del
// navegador, activado por autoComplete="current-password", ya cubre el
// caso de recordar la contraseña de forma segura.
const REMEMBER_EMAIL_KEY = 'latribu_remember_email';

// Tipado mínimo de los namespaces globales que inyectan los scripts de
// Google Identity Services y Sign in with Apple JS (cargados en layout.tsx)
// — ninguno de los dos publica un paquete npm oficial con tipos.
type GoogleCredentialResponse = { credential: string };
type GoogleMomentNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
};
interface GoogleIdentityNamespace {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        use_fedcm_for_prompt?: boolean;
      }) => void;
      prompt: (momentListener?: (notification: GoogleMomentNotification) => void) => void;
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
// PÁGINA DE LOGIN — Split Screen, identidad Ephirox (reskin, ver plan de
// reskin): fondo --eph-bg en toda la pantalla, sin variante día/noche.
// Los valores de abajo apuntan a los tokens --eph-* (no son hex fijos) —
// se usan vía `style` porque las clases Tailwind arbitrarias construidas
// con interpolación de variables JS (`` `border-[${X}]` ``) no generan CSS
// real: el content-scanner de Tailwind lee el texto fuente sin evaluar, así
// que nunca ve el valor final. Donde se necesita una clase (no un `style`),
// el token va escrito literal en el string (ver inputClasses/labelClasses).
// ============================================================

const LOGIN_PANEL_BG = 'var(--eph-bg)';
const FORM_INK_MUTED = 'var(--eph-muted)';
const FORM_BORDER = 'var(--eph-line-2)';
const FORM_ACCENT = 'var(--eph-accent)';
// Anula el padding/tracking por defecto de Button (pensados para pantallas
// de contenido) solo en el login — el CTA de Login es full-width con su
// propio padding/tracking exactos (prototipo aprobado §1), sin tocar el
// componente compartido.
const LOGIN_PRIMARY_BUTTON_STYLE: React.CSSProperties = { minHeight: 0, padding: '19px', fontSize: 11, letterSpacing: '0.26em' };

type LoginView = 'login' | 'forgot';

export default function LoginPage(): React.ReactElement {
  const [view, setView] = useState<LoginView>('login');

  // --- Login state ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // --- Recuperar contraseña ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    const remembered = typeof window !== 'undefined' ? window.localStorage.getItem(REMEMBER_EMAIL_KEY) : null;
    if (remembered) {
      setLoginEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  // --- Pantalla transitoria de entrada (login normal y Google comparten esto) ---
  const [enteringLabel, setEnteringLabel] = useState<string | null>(null);

  // --- Google Sign-In ---
  // Botón propio (texto plano, mismo trato visual que Apple) en vez del
  // widget renderButton() de Google — ese iframe siempre trae el logo G por
  // política de marca de Google, y el prototipo pide "dos botones iguales,
  // solo texto". Se dispara prompt() (One Tap/FedCM) al clic; si el
  // navegador lo bloquea (cookies de terceros, popups) o el usuario lo
  // descartó hace poco (cooldown de Google), el moment listener lo avisa en
  // vez de dejar el botón mudo.
  const googleInitializedRef = useRef(false);
  const [googleReady, setGoogleReady] = useState(false);
  const GOOGLE_APPLE_BUTTON_HEIGHT = 36;

  const handleGoogleClick = useCallback(() => {
    if (typeof window === 'undefined' || !window.google?.accounts) return;
    setLoginError(null);
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setLoginError('No se pudo abrir el inicio de sesión con Google. Revisa que las cookies de terceros no estén bloqueadas e intenta de nuevo.');
      }
    });
  }, []);

  // --- Apple Sign-In ---
  // appleReady solo pasa a true si el backend tiene APPLE_CLIENT_ID
  // configurado (vía /api/config) — mientras tanto se muestra el botón
  // deshabilitado de más abajo. El SDK y el flujo ya quedan completos acá,
  // listos para activarse solos apenas exista la cuenta de desarrollador.
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retriesLeft = 60;
    // Se pide en paralelo con la espera del script, no después — así no se
    // suman los dos tiempos de espera (script listo + ida y vuelta a /api/config).
    const clientIdPromise = fetchGoogleClientId();

    async function handleGoogleCredentialResponse(response: GoogleCredentialResponse): Promise<void> {
      setLoginError(null);
      setEnteringLabel('Calibrando…');
      let navigating = false;
      try {
        const result = await googleLoginRequest(response.credential);
        if (!result.success || !result.token) {
          setLoginError(result.error || 'No se pudo iniciar sesión con Google.');
          return;
        }
        saveSession(result.token);
        navigating = true;
        window.location.href = getSafeRedirectTarget();
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
      if (cancelled || !clientId) return;
      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          // FedCM: diálogo nativo del navegador en vez del popup con la
          // pantalla completa de accounts.google.com — bastante más rápido y
          // es el flujo que Google recomienda de aquí en adelante.
          use_fedcm_for_prompt: true,
        });
        googleInitializedRef.current = true;
      }
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
    try {
      const response = await window.AppleID.auth.signIn();
      // Apple solo manda el nombre la primera vez que el usuario autoriza
      // la app — en logins posteriores response.user viene undefined.
      const fullName = response.user?.name
        ? [response.user.name.firstName, response.user.name.lastName].filter(Boolean).join(' ')
        : undefined;
      setEnteringLabel('Calibrando…');
      let navigating = false;
      try {
        const result = await appleLoginRequest(response.authorization.id_token, fullName);
        if (!result.success || !result.token) {
          setLoginError(result.error || 'No se pudo iniciar sesión con Apple.');
          return;
        }
        saveSession(result.token);
        navigating = true;
        window.location.href = getSafeRedirectTarget();
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
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, loginEmail);
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
        saveSession(result.token);
        // Igual que el login con Google: el anillo cubre el tramo hasta que
        // "/" termine de cargar, en vez de un instante de login sin cambios.
        setEnteringLabel('Calibrando…');
        navigating = true;
        // El admin le asignó una contraseña temporal (checkbox en Crear
        // Usuario) — antes de entrar a la app, tiene que definir una nueva.
        window.location.href = result.mustChangePassword ? getSetPasswordUrl() : getSafeRedirectTarget();
      }
    } catch {
      setLoginError('Error de conexión. Intenta de nuevo.');
    } finally {
      if (!navigating) setLoginLoading(false);
    }
  }

  async function handleForgotPassword(e: FormEvent): Promise<void> {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      const result = await forgotPasswordRequest(forgotEmail);
      if (!result.success) {
        setForgotError(result.error || 'No se pudo procesar la solicitud.');
        return;
      }
      setForgotSent(true);
    } catch {
      setForgotError('Error de conexión. Intenta de nuevo.');
    } finally {
      setForgotLoading(false);
    }
  }

  const inputClasses =
    'block w-full border-0 border-b border-[var(--eph-line-2)] rounded-none bg-transparent px-0 pt-2 pb-3 font-body text-[18px] font-normal text-[var(--eph-text)] outline-none transition-colors placeholder:text-[var(--eph-muted)] placeholder:opacity-70 focus:border-[var(--eph-accent)]';
  const labelClasses =
    'block font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--eph-body)]';

  const socialButtonClasses =
    'w-full rounded-none border font-body flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-150 hover:border-[var(--eph-accent-line)] hover:text-[var(--eph-text)]';
  const socialButtonStyle: React.CSSProperties = {
    background: 'transparent', color: FORM_INK_MUTED, borderColor: FORM_BORDER,
    height: GOOGLE_APPLE_BUTTON_HEIGHT, fontSize: 15,
  };

  const socialButtons = (
    <>
      <div className="flex items-center gap-4 my-4">
        <span className="flex-1 h-px" style={{ background: 'var(--eph-line)' }} />
        <span className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: FORM_INK_MUTED }}>o continúa con</span>
        <span className="flex-1 h-px" style={{ background: 'var(--eph-line)' }} />
      </div>
      {/* Fila de 2 botones idénticos, solo texto (prototipo aprobado): el
          widget nativo de Google (renderButton) siempre trae el logo G por
          política de marca — reemplazado por un botón propio que dispara
          prompt() (ver handleGoogleClick), igual de "custom" que el de
          Apple (que nunca tuvo un widget visual, solo auth.signIn()). */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={googleReady ? handleGoogleClick : undefined}
          disabled={!googleReady}
          title={googleReady ? undefined : 'Cargando…'}
          aria-disabled={!googleReady}
          className={socialButtonClasses}
          style={socialButtonStyle}
        >
          Google
        </button>
        <button
          type="button"
          onClick={appleReady ? handleAppleClick : undefined}
          disabled={!appleReady}
          title={appleReady ? undefined : 'Próximamente'}
          aria-disabled={!appleReady}
          className={socialButtonClasses}
          style={socialButtonStyle}
        >
          Apple
        </button>
      </div>
    </>
  );

  return (
    <>

      {/* Pantalla transitoria mientras se procesa el login (con Google o con
          email/contraseña) y se entra a la plataforma — cubre el tramo hasta
          la navegación a "/", que si no se cubre se ve como si "regresara"
          al login sin cambios por un instante. */}
      {enteringLabel && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5" style={{ background: LOGIN_PANEL_BG }}>
          <svg className="animate-spin" viewBox="0 0 100 100" width="56" height="56" aria-hidden="true" style={{ animationDuration: '1.4s' }}>
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" stroke="rgba(237,230,220,0.14)" />
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" strokeLinecap="butt" strokeDasharray="70 251" stroke={FORM_ACCENT} />
          </svg>
          <div className="flex flex-col items-center gap-1.5">
            <p className="font-display text-xl" style={{ color: 'var(--eph-text)' }}>Ephirox</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: FORM_INK_MUTED }}>{enteringLabel}</p>
          </div>
        </div>
      )}

      <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: LOGIN_PANEL_BG }}>
        {/* md:min-h fija un tamaño de tarjeta estándar — no debe crecer o
            encogerse según cuántos botones tenga cada formulario (login,
            registro, recuperar contraseña). */}
        <div className="max-w-4xl w-full md:min-h-[600px] grid grid-cols-1 md:grid-cols-2 rounded-none border overflow-hidden" style={{ borderColor: 'var(--eph-line-2)', boxShadow: 'var(--eph-shadow)' }}>

          {/* ========== LADO IZQUIERDO — IDENTIDAD EPHIROX ========== */}
          {/* Sin halo ni anillos decorativos alrededor (Prompt 03 §3): el
              halo es un recurso gráfico aparte, nunca parte del logo. */}
          <div className="relative overflow-hidden p-12 flex flex-col items-center justify-center text-center gap-[34px]" style={{ background: 'var(--eph-panel)' }}>
            <Isotipo size={118} />
            <div style={{ textAlign: 'center' }}>
              <div
                className="font-display uppercase"
                style={{ fontWeight: 300, fontSize: 'clamp(34px, 4vw, 46px)', letterSpacing: '0.2em', textIndent: '0.2em', color: 'var(--eph-text)' }}
              >
                Ephirox
              </div>
              <div
                className="font-display italic"
                style={{ fontWeight: 400, fontSize: 22, letterSpacing: '0.02em', color: 'var(--eph-accent)', marginTop: 16 }}
              >
                Redefining limits.
              </div>
            </div>
            <div
              className="font-mono text-center"
              style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: FORM_INK_MUTED, lineHeight: 2.1, marginTop: 8 }}
            >
              Sistema de Optimización Ejecutiva
            </div>
          </div>

          {/* ========== LADO DERECHO — FORMULARIO ========== */}
          {/* --eph-auth (carbón) en vez del mismo fondo que el panel de marca
              — así se lee como una pieza aparte, con su propio hairline. */}
          <div className="p-12 flex flex-col justify-center gap-[30px]" style={{ background: 'var(--eph-auth)', borderLeft: '1px solid var(--eph-line-2)' }}>
            {/* Vista de login: sin título propio — el panel arranca directo en
                el campo Email, centrado en vertical (prototipo aprobado). */}
            {view === 'forgot' && (
              <h2 className="font-display text-[28px] font-normal" style={{ color: 'var(--eph-text)' }}>
                Recuperar contraseña
              </h2>
            )}

            {view === 'forgot' ? (
              <form onSubmit={handleForgotPassword} className="w-full space-y-4" noValidate>
                {forgotError && (
                  <div role="alert" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'rgba(138,74,60,0.14)', color: 'var(--eph-text)' }}>
                    {forgotError}
                  </div>
                )}
                {forgotSent ? (
                  <div role="status" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-line-2)', background: 'var(--eph-surface)', color: 'var(--eph-text)' }}>
                    Si el correo existe, enviaremos instrucciones para restablecer tu contraseña.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label htmlFor="forgot-email" className={labelClasses}>Email</label>
                      <input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className={inputClasses}
                      />
                    </div>
                    <Button type="submit" variant="primary" disabled={forgotLoading} className="w-full" style={LOGIN_PRIMARY_BUTTON_STYLE}>
                      {forgotLoading ? 'Enviando…' : 'Enviar instrucciones'}
                    </Button>
                  </>
                )}
                <div className="text-center mt-6">
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => { setView('login'); setForgotError(null); setForgotSent(false); }}
                  >
                    Volver a iniciar sesión
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="w-full grid" style={{ gap: 30 }} noValidate>
                {loginError && (
                  <div role="alert" className="rounded-none border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'rgba(138,74,60,0.14)', color: 'var(--eph-text)' }}>
                    {loginError}
                  </div>
                )}
                <div className="grid" style={{ gap: 26 }}>
                  <div className="space-y-2.5">
                    <label htmlFor="login-email" className={labelClasses}>Email</label>
                    <input id="login-email" type="email" autoComplete="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={inputClasses} />
                  </div>
                  <div className="space-y-2.5">
                    <label htmlFor="login-password" className={labelClasses}>Contraseña</label>
                    <input id="login-password" type="password" autoComplete="current-password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" className={inputClasses} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <label className="flex items-center gap-3 font-body cursor-pointer select-none" style={{ color: FORM_INK_MUTED, fontSize: 16, lineHeight: 1 }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="block peer-checked:bg-[var(--eph-accent)] peer-checked:border-[var(--eph-accent)]"
                      style={{ width: 15, height: 15, border: `1px solid ${FORM_BORDER}`, background: 'transparent' }}
                    />
                    Recuérdame
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setLoginError(null); }}
                    className="font-body transition-colors duration-150 hover:text-[var(--eph-text)] hover:border-[var(--eph-accent-line)]"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 16, lineHeight: 1, color: FORM_INK_MUTED, borderBottom: '1px solid var(--eph-line)' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <Button type="submit" variant="primary" disabled={loginLoading} className="w-full" style={LOGIN_PRIMARY_BUTTON_STYLE}>
                  {loginLoading ? (<span className="flex items-center gap-2"><svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>Ingresando…</span>) : 'Entrar'}
                </Button>

                {socialButtons}
              </form>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
