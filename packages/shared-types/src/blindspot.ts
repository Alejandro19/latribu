import { z } from 'zod';

// Módulo "Punto Ciego" — evaluación de alto nivel + referido a terapeuta,
// exclusivo de clientes tipo Mentoring.

export const BlindspotCaseStatusSchema = z.enum(['evaluando', 'referido', 'en_proceso', 'cerrado']);
export const BlindspotTaskStatusSchema = z.enum(['pendiente', 'completada', 'omitida']);
export const BlindspotProgressMarkerSchema = z.enum(['avance', 'estable', 'retroceso', 'cerrado']);

export const BlindspotInitialAssessmentSchema = z.object({
  motivoConsulta: z.string().min(1).max(500),
  areaPercibida: z.string().min(1).max(500),
  prioridad: z.enum(['alta', 'media', 'baja']),
});

export const BlindspotCaseCreateSchema = z.object({
  clientId: z.string().uuid(),
  initialAssessment: BlindspotInitialAssessmentSchema,
});
export type BlindspotCaseCreateInput = z.infer<typeof BlindspotCaseCreateSchema>;

export const BlindspotCaseUpdateSchema = z.object({
  status: BlindspotCaseStatusSchema.optional(),
  therapistId: z.string().uuid().nullable().optional(),
  adminPrivateNotes: z.string().max(2000).nullable().optional(),
});
export type BlindspotCaseUpdateInput = z.infer<typeof BlindspotCaseUpdateSchema>;

export const BlindspotTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  dueDate: z.string().nullable().optional(),
});
export type BlindspotTaskInput = z.infer<typeof BlindspotTaskInputSchema>;

export const BlindspotTaskUpdateSchema = z.object({
  status: BlindspotTaskStatusSchema,
});
export type BlindspotTaskUpdateInput = z.infer<typeof BlindspotTaskUpdateSchema>;

export const BlindspotSessionLogInputSchema = z.object({
  sessionDate: z.string().min(1),
  progressMarker: BlindspotProgressMarkerSchema,
  internalSummary: z.string().max(500).nullable().optional(),
  clientNote: z.string().max(500).nullable().optional(),
});
export type BlindspotSessionLogInput = z.infer<typeof BlindspotSessionLogInputSchema>;

export const TherapistCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  specialty: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
});
export type TherapistCreateInput = z.infer<typeof TherapistCreateSchema>;

export const TherapistUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  specialty: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  active: z.boolean().optional(),
});
export type TherapistUpdateInput = z.infer<typeof TherapistUpdateSchema>;
