"use client";

import { IconLock } from "./icons";

type LockedOverlayProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export default function LockedOverlay({
  children,
  title,
  subtitle,
  ctaLabel = "Desbloquear",
  onCta,
}: LockedOverlayProps) {
  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden="true"
        style={{ filter: "blur(3px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}
      >
        {children}
      </div>
      <div
        style={{
          background: "var(--eph-surface)",
          border: "1px solid var(--eph-line)",
          borderRadius: 0,
          padding: "26px 24px",
          textAlign: "center",
          marginTop: -14,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--eph-accent)" }}>
          <IconLock size={26} />
        </div>
        <h3
          className="font-display"
          style={{
            fontSize: 19,
            fontWeight: 400,
            margin: "0 0 6px",
            color: "var(--eph-text)",
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 13, color: "var(--eph-body)", margin: "0 0 16px" }}>
          {subtitle}
        </p>
        {onCta && (
          <button
            onClick={onCta}
            className="font-mono text-[11px] font-normal uppercase tracking-[0.22em]"
            style={{
              padding: "12px 26px",
              borderRadius: 0,
              background: "var(--eph-accent)",
              color: "var(--eph-ink)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
