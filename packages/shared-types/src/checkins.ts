import { z } from 'zod';

// Check-ins de baja fricción (Fase C) — pulso diario y reflexión semanal,
// exclusivos del tier Mentoría. Ver Matriz_Reglas_Mentoria_BIO360.md, pestaña
// "Check-ins y Fricción".
export const DailyCheckinInputSchema = z.object({
  pulsoAnimo: z.coerce.number().int().min(1).max(5),
});
export type DailyCheckinInput = z.infer<typeof DailyCheckinInputSchema>;

export const WeeklyReflectionInputSchema = z.object({
  estresCronico: z.coerce.number().int().min(1).max(10),
  tecnicasManejoUsadas: z.string().optional(),
  despertaresNocturnosSemana: z.enum(['Ninguno', '1-2', '3+']).optional(),
});
export type WeeklyReflectionInput = z.infer<typeof WeeklyReflectionInputSchema>;
