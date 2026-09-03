"use client";

import { useId } from "react";
import { IconChevronDown } from "./icons";

type SelectFieldProps = {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  placeholder?: string;
  id?: string;
};

// Mismo patrón de floating-label que FloatingField (misma altura de 48px,
// label chico fijo arriba dentro de la caja). El <select> nativo queda con
// texto transparente: los navegadores centran el texto de la opción elegida
// de un <select> de forma distinta a como un <input> respeta su padding-top,
// lo que pegaba el valor contra el label (campos "solapados" reportados por
// el usuario, presente tanto vacío como lleno porque el label de este
// componente siempre está arriba, nunca centrado). El valor visible se
// dibuja aparte, en un <span> posicionado igual que el texto de un
// FloatingField; el <select> real queda debajo solo para foco, teclado y el
// menú nativo. `leading-none` en el label también era necesario: sin él, la
// caja de línea por defecto (~1.5×) lo hacía más alto de lo que se ve y
// empujaba su texto hacia abajo, hacia el valor.
export default function SelectField({ value, onChange, options, label, placeholder = "Seleccionar", id }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id || autoId;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const showingPlaceholder = !selectedLabel;

  return (
    <div>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block truncate font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
          style={{ color: "var(--eph-muted)" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none border-0 border-b border-[var(--eph-line-2)] rounded-none bg-transparent px-0.5 pr-5 text-[18px] font-normal text-transparent outline-none transition-colors focus:border-[var(--eph-accent)] focus-visible:ring-0"
        >
          <option value="" aria-label={placeholder}></option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0.5 right-5 flex items-center truncate text-[18px] font-normal leading-none"
          style={{ color: showingPlaceholder ? "var(--eph-muted)" : "var(--eph-text)" }}
        >
          {showingPlaceholder ? placeholder : selectedLabel}
        </span>
        <IconChevronDown
          size={14}
          className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--eph-muted)" }}
        />
      </div>
    </div>
  );
}
