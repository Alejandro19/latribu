import { z } from 'zod';

export const NutritionPlanUpdateSchema = z.object({
  daily_cals: z.coerce.number().int().min(0).optional(),
  protein_g: z.coerce.number().int().min(0).optional(),
  carbs_g: z.coerce.number().int().min(0).optional(),
  fat_g: z.coerce.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  client_observations: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  menu_plan: z.array(z.record(z.string(), z.unknown())).optional(),
  recommendations: z.array(z.string()).optional(),
  closing_message: z.string().nullable().optional(),
});
export type NutritionPlanUpdate = z.infer<typeof NutritionPlanUpdateSchema>;

export const MealInputSchema = z.object({
  meal_time: z.string().min(1),
  name: z.string().min(1),
  calories: z.coerce.number().int().min(0).default(0),
  protein_g: z.coerce.number().int().min(0).default(0),
  carbs_g: z.coerce.number().int().min(0).default(0),
  fat_g: z.coerce.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
});
export type MealInput = z.infer<typeof MealInputSchema>;

export const MealUpdateInputSchema = z.object({
  meal_time: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  calories: z.coerce.number().int().min(0).optional(),
  protein_g: z.coerce.number().int().min(0).optional(),
  carbs_g: z.coerce.number().int().min(0).optional(),
  fat_g: z.coerce.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
});
export type MealUpdateInput = z.infer<typeof MealUpdateInputSchema>;

export const NutritionTipInputSchema = z.object({
  content: z.string().min(1),
});
export type NutritionTipInput = z.infer<typeof NutritionTipInputSchema>;

export const NutritionTipUpdateSchema = z.object({
  content: z.string().min(1).optional(),
  active: z.boolean().optional(),
});
export type NutritionTipUpdate = z.infer<typeof NutritionTipUpdateSchema>;
