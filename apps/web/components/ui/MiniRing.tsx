"use client";

type MiniRingProps = { pct: number; size?: number; strokeColor?: string; trackColor?: string };

export default function MiniRing({
  pct,
  size = 46,
  strokeColor = "var(--eph-accent)",
  trackColor = "rgba(237, 230, 220, 0.14)",
}: MiniRingProps) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct)) / 100 * circ;

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={strokeColor}
          strokeWidth="4" strokeLinecap="butt"
          strokeDasharray={`${filled.toFixed(1)} ${circ.toFixed(1)}`}
        />
      </svg>
    </div>
  );
}
