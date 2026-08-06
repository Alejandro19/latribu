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
        <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600,
          color: "var(--ink-soft)", marginBottom: 8 }}>
          <span aria-hidden style={{ marginRight: 6, color: "#5B7A4E", fontSize: 14 }}>🕐</span>
          <label htmlFor={fieldId} style={{ cursor: "pointer" }}>{label}</label>
        </div>
      )}
      <div style={{ background: "#FFFFFF", border: "1px solid #E7DFC9",
        borderRadius: 12, height: 48, display: "flex", alignItems: "center",
        padding: "0 14px", boxSizing: "border-box" }}>
        <input
          type="time"
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ border: "none", background: "transparent", fontWeight: 600,
            color: "#2B2621", fontSize: 15, width: "100%", height: "100%", padding: 0 }}
        />
      </div>
    </div>
  );
}
