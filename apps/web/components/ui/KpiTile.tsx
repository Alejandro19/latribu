"use client";

type KpiTileProps = {
  value: string;
  label: string;
  subtitle?: string;
};

export default function KpiTile({ value, label, subtitle }: KpiTileProps) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 18,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "Fraunces, Georgia, serif",
          fontSize: 26,
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4, fontWeight: 500 }}>
        {label}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2, opacity: 0.7 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
