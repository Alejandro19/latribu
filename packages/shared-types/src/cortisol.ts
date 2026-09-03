import { z } from 'zod';

export const CORTISOL_TECHNIQUE_TYPES = [
  'Respiración', 'Breathwork', 'Meditación', 'Mindfulness',
  'Respiración Vagal', 'Exposición Controlada', 'Recuperación Activa',
] as const;
export const CortisolTechniqueTypeSchema = z.enum(CORTISOL_TECHNIQUE_TYPES);
export type CortisolTechniqueType = z.infer<typeof CortisolTechniqueTypeSchema>;

// Subsección "Regulación del Sistema Nervioso" (Neurowellness, exclusivo
// Mentoría) — entrenamiento proactivo de la capacidad de regulación, no
// respuesta reactiva a un cortisol elevado. Ver ClientCortisolPanel.tsx.
export const NEUROWELLNESS_TECHNIQUE_TYPES = ['Respiración Vagal', 'Exposición Controlada', 'Recuperación Activa'] as const;

export const CORTISOL_EMOTIONS = ['ansioso', 'irritable', 'cansado', 'abrumado', 'tranquilo', 'energia'] as const;
export const CortisolEmotionSchema = z.enum(CORTISOL_EMOTIONS);
export type CortisolEmotion = z.infer<typeof CortisolEmotionSchema>;

export const CortisolTechniqueInputSchema = z.object({
  title: z.string().min(1),
  type: CortisolTechniqueTypeSchema.optional(),
  duration: z.string().nullable().optional(),
  duration_minutes: z.coerce.number().int().min(0).nullable().optional(),
  duration_seconds: z.coerce.number().int().min(0).nullable().optional(),
  description: z.string().nullable().optional(),
  youtube_url: z.string().url().nullable().optional(),
  // Emoción para la que esta técnica es la recomendación del hero en el
  // panel de cliente — null/omitida si no está asignada a ninguna.
  emotion: CortisolEmotionSchema.nullable().optional(),
  // Aviso visible de precaución/contraindicación — relevante sobre todo para
  // "Exposición Controlada" (frío/calor), pero disponible para cualquier tipo.
  precaution_note: z.string().nullable().optional(),
  // "The Rox Ritual" (bloque fijo de 3 rituales en Stress) reutiliza esta
  // misma tabla — is_ritual es lo único que distingue a una técnica-ritual.
  is_ritual: z.boolean().optional(),
});
export type CortisolTechniqueInput = z.infer<typeof CortisolTechniqueInputSchema>;

// Check-in matutino de autorreporte (reemplaza la fuente inexistente de
// "Cortisol AM") — 3 preguntas 1-5, ver Prompt 02 §5 parte 1.
export const MorningCheckinInputSchema = z.object({
  energia: z.coerce.number().int().min(1).max(5),
  tension: z.coerce.number().int().min(1).max(5),
  claridad: z.coerce.number().int().min(1).max(5),
});
export type MorningCheckinInput = z.infer<typeof MorningCheckinInputSchema>;

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
