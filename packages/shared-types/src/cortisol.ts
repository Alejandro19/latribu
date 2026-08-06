import { z } from 'zod';

export const CORTISOL_TECHNIQUE_TYPES = ['Respiración', 'Breathwork', 'Meditación', 'Mindfulness'] as const;
export const CortisolTechniqueTypeSchema = z.enum(CORTISOL_TECHNIQUE_TYPES);
export type CortisolTechniqueType = z.infer<typeof CortisolTechniqueTypeSchema>;

export const CortisolTechniqueInputSchema = z.object({
  title: z.string().min(1),
  type: CortisolTechniqueTypeSchema.optional(),
  duration: z.string().nullable().optional(),
  duration_minutes: z.coerce.number().int().min(0).nullable().optional(),
  duration_seconds: z.coerce.number().int().min(0).nullable().optional(),
  description: z.string().nullable().optional(),
  youtube_url: z.string().url().nullable().optional(),
});
export type CortisolTechniqueInput = z.infer<typeof CortisolTechniqueInputSchema>;

export const CORTISOL_EMOTIONS = ['ansioso', 'irritable', 'cansado', 'abrumado', 'tranquilo', 'energia'] as const;
export const CortisolEmotionSchema = z.enum(CORTISOL_EMOTIONS);
export type CortisolEmotion = z.infer<typeof CortisolEmotionSchema>;

export const CortisolCheckinInputSchema = z.object({
  emotion: CortisolEmotionSchema,
});
export type CortisolCheckinInput = z.infer<typeof CortisolCheckinInputSchema>;

export const CortisolCompletionInputSchema = z.object({
  technique_id: z.string().uuid().nullable().optional(),
});
export type CortisolCompletionInput = z.infer<typeof CortisolCompletionInputSchema>;

export const CortisolTipInputSchema = z.object({
  content: z.string().min(1),
});
export type CortisolTipInput = z.infer<typeof CortisolTipInputSchema>;

export const CortisolTipUpdateSchema = z.object({
  content: z.string().min(1).optional(),
  active: z.boolean().optional(),
});
export type CortisolTipUpdate = z.infer<typeof CortisolTipUpdateSchema>;
