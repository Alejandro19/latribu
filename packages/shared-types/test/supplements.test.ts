import { describe, it, expect } from 'vitest';
import { SupplementInputSchema, SUPPLEMENT_CATEGORIES } from '../src/supplements.js';

describe('supplement schemas', () => {
  it('accepts a valid supplement', () => {
    const result = SupplementInputSchema.safeParse({
      name: 'Magnesio',
      brand: 'NOW Foods',
      dose: '400mg',
      timing: 'Antes de dormir',
      benefit: 'Mejora la calidad del sueño',
      category: 'Sueño',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a supplement missing the name', () => {
    const result = SupplementInputSchema.safeParse({ category: 'Base' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = SupplementInputSchema.safeParse({ name: 'X', category: 'Inventado' });
    expect(result.success).toBe(false);
  });

  it('exposes exactly the 5 legacy categories', () => {
    expect(SUPPLEMENT_CATEGORIES).toEqual(['Nootrópico', 'Adaptógeno', 'Sueño', 'Rendimiento', 'Base']);
  });

  it('leaves active undefined when omitted, so callers can distinguish "not provided" from "false"', () => {
    const result = SupplementInputSchema.safeParse({ name: 'Magnesio', category: 'Base' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBeUndefined();
  });

  it('accepts an explicit active value without coercing strings', () => {
    const result = SupplementInputSchema.safeParse({ name: 'Magnesio', active: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(false);
  });
});
