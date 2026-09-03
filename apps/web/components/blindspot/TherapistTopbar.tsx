'use client';

import { useEffect, useRef, useState } from 'react';
import { getSessionToken, decodeTokenPayload, clearSession } from '@/lib/api-client';
import Isotipo from '../ui/Isotipo';
import { THERAPIST_NAV, type TherapistModuleKey } from './therapist-nav';

const COLLAPSE_BREAKPOINT = 1280;

export default function TherapistTopbar({
  activeModule,
  onNavigate,
}: {
  activeModule: TherapistModuleKey;
  onNavigate: (key: TherapistModuleKey) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const token = getSessionToken();
  const name = (token && decodeTokenPayload<{ name?: string }>(token)?.name) || 'Terapeuta';
  const initial = name.charAt(0).toUpperCase();

  function handleLogout() {
    clearSession();
    window.location.href = '/therapist-login';
  }

  function navigate(key: TherapistModuleKey) {
    onNavigate(key);
    setDrawerOpen(false);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    if (accountOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [accountOpen]);

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 80,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          height: 74,
          padding: '0 32px',
          background: 'var(--eph-bg)',
          borderBottom: '1px solid var(--eph-line)',
        }}
      >
        <button
          onClick={() => navigate('casos')}
          aria-label="Ir al menú principal"
          className="font-display"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 18,
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'var(--eph-text)',
            flexShrink: 0,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <Isotipo size={40} />
          Ephirox
        </button>

        <nav className="therapist-nav-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflowX: 'auto' }}>
          {THERAPIST_NAV.map((item) => {
            const active = activeModule === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                className={`therapist-nav-tab font-mono${active ? ' active' : ''}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 400,
                  color: active ? 'var(--eph-text)' : 'var(--eph-muted)',
                  padding: '8px 12px',
                  position: 'relative',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="therapist-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
          <div ref={accountRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setAccountOpen((v) => !v)}
              aria-label="Cuenta"
              className="font-mono"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '1px solid var(--eph-line-2)',
                background: accountOpen ? 'var(--eph-accent)' : 'transparent',
                color: accountOpen ? 'var(--eph-ink)' : 'var(--eph-text)',
                fontSize: 12, fontWeight: 400, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {initial}
            </button>
            {accountOpen && (
              <div style={{
                position: 'absolute', top: 40, right: 0, width: 200,
                background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
                borderRadius: 0, padding: 10, zIndex: 90,
              }}>
                <div className="font-body" style={{ fontSize: 13, fontWeight: 500, color: 'var(--eph-text)', padding: '4px 6px' }}>{name}</div>
                <div className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--eph-muted)', padding: '0 6px 6px' }}>Terapeuta</div>
                <button
                  onClick={handleLogout}
                  className="font-mono"
                  style={{
                    width: '100%', marginTop: 6, background: 'none',
                    border: '1px solid var(--eph-line-2)', borderRadius: 0,
                    padding: '8px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--eph-body)', cursor: 'pointer',
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
          <button
            className="therapist-hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            style={{
              display: 'none', background: 'none', border: 'none',
              padding: 6, flexDirection: 'column', gap: 4, cursor: 'pointer',
            }}
          >
            <span style={{ display: 'block', width: 20, height: 1, background: 'var(--eph-text)' }} />
            <span style={{ display: 'block', width: 20, height: 1, background: 'var(--eph-text)' }} />
            <span style={{ display: 'block', width: 20, height: 1, background: 'var(--eph-text)' }} />
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 105 }}
        />
      )}
      <div
        className={`therapist-drawer${drawerOpen ? ' open' : ''}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '82vw', maxWidth: 300,
          background: 'var(--eph-bg)', borderLeft: '1px solid var(--eph-line)', zIndex: 110, padding: '24px 20px',
          transition: 'transform 0.28s ease',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}
      >
        <span className="font-display" style={{ fontSize: 17, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--eph-text)', marginBottom: 16 }}>
          Ephirox
        </span>
        {THERAPIST_NAV.map((item) => {
          const active = activeModule === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className="font-body"
              style={{
                background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                padding: '12px 4px', fontSize: 14,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--eph-text)' : 'var(--eph-body)',
                borderBottom: '1px solid var(--eph-line)',
              }}
            >
              {item.label}
            </button>
          );
        })}
        <button
          onClick={handleLogout}
          className="font-mono"
          style={{
            marginTop: 'auto', background: 'none', border: '1px solid var(--eph-line-2)',
            borderRadius: 0, padding: '10px 16px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--eph-body)', cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <style jsx>{`
        .therapist-nav-tab::after {
          content: '';
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 2px;
          height: 1px;
          background: var(--eph-accent);
          width: 0%;
          transition: width 0.18s ease;
        }
        .therapist-nav-tab:hover::after {
          width: calc(100% - 24px);
        }
        .therapist-nav-tab.active::after {
          width: calc(100% - 24px);
        }
        .therapist-nav-row::-webkit-scrollbar {
          display: none;
        }
        .therapist-drawer {
          transform: translateX(100%);
        }
        .therapist-drawer.open {
          transform: translateX(0);
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
        }
        @media (max-width: ${COLLAPSE_BREAKPOINT}px) {
          .therapist-nav-row {
            display: none !important;
          }
          .therapist-hamburger {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
