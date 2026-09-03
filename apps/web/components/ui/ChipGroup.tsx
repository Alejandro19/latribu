"use client";

type ChipGroupProps = {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  label?: string;
  max?: number;
};

export default function ChipGroup({ options, selected, onChange, label, max }: ChipGroupProps) {
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, val]);
    }
  };

  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
      {label && (
        <legend
          className="mb-2 font-mono text-[10px] font-normal uppercase tracking-[0.18em]"
          style={{ color: "var(--eph-muted)", padding: 0 }}
        >
          {label}
        </legend>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const isSel = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className="relative inline-flex cursor-pointer items-center gap-1 rounded-[999px] border font-mono text-[10px] font-normal uppercase tracking-[0.14em] transition-colors duration-150"
              style={{
                padding: "7px 16px",
                borderColor: isSel ? "var(--eph-accent)" : "var(--eph-line-2)",
                background: isSel ? "var(--eph-accent)" : "transparent",
                color: isSel ? "var(--eph-ink)" : "var(--eph-body)",
              }}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggle(opt.value)}
                style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
