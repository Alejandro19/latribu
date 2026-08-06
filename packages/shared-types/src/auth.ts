import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

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
