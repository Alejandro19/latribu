"use client";

type ProgressBarProps = {
  done: number;
  total: number;
  label?: string;
};

export default function ProgressBar({ done, total, label = "Progreso" }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--ink-soft)",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span>
          {done}/{total} · {pct}%
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--line)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--terracota)",
            borderRadius: "999px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
