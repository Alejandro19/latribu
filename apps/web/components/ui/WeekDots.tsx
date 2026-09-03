"use client";

type DotState = "done" | "pending" | "shield" | "default";

type WeekDotsProps = {
  days: { label: string; state: DotState }[];
};

// Estados por spec de reskin §3.9 (StepDots): actual/completado = sólido o
// borde bronce; pendiente = borde hairline + texto tenue. "shield"
// (protector de racha disponible) no está en el spec original — se mapea al
// tono steel para mantenerlo visualmente distinto sin introducir un color
// fuera de los tokens Ephirox.
function dotStyle(s: DotState): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 34, height: 34, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
    flexShrink: 0, transition: "all .15s ease",
  };
  switch (s) {
    case "done":    return { ...base, background: "var(--eph-accent)", border: "1px solid var(--eph-accent)", color: "var(--eph-ink)" };
    case "pending": return { ...base, border: "1px solid var(--eph-line)", color: "var(--eph-faint)" };
    case "shield":  return { ...base, background: "transparent", border: "1px solid var(--eph-steel)", color: "var(--eph-steel)" };
    default:        return { ...base, background: "transparent", border: "1px solid var(--eph-line-2)", color: "var(--eph-body)" };
  }
}

export default function WeekDots({ days }: WeekDotsProps) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {days.map((d, i) => (
        <span key={i} style={dotStyle(d.state)} title={d.label}>
          {d.label}
        </span>
      ))}
    </div>
  );
}
