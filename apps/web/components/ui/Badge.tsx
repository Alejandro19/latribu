"use client";

type BadgeProps = {
  label: string;
  variant?: "success" | "warn" | "danger";
};

// Píldora de contorno (nunca fondo sólido de color) — el bronce queda
// reservado al CTA primario de cada pantalla, así que los estados usan
// texto/borde de color y fondo transparente (ver spec de reskin §1/§3.7).
const VARIANT_COLOR: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "var(--eph-accent)",
  warn: "var(--eph-steel)",
  danger: "var(--eph-danger)",
};

export default function Badge({ label, variant = "success" }: BadgeProps) {
  const color = VARIANT_COLOR[variant];
  return (
    <span
      className="inline-block rounded-[999px] border font-mono text-[10px] font-normal uppercase tracking-[0.18em]"
      style={{ padding: "4px 12px", borderColor: color, color }}
    >
      {label}
    </span>
  );
}
