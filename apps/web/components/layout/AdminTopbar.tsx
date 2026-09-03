"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { useTranslation } from "../../lib/i18n/useTranslation";
import { ADMIN_NAV, ADMIN_HUB_SUBITEMS, VIEW_TO_PATH } from "../../lib/constants";
import NotificationBell from "./NotificationBell";
import Isotipo from "../ui/Isotipo";

type AdminTopbarProps = {
  viewKey: string;
};

const COLLAPSE_BREAKPOINT = 1280;
const HUB_SUBKEYS = ADMIN_HUB_SUBITEMS.map((item) => item.key);
const FLAT_NAV = ADMIN_NAV.filter((item) => item.key !== "admin-hub");

export default function AdminTopbar({ viewKey }: AdminTopbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback(
    (key: string) => {
      const path = VIEW_TO_PATH[key] || `/${key}`;
      router.push(path);
      setDrawerOpen(false);
      setHubOpen(false);
    },
    [router],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) setHubOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    if (hubOpen || accountOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [hubOpen, accountOpen]);

  const hubActive = HUB_SUBKEYS.includes(viewKey);
  const initial = (user?.name ?? "A").charAt(0).toUpperCase();

  // Precarga todas las rutas del topbar (incluyendo el submenú de Administración)
  // una vez montado, para que el siguiente módulo ya esté tibio antes del clic.
  useEffect(() => {
    [...ADMIN_HUB_SUBITEMS, ...FLAT_NAV].forEach((item) => {
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
          padding: "0 32px",
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

        <nav className="admin-nav-row" style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <div ref={hubRef} style={{ position: "relative" }}>
            <button
              onClick={() => setHubOpen((v) => !v)}
              className={`admin-nav-tab font-mono${hubActive ? " active" : ""}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 400,
                color: hubActive ? "var(--eph-text)" : "var(--eph-muted)",
                padding: "8px 12px",
                position: "relative",
              }}
            >
              Administration
            </button>
            {hubOpen && (
              <div
                style={{
                  position: "absolute", top: 40, left: 0, minWidth: 180,
                  background: "var(--eph-surface)", border: "1px solid var(--eph-line)",
                  borderRadius: 0, padding: 6, zIndex: 90,
                }}
              >
                {ADMIN_HUB_SUBITEMS.map((sub) => (
                  <button
                    key={sub.key}
                    onClick={() => navigate(sub.key)}
                    className="font-body"
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: viewKey === sub.key ? "var(--eph-surface-2)" : "none",
                      border: "none", borderRadius: 0,
                      padding: "10px 12px", fontSize: 13,
                      fontWeight: viewKey === sub.key ? 500 : 400,
                      color: viewKey === sub.key ? "var(--eph-accent)" : "var(--eph-body)",
                      cursor: "pointer",
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {FLAT_NAV.map((item) => {
            const active = viewKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`admin-nav-tab font-mono${active ? " active" : ""}`}
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
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="admin-topbar-actions" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
          {/* NotificationBell ya trae su propio botón fantasma 34×34 (spec
              §7.3) — el círculo con borde permanente que había acá quedó
              redundante/duplicado y se quitó. */}
          <NotificationBell />
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
                borderRadius: 0, padding: 10, zIndex: 90,
              }}>
                <div className="font-body" style={{ fontSize: 13, fontWeight: 500, color: "var(--eph-text)", padding: "4px 6px" }}>
                  {user?.name ?? t('nav.admin')}
                </div>
                <div className="font-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--eph-muted)", padding: "0 6px 6px" }}>{t('nav.admin')}</div>
                <button
                  onClick={logout}
                  className="font-mono"
                  style={{
                    width: "100%", marginTop: 6, background: "none",
                    border: "1px solid var(--eph-line-2)", borderRadius: 0,
                    padding: "8px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "var(--eph-body)", cursor: "pointer",
                  }}
                >
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </div>
          <button
            className="admin-hamburger"
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
        className={`admin-drawer${drawerOpen ? " open" : ""}`}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "82vw", maxWidth: 300,
          background: "var(--eph-bg)", borderLeft: "1px solid var(--eph-line)", zIndex: 110, padding: "24px 20px", overflowY: "auto",
          transition: "transform 0.28s ease",
          display: "flex", flexDirection: "column", gap: 4,
        }}
      >
        <span className="font-display" style={{ fontSize: 17, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--eph-text)", marginBottom: 16 }}>
          Ephirox
        </span>
        <span className="font-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--eph-muted)", padding: "8px 4px 2px" }}>
          Administration
        </span>
        {ADMIN_HUB_SUBITEMS.map((sub) => (
          <button
            key={sub.key}
            onClick={() => navigate(sub.key)}
            className="font-body"
            style={{
              background: "none", border: "none", textAlign: "left", cursor: "pointer",
              padding: "10px 4px 10px 14px", fontSize: 13.5,
              fontWeight: viewKey === sub.key ? 500 : 400,
              color: viewKey === sub.key ? "var(--eph-text)" : "var(--eph-body)",
              borderBottom: "1px solid var(--eph-line)",
            }}
          >
            {sub.label}
          </button>
        ))}
        {FLAT_NAV.map((item) => {
          const active = viewKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className="font-body"
              style={{
                background: "none", border: "none", textAlign: "left", cursor: "pointer",
                padding: "12px 4px", fontSize: 14,
                fontWeight: active ? 500 : 400,
                color: active ? "var(--eph-text)" : "var(--eph-body)",
                borderBottom: "1px solid var(--eph-line)",
              }}
            >
              {item.label}
            </button>
          );
        })}
        <button
          onClick={logout}
          className="font-mono"
          style={{
            marginTop: "auto", background: "none", border: "1px solid var(--eph-line-2)",
            borderRadius: 0, padding: "10px 16px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--eph-body)", cursor: "pointer",
          }}
        >
          {t('nav.logout')}
        </button>
      </div>

      <style jsx>{`
        .admin-nav-tab::after {
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
        .admin-nav-tab:hover::after {
          width: calc(100% - 24px);
        }
        .admin-nav-tab.active::after {
          width: calc(100% - 24px);
        }
        .admin-drawer {
          transform: translateX(100%);
        }
        .admin-drawer.open {
          transform: translateX(0);
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
        }
        @media (max-width: ${COLLAPSE_BREAKPOINT}px) {
          .admin-nav-row {
            display: none !important;
          }
          .admin-hamburger {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
