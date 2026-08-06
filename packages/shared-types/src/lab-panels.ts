import { z } from 'zod';

// Panel de laboratorios clínicos por checkpoint (semana 0/6/12) — módulo
// "Dispositivos y Laboratorios", solo cliente tipo Mentoring.
export const LabPanelInputSchema = z.object({
  semana: z.coerce.number().int().refine((n) => [0, 6, 12].includes(n), 'La semana debe ser 0, 6 o 12.'),
  fecha: z.string().min(1),
  datos: z.record(z.string(), z.coerce.number()),
});
export type LabPanelInput = z.infer<typeof LabPanelInputSchema>;
