import { z } from 'zod';

export type WizardFieldType =
  | 'text' | 'textarea' | 'select' | 'date' | 'chevron'
  | 'slider' | 'segmented' | 'chips' | 'time' | 'file' | 'country-picker';

export type WizardFieldConfig = {
  id: string;
  label: string;
  type: WizardFieldType;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  // Agrupación temática visual (cards estilo Oura) — puramente de
  // presentación, no afecta validación ni reglas condicionales. Campos
  // contiguos con el mismo `group` se renderizan juntos en una sola card.
  group?: string;
};

export type WizardModuleConfig = {
  n: number;
  title: string;
  custom?: 'country' | 'body' | 'devices';
  fields: WizardFieldConfig[];
};

export type ConditionalRule = {
  id: string;
  target: string;
  value?: string;
  values?: string[];
  notValue?: string;
  // Restringe el target a una variante del wizard además de la condición de
  // valor (ej. P2/P3 de salud hormonal solo aplican a clientas Mentoría,
  // aunque P1 que las dispara es visible para todos los tiers).
  onlyVariant?: 'mentoring';
};

const RequiredTextSchema = z.string().min(1);
const RequiredChipsSchema = z.array(z.string()).min(1);

// Calcula qué field ids deben ocultarse (y por lo tanto omitirse de la
// validación) dado el valor actual de los campos que los controlan — puerto
// fiel de la función `show` en `initFieldDependencies` del legacy
// (index.html). Un campo sin regla nunca se oculta.
export function computeHiddenFieldIds(
  rules: ConditionalRule[],
  data: Record<string, unknown>,
  variant?: 'standard' | 'mentoring'
): Set<string> {
  const hidden = new Set<string>();
  for (const rule of rules) {
    const val = data[rule.id];
    const showByValue = rule.values
      ? typeof val === 'string' && rule.values.includes(val)
      : rule.notValue
        ? val !== rule.notValue && val !== undefined && val !== ''
        : val === rule.value;
    const showByVariant = !rule.onlyVariant || rule.onlyVariant === variant;
    if (!showByValue || !showByVariant) hidden.add(rule.target);
  }
  return hidden;
}

// Devuelve los ids de los campos requeridos de un módulo que están vacíos —
// puerto fiel de `validateStep` del legacy: los campos tipo 'file' nunca
// bloquean el avance de paso (se validan aparte, vía mimetype en el
// backend), y los campos condicionalmente ocultos se omiten.
export function validateWizardModule(
  fields: WizardFieldConfig[],
  data: Record<string, unknown>,
  hiddenFieldIds: Set<string>
): string[] {
  const invalidIds: string[] = [];
  for (const field of fields) {
    if (field.type === 'file' || !field.required || hiddenFieldIds.has(field.id)) continue;
    const schema = field.type === 'chips' ? RequiredChipsSchema : RequiredTextSchema;
    if (!schema.safeParse(data[field.id]).success) invalidIds.push(field.id);
  }
  return invalidIds;
}
