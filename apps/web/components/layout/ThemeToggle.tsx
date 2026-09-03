"use client";

import { useState } from "react";
import { useThemeMode } from "./ThemeRoot";

// Toggle sol/luna — spec §7.2. Reemplaza la píldora de texto CARBÓN/CLARO:
// el estado se lee por el icono en oro y la posición del knob, nunca por
// texto visible dentro del botón. No se renderiza en pantallas de marca
// (dark-brand) — ver isBrandLocked.
function SunIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.6 8.6 0 1 0 10.6 10.6Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { mode, toggleMode, isBrandLocked } = useThemeMode();
  const [hover, setHover] = useState(false);

  if (isBrandLocked) return null;

  const light = mode === "light";
  const knobStyle: React.CSSProperties = {
    position: "absolute",
    top: 3,
    left: 3,
    width: 24,
    height: 24,
    borderRadius: "50%",
    transform: light ? "translateX(0)" : "translateX(32px)",
    transition: "transform 320ms cubic-bezier(.4,0,.2,1)",
  };

  return (
    <button
      type="button"
      onClick={toggleMode}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={light}
      aria-label={light ? "Modo claro" : "Modo carbón"}
      title={light ? "Modo claro" : "Modo carbón"}
      style={{
        position: "relative",
        width: 64,
        height: 32,
        padding: 0,
        flexShrink: 0,
        background: "var(--eph-surface-2)",
        border: `1px solid ${hover ? "var(--eph-accent-line)" : "var(--eph-line-2)"}`,
        borderRadius: 999,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "border-color 200ms ease, background 240ms ease",
      }}
    >
      <span style={{ ...knobStyle, background: "var(--eph-accent)", opacity: 0.16 }} />
      <span style={{ ...knobStyle, border: "1px solid var(--eph-accent)" }} />
      <span
        style={{
          width: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 2,
          color: light ? "var(--eph-accent)" : "var(--eph-faint)",
          transition: "color 220ms ease",
        }}
      >
        <SunIcon />
      </span>
      <span
        style={{
          width: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 2,
          color: light ? "var(--eph-faint)" : "var(--eph-accent)",
          transition: "color 220ms ease",
        }}
      >
        <MoonIcon />
      </span>
    </button>
  );
}
