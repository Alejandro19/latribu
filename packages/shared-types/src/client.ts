import { z } from 'zod';

export const ClientCreateInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  plan: z.string().optional(),
});
export type ClientCreateInput = z.infer<typeof ClientCreateInputSchema>;

// Campos que el propio dueño del registro o un admin pueden editar por esta
// ruta. status/permissions/client_type/plan-dates tienen sus propias rutas
// PATCH dedicadas (ver PermissionsPatchSchema y compañía) y no se aceptan aquí.
export const ClientUpdateInputSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  plan: z.string().optional(),
  objetivos: z.record(z.string(), z.string()).optional(),
  inbodyCadenceType: z.enum(['mensual', 'bimestral', 'personalizado']).optional(),
  inbodyNextExpectedDate: z.string().nullable().optional(),
  inbodyReminderEnabled: z.boolean().optional(),
}).strict();
export type ClientUpdateInput = z.infer<typeof ClientUpdateInputSchema>;

export const PermissionsPatchSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
});
export type PermissionsPatch = z.infer<typeof PermissionsPatchSchema>;

export const StatusPatchSchema = z.object({
  status: z.enum(['active', 'inactive']),
});
export type StatusPatch = z.infer<typeof StatusPatchSchema>;

export const CLIENT_TYPES = ['coaching_1_1', 'coaching_online', 'lead_wellness', 'mentoring'] as const;
export const ClientTypePatchSchema = z.object({
  client_type: z.enum(CLIENT_TYPES),
});
export type ClientTypePatch = z.infer<typeof ClientTypePatchSchema>;

export const RenewPlanPatchSchema = z.union([
  z.object({
    plan_start_date: z.string().date(),
    plan_end_date: z.string().date(),
  }),
  z.object({
    duration_days: z.coerce.number().refine((v) => v === 30 || v === 90, {
      message: 'Duración de plan inválida. Usa 30 o 90 días.',
    }),
  }),
]);
export type RenewPlanPatch = z.infer<typeof RenewPlanPatchSchema>;
