"use client";

import { useId } from "react";

type TimeFieldProps = {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  id?: string;
};

export default function TimeField({ value, onChange, label, id }: TimeFieldProps) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <div>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block cursor-pointer font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
          style={{ color: "var(--eph-muted)" }}
        >
          {label}
        </label>
      )}
      <div style={{ background: "transparent", borderBottom: "1px solid var(--eph-line-2)",
        borderRadius: 0, height: 40, display: "flex", alignItems: "center",
        padding: "0 2px", boxSizing: "border-box" }}>
        <input
          type="time"
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ border: "none", background: "transparent", fontWeight: 400,
            color: "var(--eph-text)", fontSize: 18, width: "100%", height: "100%", padding: 0 }}
        />
      </div>
    </div>
  );
}
