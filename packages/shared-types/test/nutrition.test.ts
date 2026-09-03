import { describe, it, expect } from 'vitest';
import { NutritionPlanUpdateSchema, MealInputSchema } from '../src/nutrition.js';

describe('nutrition schemas', () => {
  it('accepts a full plan update', () => {
    const result = NutritionPlanUpdateSchema.safeParse({
      daily_cals: 2200,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 70,
      notes: 'Sin lácteos',
      summary: 'Plan de recomposición',
      menu_plan: [{ day: 'Lunes', items: ['Avena', 'Pollo'] }],
      recommendations: ['Tomar 3L de agua'],
      closing_message: 'Nos vemos en la próxima revisión.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty patch (all fields optional)', () => {
    const result = NutritionPlanUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative macros', () => {
    const result = NutritionPlanUpdateSchema.safeParse({ daily_cals: -100 });
    expect(result.success).toBe(false);
  });

  it('accepts a valid meal input', () => {
    const result = MealInputSchema.safeParse({
      meal_time: 'Desayuno',
      name: 'Avena con fruta',
      calories: 350,
      protein_g: 20,
      carbs_g: 45,
      fat_g: 8,
      tags: ['alto en fibra'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a meal input missing the name', () => {
    const result = MealInputSchema.safeParse({ meal_time: 'Desayuno', calories: 350 });
    expect(result.success).toBe(false);
  });

  it('defaults meal macros to 0 when omitted', () => {
    const result = MealInputSchema.safeParse({ meal_time: 'Cena', name: 'Ensalada' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.calories).toBe(0);
      expect(result.data.protein_g).toBe(0);
    }
  });
});
