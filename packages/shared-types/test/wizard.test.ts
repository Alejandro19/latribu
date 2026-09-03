import { describe, it, expect } from 'vitest';
import { computeHiddenFieldIds, validateWizardModule, type WizardFieldConfig, type ConditionalRule } from '../src/wizard.js';

describe('computeHiddenFieldIds', () => {
  it('hides the target field when the controlling value does not match', () => {
    const rules: ConditionalRule[] = [{ id: 'condition', value: 'Otra', target: 'condition_other' }];
    const hidden = computeHiddenFieldIds(rules, { condition: 'Ninguna' });
    expect(hidden.has('condition_other')).toBe(true);
  });

  it('shows the target field when the controlling value matches', () => {
    const rules: ConditionalRule[] = [{ id: 'condition', value: 'Otra', target: 'condition_other' }];
    const hidden = computeHiddenFieldIds(rules, { condition: 'Otra' });
    expect(hidden.has('condition_other')).toBe(false);
  });

  it('supports a `values` list (any-of) rule', () => {
    const rules: ConditionalRule[] = [{ id: 'snacks', values: ['A veces', 'Siempre'], target: 'snacks_qty' }];
    expect(computeHiddenFieldIds(rules, { snacks: 'Nunca' }).has('snacks_qty')).toBe(true);
    expect(computeHiddenFieldIds(rules, { snacks: 'Siempre' }).has('snacks_qty')).toBe(false);
  });

  it('supports a `notValue` (anything-but) rule and treats empty as hidden', () => {
    const rules: ConditionalRule[] = [{ id: 'alcohol', notValue: 'Nunca', target: 'alcohol_type' }];
    expect(computeHiddenFieldIds(rules, { alcohol: 'Nunca' }).has('alcohol_type')).toBe(true);
    expect(computeHiddenFieldIds(rules, { alcohol: '' }).has('alcohol_type')).toBe(true);
    expect(computeHiddenFieldIds(rules, { alcohol: 'Ocasional' }).has('alcohol_type')).toBe(false);
  });
});

describe('validateWizardModule', () => {
  const fields: WizardFieldConfig[] = [
    { id: 'occupation', label: 'Ocupación', type: 'text', required: true },
    { id: 'checkup_file', label: 'Chequeo', type: 'file' },
    { id: 'proteins', label: 'Proteínas', type: 'chips', options: ['Pollo'], required: true },
    { id: 'condition_other', label: 'Especifica', type: 'text', required: true },
  ];

  it('flags empty required text fields', () => {
    const invalid = validateWizardModule(fields, { occupation: '' }, new Set());
    expect(invalid).toContain('occupation');
  });

  it('never flags a file field', () => {
    const invalid = validateWizardModule(fields, { occupation: 'Ingeniero', proteins: ['Pollo'] }, new Set());
    expect(invalid).not.toContain('checkup_file');
  });

  it('flags an empty chips field as invalid', () => {
    const invalid = validateWizardModule(fields, { occupation: 'Ingeniero', proteins: [] }, new Set());
    expect(invalid).toContain('proteins');
  });

  it('skips a required field that is currently hidden', () => {
    const invalid = validateWizardModule(
      fields,
      { occupation: 'Ingeniero', proteins: ['Pollo'], condition_other: '' },
      new Set(['condition_other'])
    );
    expect(invalid).not.toContain('condition_other');
  });
});
