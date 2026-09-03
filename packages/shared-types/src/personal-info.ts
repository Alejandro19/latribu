import { z } from 'zod';
import { MENTORING_CARGO_TYPES, MENTORING_SECTORS } from './mentoring-benchmark.js';

export const PersonalInfoUpdateSchema = z.object({
  name: z.string().optional(),
  age: z.coerce.number().optional(),
  birthdate: z.string().date().optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  cedula: z.string().optional(),
  id_type: z.string().optional(),
  email: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  phone_code: z.string().optional(),
  phone_number: z.string().optional(),
  marital_status: z.string().optional(),
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  body_fat: z.coerce.number().optional(),
  // Salud hormonal (Módulo 1) — P1 recomendado para todos los tiers, P2/P3
  // (last_period_date/cycle_length_days) solo tienen sentido para Mentoría
  // pero se aceptan igual acá; el gate real vive en el wizard (onlyVariant).
  hormonal_status: z.string().optional(),
  hormonal_status_other: z.string().optional(),
  last_period_date: z.string().date().optional(),
  cycle_length_days: z.coerce.number().int().optional(),
  // Sueño (Módulo 6) — apnea del sueño (SUE-07), todos los tiers.
  snores: z.string().optional(),
  sleep_apnea_signs: z.string().optional(),
  onboarding_report: z.record(z.string(), z.unknown()).optional(),
  complete: z.boolean().optional(),
  // Segmentación para el benchmark comparativo de Mentoría — la llena un
  // admin a mano desde la ficha del cliente, nunca el wizard de onboarding.
  cargo_type: z.enum(MENTORING_CARGO_TYPES).optional(),
  sector: z.enum(MENTORING_SECTORS).optional(),
  // true cuando el cliente llenó los campos manuales de Apple Health en el
  // Módulo 10 (sin OAuth real) — única señal server-side de "wearable
  // conectado" para ese caso, ver onboarding.service.ts.
  apple_health_connected: z.boolean().optional(),
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
