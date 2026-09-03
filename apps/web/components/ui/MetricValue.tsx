"use client";

import type { ReactNode } from "react";

type MetricValueSize = "kpi" | "hero" | "index" | "secondary";

type MetricValueProps = {
  value: ReactNode;
  unit?: string;
  size?: MetricValueSize;
};

// Única forma de escribir una cifra de dato en Cormorant (spec §2.1): ninguna
// pantalla escribe la cifra a mano. Cormorant entrega figuras de estilo
// antiguo por defecto (alturas/anchos desiguales) — .eph-num (tema.css)
// activa lnum/tnum para que toda fila de KPIs/índice/métrica quede alineada.
// Nunca corregir el desnivel con otra familia, más peso o escalado manual.
//
// - kpi: 44px — KPI de rejilla, unifica Nutrition/Sleep/Ejercicio (antes 40/42px).
// - hero: clamp(56px,7vw,88px) — cifra hero (ej. Carga cognitiva).
// - index: clamp(44px,5vw,64px) — índice (ej. Evolution, puntaje de sueño).
// - secondary: 32px — métrica secundaria (HRV, cortisol, recuperación).
const SIZE_CONFIG: Record<MetricValueSize, { fontSize: string; gap: number }> = {
  kpi: { fontSize: "44px", gap: 8 },
  hero: { fontSize: "clamp(56px, 7vw, 88px)", gap: 8 },
  index: { fontSize: "clamp(44px, 5vw, 64px)", gap: 8 },
  secondary: { fontSize: "32px", gap: 6 },
};

export default function MetricValue({ value, unit, size = "kpi" }: MetricValueProps) {
  const { fontSize, gap } = SIZE_CONFIG[size];
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap }}>
      <span
        className="eph-num"
        style={{
          fontFamily: "var(--font-cormorant), serif",
          fontWeight: 300,
          fontSize,
          lineHeight: 1,
          color: "var(--eph-text)",
        }}
      >
        {value}
      </span>
      {unit && (
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--eph-muted)",
          }}
        >
          {unit}
        </span>
      )}
    </span>
  );
}
