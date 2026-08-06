"use client";

type SegmentedControlProps = {
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  label?: string;
};

export default function SegmentedControl({ options, value, onChange, label }: SegmentedControlProps) {
  return (
    <div>
      {label && (
        <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600,
          color: "var(--ink-soft)", marginBottom: 8 }}>
          {label}
        </div>
      )}
      <div role="group" aria-label={label} style={{ display: "flex", height: 48, gap: 6 }}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1, height: "100%", borderRadius: 12,
                border: selected ? "1px solid #2B2621" : "1px solid #E7DFC9",
                background: selected ? "#2B2621" : "#FFFFFF",
                fontFamily: "Fraunces, Georgia, serif", fontWeight: 600,
                fontSize: 14, color: selected ? "#F3EFE6" : "#8A8377",
                cursor: "pointer", transition: "all .15s ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
