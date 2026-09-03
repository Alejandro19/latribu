import { z } from 'zod';

export const EXERCISE_CATEGORIES = ['warmup', 'strength', 'core', 'cardio', 'stretching'] as const;
export const ExerciseCategorySchema = z.enum(EXERCISE_CATEGORIES);
export type ExerciseCategory = z.infer<typeof ExerciseCategorySchema>;

export const ExerciseInputSchema = z.object({
  title: z.string().min(1),
  day_number: z.coerce.number().int().min(1).max(7),
  category: ExerciseCategorySchema,
  series: z.coerce.number().int().min(1).nullable().optional(),
  reps: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  rest_time: z.string().nullable().optional(),
  youtube_url: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  recommendations: z.string().nullable().optional(),
});
export type ExerciseInput = z.infer<typeof ExerciseInputSchema>;

export const ExerciseOrderPatchSchema = z.object({
  direction: z.enum(['up', 'down']),
});
export type ExerciseOrderPatch = z.infer<typeof ExerciseOrderPatchSchema>;

export const TrainingDaysPatchSchema = z.object({
  training_days: z.coerce.number().int().min(1).max(7),
});
export type TrainingDaysPatch = z.infer<typeof TrainingDaysPatchSchema>;

export const ConfirmSessionInputSchema = z.object({
  tz: z.string().min(1),
  source: z.enum(['manual', 'nfc']).optional(),
});
export type ConfirmSessionInput = z.infer<typeof ConfirmSessionInputSchema>;

export const AssignedQuotePatchSchema = z.object({
  quote_id: z.string().uuid().nullable(),
});
export type AssignedQuotePatch = z.infer<typeof AssignedQuotePatchSchema>;
