"use client";

type BadgeProps = {
  label: string;
  variant?: "success" | "warn";
};

export default function Badge({ label, variant = "success" }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: 12,
        fontWeight: 700,
        background: variant === "warn" ? "var(--terracota-soft)" : "var(--sage-soft)",
        color: variant === "warn" ? "var(--terracota)" : "var(--sage)",
      }}
    >
      {label}
    </span>
  );
}
