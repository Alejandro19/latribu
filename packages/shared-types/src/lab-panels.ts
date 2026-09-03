import { z } from 'zod';

// Panel de laboratorios clínicos por checkpoint (semana 0/6/12) — módulo
// "Dispositivos y Laboratorios", solo cliente tipo Mentoring.
export const LabPanelInputSchema = z.object({
  semana: z.coerce.number().int().refine((n) => [0, 6, 12].includes(n), 'La semana debe ser 0, 6 o 12.'),
  fecha: z.string().min(1),
  datos: z.record(z.string(), z.coerce.number()),
  // Día del ciclo menstrual en la fecha del panel (P6) — solo mujeres
  // Mentoría con ciclo natural; auto-calculado en el frontend o corregido a mano.
  diaCicloPanel: z.coerce.number().int().optional(),
  // Presentes cuando el guardado viene de la extracción OCR+IA (ver
  // POST .../lab-panels/extract) — ausentes si se guarda de otra forma.
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  sourceFileHash: z.string().optional(),
});
export type LabPanelInput = z.infer<typeof LabPanelInputSchema>;

// Corrección + aprobación del admin sobre un panel ya guardado (ver
// lab-panels.controller.ts::approveLabPanel) — `datos` es opcional: el admin
// puede aprobar sin cambiar nada.
export const LabPanelApproveInputSchema = z.object({
  datos: z.record(z.string(), z.coerce.number()).optional(),
});
export type LabPanelApproveInput = z.infer<typeof LabPanelApproveInputSchema>;
