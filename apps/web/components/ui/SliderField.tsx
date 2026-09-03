"use client";

import { useId } from "react";

type SliderFieldProps = {
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  label?: string;
  minLabel?: string;
  maxLabel?: string;
  id?: string;
};

export default function SliderField({
  value, onChange, min, max, label, minLabel, maxLabel, id,
}: SliderFieldProps) {
  const autoId = useId();
  const sliderId = id || autoId;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", lineHeight: "16px", marginBottom: 6 }}>
        {label && (
          <label
            htmlFor={sliderId}
            className="cursor-pointer font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
            style={{ color: "var(--eph-muted)" }}
          >
            {label}
          </label>
        )}
        <span className="eph-num-mono font-mono text-[34px] font-normal" style={{ color: "var(--eph-accent)" }}>{value}</span>
      </div>
      <div style={{ height: 36, display: "flex", alignItems: "center", boxSizing: "border-box" }}>
        <input
          type="range"
          id={sliderId}
          min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--eph-accent)" }}
        />
      </div>
      {(minLabel || maxLabel) && (
        <div
          className="flex justify-between font-mono text-[9px] uppercase tracking-[0.1em]"
          style={{ color: "var(--eph-faint)", marginTop: 4 }}
        >
          <span>{minLabel || min}</span>
          <span>{maxLabel || max}</span>
        </div>
      )}
    </div>
  );
}
