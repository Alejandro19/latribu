"use client";

import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  eyebrow?: string;
  className?: string;
  style?: React.CSSProperties;
};

// Contenedor base del reskin Ephirox — fondo de superficie, hairline en vez
// de sombra, radio 0. La cabecera (eyebrow) es opcional: etiqueta mono en
// bronce sobre un hairline propio, para tarjetas que necesiten un título de
// sección (ver spec de reskin §3.3).
export default function Card({ children, eyebrow, className = "", style }: CardProps) {
  return (
    <div
      className={`bg-[var(--eph-surface)] border border-[var(--eph-line)] rounded-none ${className}`}
      style={{ padding: "clamp(26px, 3vw, 38px)", boxShadow: "var(--eph-shadow)", ...style }}
    >
      {eyebrow && (
        <div
          className="mb-5 border-b border-[var(--eph-line)] pb-3 font-mono text-[10px] font-normal uppercase tracking-[0.22em]"
          style={{ color: "var(--eph-accent)" }}
        >
          {eyebrow}
        </div>
      )}
      {children}
    </div>
  );
}
