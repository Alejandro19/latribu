import { z } from 'zod';

export const CommunityEventInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  event_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  capacity: z.coerce.number().int().min(0).nullable().optional(),
  image_url: z.string().nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.coerce.number().int().nullable().optional(),
});
export type CommunityEventInput = z.infer<typeof CommunityEventInputSchema>;

export const CommunityTherapyInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  discount_pct: z.coerce.number().int().min(0).max(100).nullable().optional(),
  provider: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.coerce.number().int().nullable().optional(),
});
export type CommunityTherapyInput = z.infer<typeof CommunityTherapyInputSchema>;

export const CommunityRetreatInputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    capacity: z.coerce.number().int().min(0).nullable().optional(),
    price_cents: z.coerce.number().int().min(0).nullable().optional(),
    image_url: z.string().nullable().optional(),
    active: z.boolean().optional(),
    sort_order: z.coerce.number().int().nullable().optional(),
  })
  .refine(
    (data) => !data.start_date || !data.end_date || data.end_date >= data.start_date,
    { message: 'La fecha de fin debe ser posterior o igual a la de inicio.', path: ['end_date'] }
  );
export type CommunityRetreatInput = z.infer<typeof CommunityRetreatInputSchema>;