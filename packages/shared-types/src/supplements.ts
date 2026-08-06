import { z } from 'zod';

export const SUPPLEMENT_CATEGORIES = ['Nootrópico', 'Adaptógeno', 'Sueño', 'Rendimiento', 'Base'] as const;
export const SupplementCategorySchema = z.enum(SUPPLEMENT_CATEGORIES);
export type SupplementCategory = z.infer<typeof SupplementCategorySchema>;

export const SupplementInputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  dose: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  benefit: z.string().nullable().optional(),
  category: SupplementCategorySchema.optional(),
  active: z.boolean().optional(),
});
export type SupplementInput = z.infer<typeof SupplementInputSchema>;
