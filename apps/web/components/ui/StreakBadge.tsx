"use client";

type StreakBadgeProps = {
  weeks: number;
  state?: "normal" | "risk" | "celebrate";
};

export default function StreakBadge({ weeks, state = "normal" }: StreakBadgeProps) {
  const colors = {
    normal: { bg: "#FFFFFF", border: "#E7DFC9", num: "#2B2621", txt: "#8A8377" },
    risk: { bg: "#FBEFE4", border: "#F0DAC0", num: "#2B2621", txt: "#B8794A" },
    celebrate: { bg: "#2B2621", border: "#2B2621", num: "#F3EFE6", txt: "#F3EFE6" },
  }[state];

  return (
    <span
      style={{
        display: "flex", alignItems: "center", gap: 7,
        background: colors.bg, border: `1px solid ${colors.border}`,
        borderRadius: "100px", padding: "8px 14px", flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 16 }}>🔥</span>
      <span style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 15, fontWeight: 700, color: colors.num }}>
        {weeks}
      </span>
      <span style={{ fontSize: 9.5, color: colors.txt, fontWeight: state === "risk" ? 600 : 400 }}>
        semanas
      </span>
    </span>
  );
}
