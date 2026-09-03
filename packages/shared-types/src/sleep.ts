import { z } from 'zod';

export const SleepProtocolUpdateSchema = z.object({
  protocol_text: z.string().nullable().optional(),
  sleep_window: z.string().nullable().optional(),
  supplement: z.string().nullable().optional(),
});
export type SleepProtocolUpdate = z.infer<typeof SleepProtocolUpdateSchema>;

export const SleepLogInputSchema = z.object({
  hours: z.coerce.number().min(0).max(24),
  quality: z.coerce.number().int().min(1).max(5),
});
export type SleepLogInput = z.infer<typeof SleepLogInputSchema>;
