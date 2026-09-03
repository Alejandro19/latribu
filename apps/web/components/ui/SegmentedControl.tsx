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
        <div
          className="mb-2 font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
          style={{ color: "var(--eph-muted)" }}
        >
          {label}
        </div>
      )}
      <div role="group" aria-label={label} style={{ display: "flex", height: 44, gap: 0 }}>
        {options.map((opt, i) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              className="font-mono text-[11px] font-normal uppercase tracking-[0.14em] transition-colors duration-150"
              style={{
                flex: 1, height: "100%", borderRadius: 0,
                border: selected ? "1px solid var(--eph-accent)" : "1px solid var(--eph-line-2)",
                marginLeft: i > 0 ? -1 : 0,
                background: selected ? "var(--eph-accent)" : "transparent",
                color: selected ? "var(--eph-ink)" : "var(--eph-body)",
                cursor: "pointer",
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
