"use client";

import { useId } from "react";

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
export default function SelectField({ value, onChange, options, label, placeholder, id }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id || autoId;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div className="relative">
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="peer h-12 w-full appearance-none rounded-xl border border-[#E7DFC9] bg-white px-3.5 pr-9 pt-4 text-[15px] text-transparent outline-none transition-colors focus:border-[var(--gold)]"
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
        className="pointer-events-none absolute inset-0 flex items-center truncate px-3.5 pr-9 pt-4 text-[15px] leading-none text-[#2B2621]"
      >
        {selectedLabel}
      </span>
      {label && (
        <label
          htmlFor={selectId}
          className="pointer-events-none absolute left-3.5 right-9 top-3 truncate text-[12px] leading-none text-[#8A8377] transition-colors peer-focus:text-[var(--gold)]"
        >
          {label}
        </label>
      )}
      <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#B0A99C]">
        ▼
      </span>
    </div>
  );
}
