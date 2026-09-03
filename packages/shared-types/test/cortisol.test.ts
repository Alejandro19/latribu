import { describe, it, expect } from 'vitest';
import {
  CortisolTechniqueInputSchema,
  CortisolCheckinInputSchema,
  CortisolCompletionInputSchema,
  CortisolTipInputSchema,
  CortisolTipUpdateSchema,
  CORTISOL_EMOTIONS,
  CORTISOL_TECHNIQUE_TYPES,
} from '../src/cortisol.js';

describe('cortisol technique schema', () => {
  it('accepts a valid technique', () => {
    const result = CortisolTechniqueInputSchema.safeParse({
      title: 'Respiración 4-7-8',
      type: 'Respiración',
      duration: '5 min',
      duration_minutes: 5,
      description: 'Inhala 4s, sostén 7s, exhala 8s',
      youtube_url: 'https://youtube.com/watch?v=demo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a technique missing the title', () => {
    const result = CortisolTechniqueInputSchema.safeParse({ type: 'Respiración' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid type', () => {
    const result = CortisolTechniqueInputSchema.safeParse({ title: 'X', type: 'Inventado' });
    expect(result.success).toBe(false);
  });

  it('exposes exactly the 4 legacy technique types', () => {
    expect(CORTISOL_TECHNIQUE_TYPES).toEqual(['Respiración', 'Breathwork', 'Meditación', 'Mindfulness']);
  });

  it('accepts a technique with no type (optional)', () => {
    const result = CortisolTechniqueInputSchema.safeParse({ title: 'Técnica libre' });
    expect(result.success).toBe(true);
  });
});

describe('cortisol checkin schema', () => {
  it('accepts each of the 6 legacy emotions', () => {
    for (const emotion of CORTISOL_EMOTIONS) {
      expect(CortisolCheckinInputSchema.safeParse({ emotion }).success).toBe(true);
    }
  });

  it('exposes exactly the 6 legacy emotions', () => {
    expect(CORTISOL_EMOTIONS).toEqual(['ansioso', 'irritable', 'cansado', 'abrumado', 'tranquilo', 'energia']);
  });

  it('rejects an invalid emotion', () => {
    const result = CortisolCheckinInputSchema.safeParse({ emotion: 'feliz' });
    expect(result.success).toBe(false);
  });
});

describe('cortisol completion schema', () => {
  it('accepts an empty body (technique_id optional)', () => {
    expect(CortisolCompletionInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a technique_id', () => {
    expect(CortisolCompletionInputSchema.safeParse({ technique_id: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
  });
});

describe('cortisol tip schemas', () => {
  it('accepts a valid tip', () => {
    expect(CortisolTipInputSchema.safeParse({ content: 'El cortisol baja con luz solar matutina.' }).success).toBe(true);
  });

  it('rejects an empty tip', () => {
    expect(CortisolTipInputSchema.safeParse({ content: '' }).success).toBe(false);
  });

  it('accepts a partial update (content or active alone)', () => {
    expect(CortisolTipUpdateSchema.safeParse({ active: false }).success).toBe(true);
    expect(CortisolTipUpdateSchema.safeParse({ content: 'Nuevo texto' }).success).toBe(true);
    expect(CortisolTipUpdateSchema.safeParse({}).success).toBe(true);
  });
});
