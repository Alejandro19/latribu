import { describe, it, expect } from 'vitest';
import { WIZARD_MODULES, CONDITIONAL_RULES } from '../lib/wizard-modules';

describe('WIZARD_MODULES', () => {
  it('has exactly 9 modules numbered 1 through 9', () => {
    expect(WIZARD_MODULES).toHaveLength(9);
    expect(WIZARD_MODULES.map((m) => m.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('marks module 1 as the country-custom module with 4 fields', () => {
    const mod1 = WIZARD_MODULES.find((m) => m.n === 1)!;
    expect(mod1.custom).toBe('country');
    expect(mod1.fields).toHaveLength(4);
  });

  it('marks module 3 as the body-custom module with no config-driven fields', () => {
    const mod3 = WIZARD_MODULES.find((m) => m.n === 3)!;
    expect(mod3.custom).toBe('body');
    expect(mod3.fields).toHaveLength(0);
  });

  it('has no custom flag on the other 7 modules', () => {
    const plainModules = WIZARD_MODULES.filter((m) => m.n !== 1 && m.n !== 3);
    expect(plainModules).toHaveLength(7);
    plainModules.forEach((m) => expect(m.custom).toBeUndefined());
  });

  it('every field has a non-empty id and label', () => {
    for (const mod of WIZARD_MODULES) {
      for (const field of mod.fields) {
        expect(field.id.length).toBeGreaterThan(0);
        expect(field.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('CONDITIONAL_RULES', () => {
  it('has exactly 11 rules', () => {
    expect(CONDITIONAL_RULES).toHaveLength(11);
  });

  it('every rule references a real controlling field and a real target field', () => {
    const allFieldIds = new Set(WIZARD_MODULES.flatMap((m) => m.fields.map((f) => f.id)));
    for (const rule of CONDITIONAL_RULES) {
      expect(allFieldIds.has(rule.id)).toBe(true);
      expect(allFieldIds.has(rule.target)).toBe(true);
    }
  });
});
