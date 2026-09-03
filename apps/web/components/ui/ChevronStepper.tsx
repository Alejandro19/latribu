"use client";

import { useId } from "react";

type ChevronStepperProps = {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  id?: string;
};

export default function ChevronStepper({
  value, onChange, min = 0, max, step = 1, label, id,
}: ChevronStepperProps) {
  const autoId = useId();
  const outputId = id || autoId;
  return (
    <div>
      {label && (
        <label
          htmlFor={outputId}
          className="mb-1.5 block font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
          style={{ color: "var(--eph-muted)" }}
        >
          {label}
        </label>
      )}
      <div style={{ height: 40, display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid var(--eph-line-2)",
        padding: "0 2px", boxSizing: "border-box" }}>
        <output id={outputId} className="font-mono" style={{ fontSize: 18, fontWeight: 400, color: "var(--eph-text)" }}>{value}</output>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <button type="button" aria-label={label ? `Aumentar ${label}` : "Aumentar"} onClick={() => {
            const n = value + step;
            if (max != null && n > max) return;
            onChange(n);
          }}
            style={{ border: "none", background: "none", padding: 0, lineHeight: 1,
              fontSize: 11, color: "var(--eph-muted)", cursor: "pointer" }}>
            ▲
          </button>
          <button type="button" aria-label={label ? `Disminuir ${label}` : "Disminuir"} onClick={() => {
            const n = value - step;
            if (n < min) return;
            onChange(n);
          }}
            style={{ border: "none", background: "none", padding: 0, lineHeight: 1,
              fontSize: 11, color: "var(--eph-muted)", cursor: "pointer" }}>
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}
