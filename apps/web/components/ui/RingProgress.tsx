"use client";

import type { ReactNode } from "react";

// El tipo conserva sus 3 valores por compatibilidad con los call sites
// existentes, pero ya no hay variante de degradado multicolor (prohibido en
// la identidad Ephirox, ver spec de reskin §1) — las tres pintan el mismo
// trazo bronce sólido.
type RingProgressColor = "gradient" | "espresso" | "piedra";

type RingProgressProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: RingProgressColor;
  trackColor?: string;
  children?: ReactNode;
};

export default function RingProgress({
  value,
  size = 64,
  strokeWidth = 5,
  trackColor = "var(--eph-line-2)",
  children,
}: RingProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--eph-accent)" strokeWidth={strokeWidth} strokeLinecap="butt"
          strokeDasharray={`${filled.toFixed(1)} ${circ.toFixed(1)}`}
        />
      </svg>
      {children !== undefined ? (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          {children}
        </div>
      ) : (
        <div
          className="font-mono"
          style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: size * 0.2, fontWeight: 400, color: "var(--eph-text)",
          }}
        >
          {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}
