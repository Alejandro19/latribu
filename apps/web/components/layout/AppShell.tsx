"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import ClientTopbar from "./ClientTopbar";
import AdminTopbar from "./AdminTopbar";
import { MembershipExpiredBanner } from "./MembershipExpiredBanner";
import AceptacionRegistro from "../auth/AceptacionRegistro";
import { getLegalAcceptance, submitLegalAcceptance, type LegalAcceptancePayload } from "../../lib/account-client";
import { useAuth } from "../../lib/auth-context";
import {
  captureIncomingDeepLink,
  getPendingAction,
  clearPendingAction,
} from "../../lib/deep-link";
import { PATH_TO_VIEW } from "../../lib/constants";
import { IconAlertTriangle, IconCheckCircle } from "../ui/icons";

// ─── Toast System ─────────────────────────────────────────────

type Toast = { id: string; message: string; type?: "success" | "error" | "info" };
let toastId = 0;
const TOAST_LISTENERS = new Set<(toasts: Toast[]) => void>();
let currentToasts: Toast[] = [];

export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  const toast: Toast = { id: String(++toastId), message, type };
  currentToasts = [...currentToasts, toast];
  TOAST_LISTENERS.forEach((fn) => fn(currentToasts));
  setTimeout(() => {
    currentToasts = currentToasts.filter((t) => t.id !== toast.id);
    TOAST_LISTENERS.forEach((fn) => fn(currentToasts));
  }, 4000);
}

// ─── Error Fallback ───────────────────────────────────────────

function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--eph-bg)", padding: 24 }}>
      <div style={{ maxWidth: 400, width: "100%", background: "var(--eph-surface)",
        border: "1px solid var(--eph-line)", borderRadius: 0,
        padding: "32px 28px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--eph-danger)" }}>
          <IconAlertTriangle size={28} />
        </div>
        <h2 className="font-display" style={{ fontSize: 20,
          fontWeight: 400, color: "var(--eph-text)", margin: "0 0 8px" }}>
          Algo salió mal
        </h2>
        <p className="font-body" style={{ fontSize: 13, color: "var(--eph-body)", lineHeight: 1.5,
          margin: "0 0 20px" }}>
          {error.message || "Ha ocurrido un error inesperado."}
        </p>
        <button onClick={onReset} className="font-mono"
          style={{ display: "inline-flex", alignItems: "center", gap: 6,
            borderRadius: 0, background: "var(--eph-accent)", color: "var(--eph-ink)",
            border: "none", padding: "12px 26px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em",
            cursor: "pointer" }}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

// ─── AppShell Component ───────────────────────────────────────

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, isLoading, planExpired, token } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [boundaryError, setBoundaryError] = useState<Error | null>(null);

  // ── Aceptación legal obligatoria ──
  // El único momento en que se registraba antes era el auto-registro público
  // (ya retirado) — un cliente dado de alta a mano por un admin hoy puede
  // entrar sin haber aceptado nada nunca. `acceptance === null` (ya resuelto,
  // no undefined) es la señal de "nunca aceptó" — bloquea toda la app hasta
  // que lo haga, cubriendo tanto cuentas nuevas como clientes activos de
  // antes de este fix.
  const isClientRole = !isLoading && role === "cliente";
  const { data: legalAcceptance, mutate: mutateLegalAcceptance } = useSWR(
    isClientRole ? "app-shell-legal-acceptance" : null,
    getLegalAcceptance,
    { dedupingInterval: 0 }
  );
  async function handleLegalAcceptanceComplete(payload: LegalAcceptancePayload): Promise<void> {
    await submitLegalAcceptance(payload);
    // Deja el mensaje "Todo listo" de AceptacionRegistro visible un momento
    // antes de revelar la app real — mismo tiempo que ya usa la reaceptación
    // voluntaria en Configuración de cuenta.
    setTimeout(() => { void mutateLegalAcceptance(); }, 1500);
  }

  // ── Toast subscription ──
  useEffect(() => {
    TOAST_LISTENERS.add(setToasts);
    return () => { TOAST_LISTENERS.delete(setToasts); };
  }, []);

  // ── Deep link handler ──
  useEffect(() => {
    if (isLoading) return;
    captureIncomingDeepLink(window.location.search);
    const pending = getPendingAction();
    if (pending) {
      clearPendingAction();
      if (pending.m === "entrenamiento" && pending.a === "confirmar") {
        router.push("/training");
      }
    }
  }, [isLoading, router]);

  // ── Auth guard ──
  // logout() (UserChip) solo limpia el token en memoria/storage, no navega —
  // sin esto, cerrar sesión desde una ruta ya montada (ej. /training) deja al
  // usuario viendo la misma página con estado vacío en vez de mandarlo a
  // /login. Cubre logout y expiración/invalidez de token (refreshAuth falla).
  useEffect(() => {
    if (!isLoading && !token) router.push("/login");
  }, [isLoading, token, router]);

  if (!isLoading && !token) return null;

  // ── Error boundary ──
  if (boundaryError) {
    return (
      <ErrorFallback
        error={boundaryError}
        onReset={() => setBoundaryError(null)}
      />
    );
  }

  // ── Loading ──
  // Mismo anillo (mañana/tarde/noche) que la pantalla transitoria del login,
  // para que no haya un salto visual entre "entrando" y "cargando sesión".
  if (isLoading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
        background: "var(--eph-bg)",
      }}>
        <svg className="animate-spin" viewBox="0 0 100 100" width="56" height="56" aria-hidden="true" style={{ animationDuration: "1.4s" }}>
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" stroke="rgba(237,230,220,0.14)" />
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" strokeLinecap="butt" strokeDasharray="70 251" stroke="var(--eph-accent)" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <p className="font-display" style={{ fontSize: 20, fontWeight: 400, color: "var(--eph-text)", margin: 0 }}>Ephirox</p>
          <p className="font-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--eph-muted)", margin: 0 }}>Calibrando…</p>
        </div>
      </div>
    );
  }

  // ── Gate de aceptación legal (solo clientes) ──
  // `legalAcceptance === undefined` todavía no resolvió el fetch — se espera
  // en silencio (mismo spinner de arriba) para no mostrar un parpadeo de la
  // app real antes del gate. `null` ya resuelto y confirmado que nunca aceptó.
  if (isClientRole) {
    if (legalAcceptance === undefined) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 20,
          background: "var(--eph-bg)",
        }}>
          <svg className="animate-spin" viewBox="0 0 100 100" width="56" height="56" aria-hidden="true" style={{ animationDuration: "1.4s" }}>
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" stroke="rgba(237,230,220,0.14)" />
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" strokeLinecap="butt" strokeDasharray="70 251" stroke="var(--eph-accent)" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <p className="font-display" style={{ fontSize: 20, fontWeight: 400, color: "var(--eph-text)", margin: 0 }}>Ephirox</p>
            <p className="font-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--eph-muted)", margin: 0 }}>Calibrando…</p>
          </div>
        </div>
      );
    }
    if (legalAcceptance === null) {
      // AceptacionRegistro.jsx es JS sin tipos — TS infiere onComplete como
      // () => void a partir de su valor por defecto, aunque en tiempo de
      // ejecución sí lo llama con el payload. El cast es solo para el
      // chequeo de tipos, no cambia el comportamiento real.
      return <AceptacionRegistro onComplete={handleLegalAcceptanceComplete as unknown as () => void} />;
    }
  }

  const viewKey = PATH_TO_VIEW[pathname] ?? "training";
  const isAdmin = role === "admin";

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative", flexDirection: "column" }}>
      {isAdmin ? <AdminTopbar viewKey={viewKey} /> : <ClientTopbar viewKey={viewKey} />}
      {planExpired && role === "cliente" && <MembershipExpiredBanner />}
      <main
        id="main-content"
        className="app-main-content"
        style={{
          flex: 1, overflowY: "auto",
          background: "var(--eph-bg)",
        }}
      >
        {children}
      </main>

      {/* ── Toasts ── */}
      {toasts.length > 0 && (
        <div style={{
          position: "fixed", left: "50%", bottom: 30,
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", gap: 8,
          zIndex: 2000, pointerEvents: "none",
        }}>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="font-body"
              style={{
                background: "var(--eph-surface)", color: "var(--eph-text)",
                border: "1px solid var(--eph-line-2)",
                padding: "12px 20px", borderRadius: "999px",
                fontSize: "12.5px", fontWeight: 500,
                display: "flex", alignItems: "center", gap: 8,
                animation: "toast-in 0.35s ease",
              }}
            >
              {toast.type === "error" && <IconAlertTriangle size={14} />}
              {toast.type === "success" && <IconCheckCircle size={14} />}
              {toast.message}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .app-main-content {
          padding: 36px 44px;
        }
        @media (max-width: 640px) {
          .app-main-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </div>
  );
}

