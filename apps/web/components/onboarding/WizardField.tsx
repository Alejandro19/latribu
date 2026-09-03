// apps/web/components/onboarding/WizardField.tsx
'use client';

import type { WizardFieldConfig } from '@latribu/shared-types';
import SelectField from '../ui/SelectField';
import SegmentedControl from '../ui/SegmentedControl';
import ChevronStepper from '../ui/ChevronStepper';
import SliderField from '../ui/SliderField';
import TimeField from '../ui/TimeField';
import ChipGroup from '../ui/ChipGroup';
import FileField from '../ui/FileField';
import FloatingField, { FloatingTextarea } from '../ui/FloatingField';

export type WizardFieldProps = {
  field: WizardFieldConfig;
  value: string | string[] | undefined;
  otroValue?: string;
  hidden?: boolean;
  invalid?: boolean;
  onChange: (id: string, value: string | string[]) => void;
  onOtroChange?: (id: string, value: string) => void;
  onFileChange?: (id: string, file: File | null) => void;
};

function InvalidHint({ invalid }: { invalid?: boolean }) {
  if (!invalid) return null;
  return <p role="alert" className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--eph-danger)]">Este campo es obligatorio.</p>;
}

export function WizardField({ field, value, otroValue, hidden, invalid, onChange, onOtroChange, onFileChange }: WizardFieldProps) {
  if (hidden) return null;

  const fieldId = `field-${field.id}`;

  if (field.type === 'select') {
    // Preguntas largas ("¿Se te da mejor pesar la comida diariamente o
    // prefieres...?") no entran en una sola línea a la mitad del ancho de la
    // grilla y terminaban truncadas a media palabra — WizardShell les da la
    // fila completa (isWideField, grid-column:1/-1) por su propio ancho de
    // label, no acá.
    return (
      <div>
        <SelectField
          label={field.label}
          placeholder="Seleccionar"
          value={(value as string) || ''}
          onChange={(v) => onChange(field.id, v)}
          options={(field.options || []).map((option) => ({ value: option, label: option }))}
        />
        <InvalidHint invalid={invalid} />
      </div>
    );
  }

  if (field.type === 'segmented') {
    const min = field.min ?? 1;
    const max = field.max ?? 6;
    const current = value !== undefined && value !== '' ? Number(value) : min;
    const options = Array.from({ length: max - min + 1 }, (_, i) => {
      const n = min + i;
      return { value: String(n), label: String(n) };
    });
    return (
      <div>
        <SegmentedControl label={field.label} options={options} value={String(current)} onChange={(v) => onChange(field.id, v)} />
        <InvalidHint invalid={invalid} />
      </div>
    );
  }

  if (field.type === 'chevron') {
    const min = field.min ?? 0;
    const step = field.step ?? 1;
    const current = value !== undefined && value !== '' ? Number(value) : min;
    return (
      <div>
        <ChevronStepper
          label={field.label}
          value={current}
          min={min}
          max={field.max}
          step={step}
          onChange={(n) => onChange(field.id, String(Math.max(min, Math.round(n * 10) / 10)))}
        />
        <InvalidHint invalid={invalid} />
      </div>
    );
  }

  if (field.type === 'slider') {
    const min = field.min ?? 1;
    const max = field.max ?? 10;
    const current = value !== undefined && value !== '' ? Number(value) : min;
    return (
      <div>
        <SliderField
          label={field.label}
          value={current}
          min={min}
          max={max}
          minLabel={field.minLabel}
          maxLabel={field.maxLabel}
          onChange={(n) => onChange(field.id, String(n))}
        />
        <InvalidHint invalid={invalid} />
      </div>
    );
  }

  if (field.type === 'time') {
    return (
      <div>
        <TimeField label={field.label} value={(value as string) || ''} onChange={(v) => onChange(field.id, v)} />
        <InvalidHint invalid={invalid} />
      </div>
    );
  }

  if (field.type === 'chips') {
    // A la mitad del ancho de la grilla, un grupo con muchas opciones (ej.
    // "¿Cuáles suplementos?": 9 chips) envolvía en demasiadas líneas cortas y
    // se veía apretado — se le da la fila completa para que las chips tengan
    // espacio real donde acomodarse.
    const selected = Array.isArray(value) ? value : [];
    return (
      <div>
        <ChipGroup
          label={field.label}
          options={(field.options || []).map((option) => ({ value: option, label: option }))}
          selected={selected}
          onChange={(vals) => onChange(field.id, vals)}
        />
        {selected.includes('Otro') && (
          <div className="mt-2">
            <FloatingField
              id={`${fieldId}-otro`}
              label={`Especifica ${field.label}`}
              value={otroValue || ''}
              onChange={(v) => onOtroChange?.(field.id, v)}
            />
          </div>
        )}
        <InvalidHint invalid={invalid} />
      </div>
    );
  }

  if (field.type === 'file') {
    return (
      <FileField
        id={fieldId}
        label={field.label}
        fileName={(value as string) || null}
        onFileChange={(file) => onFileChange?.(field.id, file)}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <FloatingTextarea
          id={fieldId}
          label={field.label}
          value={(value as string) || ''}
          onChange={(v) => onChange(field.id, v)}
          invalid={invalid}
        />
      </div>
    );
  }

  // text, date
  return (
    <FloatingField
      id={fieldId}
      label={field.label}
      type={field.type}
      value={(value as string) || ''}
      onChange={(v) => onChange(field.id, v)}
      invalid={invalid}
    />
  );
}
