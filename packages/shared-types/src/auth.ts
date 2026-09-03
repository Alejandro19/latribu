import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

// Evidencia de aceptación de la Política de Tratamiento de Datos y los
// Términos de Uso (ver AceptacionRegistro.jsx en apps/web) — usada hoy por el
// flujo de re-aceptación en el panel de Configuración de cuenta.
// `sensitiveDataConsent` se valida como boolean, no z.literal(true): el
// componente de UI solo llama a onComplete cuando las 3 casillas quedaron
// marcadas, pero este endpoint no debe acoplarse a ese detalle de una
// versión futura del componente.
export const LegalAcceptanceInputSchema = z.object({
  dataPolicyVersion: z.string().min(1),
  termsVersion: z.string().min(1),
  sensitiveDataConsent: z.boolean(),
  acceptedAt: z.string().datetime(),
});
export type LegalAcceptanceInput = z.infer<typeof LegalAcceptanceInputSchema>;

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const GoogleAuthInputSchema = z.object({
  credential: z.string().min(1),
});
export type GoogleAuthInput = z.infer<typeof GoogleAuthInputSchema>;

export const AppleAuthInputSchema = z.object({
  identityToken: z.string().min(1),
  // Apple solo manda el nombre la primera vez que el usuario autoriza la
  // app — en logins posteriores viene undefined y hay que usar el que ya
  // se guardó en el registro.
  name: z.string().min(1).optional(),
});
export type AppleAuthInput = z.infer<typeof AppleAuthInputSchema>;

export const ForgotPasswordInputSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
