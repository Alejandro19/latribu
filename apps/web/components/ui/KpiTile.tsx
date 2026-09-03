"use client";

import MetricValue from "./MetricValue";

type KpiTileProps = {
  value: string;
  label: string;
  subtitle?: string;
};

// Fila de KPI (spec §3.3): la cifra pasa por MetricValue (Cormorant +
// figuras tabulares), radio 0 salvo píldoras. Duración/Descanso son
// strings libres "mm:ss" cargadas por el mentor (ver AdminTrainingPanel),
// no un número+unidad separables — MetricValue se usa sin `unit`.
export default function KpiTile({ value, label, subtitle }: KpiTileProps) {
  return (
    <div
      style={{
        background: "var(--eph-surface)",
        border: "1px solid var(--eph-line)",
        borderRadius: 0,
        padding: 18,
        textAlign: "center",
      }}
    >
      <MetricValue value={value} />
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          fontWeight: 400,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "var(--eph-muted)",
          marginTop: 8,
        }}
      >
        {label}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: "var(--eph-faint)", marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
