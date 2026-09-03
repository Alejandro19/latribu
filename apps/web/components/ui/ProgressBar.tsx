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
        className="mb-1.5 flex justify-between font-mono text-[10px] font-normal uppercase tracking-[0.14em]"
        style={{ color: "var(--eph-muted)" }}
      >
        <span>{label}</span>
        <span>
          {done}/{total} · {pct}%
        </span>
      </div>
      <div
        style={{
          height: 2,
          background: "rgba(237, 230, 220, 0.14)",
          borderRadius: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--eph-accent)",
            borderRadius: 0,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
