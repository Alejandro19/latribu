"use client";

type DotState = "done" | "pending" | "shield" | "default";

type WeekDotsProps = {
  days: { label: string; state: DotState }[];
};

function dotStyle(s: DotState): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 34, height: 34, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, flexShrink: 0, transition: "all .3s ease",
  };
  switch (s) {
    case "done":   return { ...base, background: "#B8935A", border: "1px solid #B8935A", color: "#fff" };
    case "pending": return { ...base, border: "1.5px dashed #D9A441", color: "#B8935A", fontWeight: 700 };
    case "shield": return { ...base, background: "#F1EAF7", border: "1px solid #E1D5EE", color: "#8A5FA0" };
    default:       return { ...base, background: "#FBF7EC", border: "1.5px solid #E7DFC9", color: "#B0A99C" };
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
