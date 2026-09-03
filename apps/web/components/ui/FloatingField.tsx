"use client";

type FloatingFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  step?: string;
  list?: string;
  hint?: string;
};

// Jerarquía tipográfica pregunta/respuesta: el label es contexto secundario
// (mono uppercase, --eph-muted) y siempre va estático arriba del campo —
// nunca compite en tamaño con el valor. El valor es el dato real (18px,
// --eph-text), lo primero que el ojo detecta al escanear. Sin caja: solo
// hairline inferior (ver spec de reskin §3.5).
export default function FloatingField({
  id, label, value, onChange, type = "text", disabled, invalid, placeholder, step, list, hint,
}: FloatingFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
        style={{ color: "var(--eph-muted)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        step={step}
        list={list}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full border-0 border-b ${invalid ? "border-[var(--eph-danger)]" : "border-[var(--eph-line-2)]"} rounded-none bg-transparent px-0.5 py-1.5 text-[18px] font-normal outline-none transition-colors placeholder:font-normal focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50`}
        style={{ color: "var(--eph-text)" }}
        onFocus={(e) => { if (!invalid) e.currentTarget.style.borderColor = "var(--eph-accent)"; }}
        onBlur={(e) => { if (!invalid) e.currentTarget.style.borderColor = "var(--eph-line-2)"; }}
      />
      {invalid && <p role="alert" className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--eph-danger)" }}>Este campo es obligatorio.</p>}
      {!invalid && hint && <p className="mt-1.5 text-xs" style={{ color: "var(--eph-muted)" }}>{hint}</p>}
    </div>
  );
}

type FloatingTextareaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  invalid?: boolean;
  rows?: number;
};

export function FloatingTextarea({ id, label, value, onChange, invalid, rows = 1 }: FloatingTextareaProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
        style={{ color: "var(--eph-muted)" }}
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full resize-none rounded-none border ${invalid ? "border-[var(--eph-danger)]" : "border-[var(--eph-line)]"} bg-[var(--eph-surface)] px-3.5 py-3 text-[16px] font-normal outline-none transition-colors focus:border-[var(--eph-accent)]`}
        style={{ color: "var(--eph-text)" }}
      />
      {invalid && <p role="alert" className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--eph-danger)" }}>Este campo es obligatorio.</p>}
    </div>
  );
}
