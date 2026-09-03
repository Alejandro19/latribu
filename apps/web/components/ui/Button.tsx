"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

// Máximo un botón primario (sólido bronce) por pantalla — el resto usa
// secondary/tertiary. Ver spec de reskin §3.4/§7: sin sombras, sin escalas
// al hover, solo transición de color/borde.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--eph-accent)] text-[var(--eph-ink)] border border-[var(--eph-accent)] hover:bg-[var(--eph-accent-hi)] hover:border-[var(--eph-accent-hi)] px-[38px] py-4",
  secondary:
    "bg-transparent text-[var(--eph-body)] border border-[var(--eph-line-2)] hover:border-[var(--eph-accent)] hover:text-[var(--eph-text)] px-[38px] py-4",
  tertiary:
    "bg-transparent text-[var(--eph-body)] border border-transparent hover:text-[var(--eph-accent)] px-1 py-2.5",
};

export default function Button({ variant = "primary", className = "", disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] rounded-none font-mono text-[11px] font-normal uppercase tracking-[0.22em] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:border-[var(--eph-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
