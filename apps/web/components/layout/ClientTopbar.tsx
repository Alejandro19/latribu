"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { useTranslation } from "../../lib/i18n/useTranslation";
import { CLIENT_NAV, VIEW_TO_PATH, type AppState } from "../../lib/constants";
import { getModuleAccessState } from "../../lib/module-access";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { useThemeMode } from "./ThemeRoot";
import Isotipo from "../ui/Isotipo";
import { CrownBadge } from "../ui/CrownBadge";
import { ModuleExpiredModal } from "./ModuleExpiredModal";
import { IconLock, IconSettings, IconLogout } from "../ui/icons";

type ClientTopbarProps = {
  viewKey: string;
};

const COLLAPSE_BREAKPOINT = 1280;

// Fila simple de ícono + texto para el dropdown de la cuenta — pensada para
// que agregar una opción nueva sea sumar una fila más, no rediseñar el
// dropdown (antes eran botones-píldora con borde propio, no escalaba bien).
function AccountMenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="font-body"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 9,
        background: hover ? "var(--eph-surface-2)" : "transparent", border: "none",
        padding: "9px 14px", fontSize: 12.5, fontWeight: 400,
        color: "var(--eph-body)", cursor: "pointer", textAlign: "left",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", color: "var(--eph-muted)" }}>{icon}</span>
      {label}
    </button>
  );
}

// Acceso directo de logout en la cabecera (spec §7.4) — mismo tratamiento
// fantasma que la campana (34×34, borde solo en hover). No reemplaza el
// "Cerrar sesión" del menú de la cuenta, solo agrega un atajo.
function HeaderLogoutButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Cerrar sesión"
      style={{
        width: 34,
        height: 34,
        background: "transparent",
        border: `1px solid ${hover ? "var(--eph-line-2)" : "transparent"}`,
        borderRadius: "50%",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: hover ? "var(--eph-text)" : "var(--eph-body)",
        transition: "color 180ms ease, border-color 180ms ease",
      }}
    >
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.2 4.6H18a1.4 1.4 0 0 1 1.4 1.4v12a1.4 1.4 0 0 1-1.4 1.4h-3.8" />
        <path d="M9.6 8.4 5.4 12l4.2 3.6M5.4 12h9" />
      </svg>
    </button>
  );
}

export default function ClientTopbar({ viewKey }: ClientTopbarProps) {
  const router = useRouter();
  const { user, clientType, onboardingComplete, moduleAccess, planExpired, logout } = useAuth();
  const { t } = useTranslation();
  const { isBrandLocked } = useThemeMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [expiredModalOpen, setExpiredModalOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback(
    (key: string) => {
      const path = VIEW_TO_PATH[key] || `/${key}`;
      router.push(path);
      setDrawerOpen(false);
    },
    [router],
  );

  // Un módulo 'expired' está incluido en la membresía pero se venció — en
  // vez de navegar, se avisa con el modal (ver getModuleAccessState, misma
  // función que usan las cards del home).
  const handleNavClick = useCallback(
    (key: string) => {
      if (getModuleAccessState(key, { moduleAccess, planExpired }) === "expired") {
        setDrawerOpen(false);
        setExpiredModalOpen(true);
        return;
      }
      navigate(key);
    },
    [moduleAccess, planExpired, navigate],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    if (accountOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [accountOpen]);

  const sn: AppState = {
    role: "cliente",
    clientType: clientType ?? null,
    onboardingComplete,
    planExpired: false,
  };

  const items = CLIENT_NAV.filter((item) => (item.visible ? item.visible(sn) : true));
  const initial = (user?.name ?? "U").charAt(0).toUpperCase();

  // Precarga todas las rutas del topbar una vez montado: el set de módulos por
  // rol es chico, así que el siguiente clic ya encuentra el chunk tibio.
  useEffect(() => {
    items.forEach((item) => {
      router.prefetch(VIEW_TO_PATH[item.key] || `/${item.key}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 80,
          display: "flex",
          alignItems: "center",
          gap: 32,
          height: 74,
          padding: "0 clamp(20px, 4vw, 52px)",
          background: "var(--eph-bg)",
          borderBottom: "1px solid var(--eph-line)",
        }}
      >
        <button
          onClick={() => router.push("/")}
          aria-label="Ir al menú principal"
          className="font-display"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 18,
            fontWeight: 400,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--eph-text)",
            flexShrink: 0,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Isotipo size={40} />
          Ephirox
        </button>

        <nav className="client-nav-row" style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, overflowX: "auto" }}>
          {items.map((item) => {
            const active = viewKey === item.key;
            const state = getModuleAccessState(item.key, { moduleAccess, planExpired });
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`client-nav-tab font-mono${active ? " active" : ""}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontWeight: 400,
                  color: active ? "var(--eph-text)" : "var(--eph-muted)",
                  padding: "8px 12px",
                  position: "relative",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {item.label}
                  {state === "expired" && <CrownBadge circleSize={14} iconSize={8} />}
                  {state === "not_included" && <IconLock size={10} />}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="client-topbar-actions" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: "auto" }}>
          <ThemeToggle />
          {!isBrandLocked && <span style={{ width: 1, height: 20, background: "var(--eph-line-2)", margin: "0 2px" }} />}
          <NotificationBell />
          <HeaderLogoutButton onClick={logout} />
          <div ref={accountRef} style={{ position: "relative" }}>
            <button
              onClick={() => setAccountOpen((v) => !v)}
              aria-label="Membresía"
              className="font-mono"
              style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "1px solid var(--eph-line-2)",
                background: accountOpen ? "var(--eph-accent)" : "transparent",
                color: accountOpen ? "var(--eph-ink)" : "var(--eph-text)",
                fontSize: 12, fontWeight: 400, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              {initial}
            </button>
            {accountOpen && (
              <div style={{
                position: "absolute", top: 40, right: 0, width: 200,
                background: "var(--eph-surface)", border: "1px solid var(--eph-line)",
                borderRadius: 0, padding: "6px 0", zIndex: 90,
                overflow: "hidden",
              }}>
                <div className="font-body" style={{
                  fontSize: 13, fontWeight: 500, color: "var(--eph-text)",
                  padding: "8px 14px 10px", borderBottom: "1px solid var(--eph-line)",
                }}>
                  {user?.name ?? t('nav.member')}
                </div>
                {/* Navegación — agregar futuras filas acá (mismo AccountMenuRow) */}
                <div style={{ padding: "4px 0", borderBottom: "1px solid var(--eph-line)" }}>
                  <AccountMenuRow
                    icon={<IconSettings size={14} />}
                    label={t('settings.title')}
                    onClick={() => {
                      setAccountOpen(false);
                      router.push("/configuracion");
                    }}
                  />
                </div>
                {/* Sesión */}
                <div style={{ padding: "4px 0" }}>
                  <AccountMenuRow icon={<IconLogout size={14} />} label={t('nav.logout')} onClick={logout} />
                </div>
              </div>
            )}
          </div>
          <button
            className="client-hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            style={{
              display: "none", background: "none", border: "none",
              padding: 6, flexDirection: "column", gap: 4, cursor: "pointer",
            }}
          >
            <span style={{ display: "block", width: 20, height: 1, background: "var(--eph-text)" }} />
            <span style={{ display: "block", width: 20, height: 1, background: "var(--eph-text)" }} />
            <span style={{ display: "block", width: 20, height: 1, background: "var(--eph-text)" }} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 105 }}
        />
      )}
      <div
        className={`client-drawer${drawerOpen ? " open" : ""}`}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "82vw", maxWidth: 300,
          background: "var(--eph-bg)", borderLeft: "1px solid var(--eph-line)", zIndex: 110, padding: "24px 20px",
          transition: "transform 0.28s ease",
          display: "flex", flexDirection: "column", gap: 4,
        }}
      >
        <span className="font-display" style={{ fontSize: 17, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--eph-text)", marginBottom: 16 }}>
          Ephirox
        </span>
        {items.map((item) => {
          const active = viewKey === item.key;
          const state = getModuleAccessState(item.key, { moduleAccess, planExpired });
          return (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              className="font-body"
              style={{
                background: "none", border: "none", textAlign: "left", cursor: "pointer",
                padding: "12px 4px", fontSize: 14,
                fontWeight: active ? 500 : 400,
                color: active ? "var(--eph-text)" : "var(--eph-body)",
                borderBottom: "1px solid var(--eph-line)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {item.label}
                {state === "expired" && <CrownBadge circleSize={14} iconSize={8} />}
                {state === "not_included" && <IconLock size={11} />}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => {
            setDrawerOpen(false);
            router.push("/configuracion");
          }}
          className="font-mono"
          style={{
            marginTop: "auto", background: "none", border: "1px solid var(--eph-line-2)",
            borderRadius: 0, padding: "10px 16px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--eph-body)", cursor: "pointer",
          }}
        >
          {t('settings.title')}
        </button>
        <button
          onClick={logout}
          className="font-mono"
          style={{
            marginTop: 8, background: "none", border: "1px solid var(--eph-line-2)",
            borderRadius: 0, padding: "10px 16px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--eph-body)", cursor: "pointer",
          }}
        >
          {t('nav.logout')}
        </button>
      </div>

      <ModuleExpiredModal open={expiredModalOpen} onClose={() => setExpiredModalOpen(false)} />

      <style jsx>{`
        .client-nav-tab::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 2px;
          height: 1px;
          background: var(--eph-accent);
          width: 0%;
          transition: width 0.18s ease;
        }
        .client-nav-tab:hover::after {
          width: calc(100% - 24px);
        }
        .client-nav-tab.active::after {
          width: calc(100% - 24px);
        }
        .client-nav-row::-webkit-scrollbar {
          display: none;
        }
        .client-drawer {
          transform: translateX(100%);
        }
        .client-drawer.open {
          transform: translateX(0);
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
        }
        @media (max-width: ${COLLAPSE_BREAKPOINT}px) {
          .client-nav-row {
            display: none !important;
          }
          .client-hamburger {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
