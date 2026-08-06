import { describe, it, expect } from 'vitest';
import { CommunityEventInputSchema, CommunityTherapyInputSchema } from '../src/community.js';

describe('community event schema', () => {
  it('accepts a valid event', () => {
    const result = CommunityEventInputSchema.safeParse({
      title: 'Sesión grupal de respiración',
      description: 'Práctica guiada de 45 minutos',
      event_date: '2026-09-01T18:00:00.000Z',
      location: 'Estudio LA TRIBU',
      capacity: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an event missing the title', () => {
    expect(CommunityEventInputSchema.safeParse({ location: 'X' }).success).toBe(false);
  });

  it('accepts an event with only a title (everything else optional)', () => {
    expect(CommunityEventInputSchema.safeParse({ title: 'Solo título' }).success).toBe(true);
  });

  it('accepts a partial update patch', () => {
    expect(CommunityEventInputSchema.partial().safeParse({ capacity: 30 }).success).toBe(true);
  });
});

describe('community therapy schema', () => {
  it('accepts a valid therapy', () => {
    const result = CommunityTherapyInputSchema.safeParse({
      title: 'Masaje descontracturante',
      description: '30% de descuento con nuestro aliado',
      discount_pct: 30,
      provider: 'Clínica Aliada',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a therapy missing the title', () => {
    expect(CommunityTherapyInputSchema.safeParse({ provider: 'X' }).success).toBe(false);
  });

  it('accepts a therapy with only a title', () => {
    expect(CommunityTherapyInputSchema.safeParse({ title: 'Solo título' }).success).toBe(true);
  });
});