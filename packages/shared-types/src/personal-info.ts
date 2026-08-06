import { z } from 'zod';

export const PersonalInfoUpdateSchema = z.object({
  birthdate: z.string().date().optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  phone_code: z.string().optional(),
  phone_number: z.string().optional(),
  marital_status: z.string().optional(),
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  body_fat: z.coerce.number().optional(),
  onboarding_report: z.record(z.string(), z.unknown()).optional(),
  complete: z.boolean().optional(),
});
export type PersonalInfoUpdateInput = z.infer<typeof PersonalInfoUpdateSchema>;

export const AnthropometricRecordInputSchema = z.object({
  fecha: z.string().date().optional(),
  semana: z.coerce.number().int().optional(),
  mes_num: z.coerce.number().int().positive().optional(),
  peso: z.coerce.number().optional(),
  cintura: z.coerce.number().optional(),
  brazos: z.coerce.number().optional(),
  hombros: z.coerce.number().optional(),
  piernas: z.coerce.number().optional(),
  gluteo: z.coerce.number().optional(),
  notas: z.string().optional(),
});
export type AnthropometricRecordInput = z.infer<typeof AnthropometricRecordInputSchema>;

export const PhotoUploadMetadataSchema = z.object({
  angle: z.enum(['frente', 'lado_derecho', 'lado_izquierdo', 'espalda']).optional(),
  anthropometric_record_id: z.string().uuid().optional(),
  fecha: z.string().date().optional(),
  mes_num: z.coerce.number().int().positive().optional(),
});
export type PhotoUploadMetadata = z.infer<typeof PhotoUploadMetadataSchema>;

export const InbodyRecordInputSchema = z.object({
  fecha: z.string().date().optional(),
  version: z.string().optional(),
  peso_total: z.coerce.number().optional(),
  smm: z.coerce.number().optional(),
  grasa_pct: z.coerce.number().optional(),
  imc: z.coerce.number().optional(),
  peso_objetivo: z.coerce.number().optional(),
  grasa_visceral: z.coerce.number().optional(),
  bmr: z.coerce.number().optional(),
  angulo_fase: z.coerce.number().optional(),
  ecw_tbw: z.coerce.number().optional(),
  masa_osea: z.coerce.number().optional(),
  altura: z.coerce.number().optional(),
  mes_num: z.coerce.number().int().positive().optional(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
});
export type InbodyRecordInput = z.infer<typeof InbodyRecordInputSchema>;

export const OcrInputSchema = z.object({
  base64: z.string().min(1),
});
export type OcrInput = z.infer<typeof OcrInputSchema>;
