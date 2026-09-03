import { z } from 'zod';

export const EvolutionCheckinInputSchema = z.object({
  fecha: z.string().min(1),
  strength_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  mood_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  confidence_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  security_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  energy_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  sleep_hours: z.coerce.number().min(0).max(24).nullable().optional(),
  adherence_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  pain_flag: z.boolean().nullable().optional(),
  pain_notes: z.string().nullable().optional(),
  stress_score: z.coerce.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type EvolutionCheckinInput = z.infer<typeof EvolutionCheckinInputSchema>;

export const PersonalRecordInputSchema = z.object({
  exercise_name: z.string().min(1),
  initial_value: z.string().nullable().optional(),
  current_value: z.string().nullable().optional(),
  sort_order: z.coerce.number().int().default(0),
});
export type PersonalRecordInput = z.infer<typeof PersonalRecordInputSchema>;
