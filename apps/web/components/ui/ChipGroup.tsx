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
        <legend style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600,
          color: "var(--ink-soft)", marginBottom: 8, padding: 0 }}>
          <span aria-hidden style={{ marginRight: 6, color: "#5B7A4E", fontSize: 14 }}>🏷️</span>
          {label}
        </legend>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const isSel = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500,
                border: isSel ? "1px solid var(--terracota)" : "1px solid var(--line)",
                background: isSel ? "var(--terracota)" : "var(--cream)",
                color: isSel ? "#fff" : "var(--ink-soft)",
                cursor: "pointer", transition: "all .15s ease",
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
