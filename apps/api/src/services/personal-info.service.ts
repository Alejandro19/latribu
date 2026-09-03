import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { db } from '../db/index.js';
import { personalInfo, adminNotifications, type PersonalInfo } from '../models/schema.js';
import { findClientById } from './clients.service.js';
import { uploadFile } from '../storage/index.js';
import type { PersonalInfoUpdateInput } from '@latribu/shared-types';

export async function getPersonalInfoByClientId(clientId: string): Promise<PersonalInfo | null> {
  const rows = await db.select().from(personalInfo).where(eq(personalInfo.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

async function sendClientNotification(clientId: string, info: Pick<PersonalInfo, 'country' | 'city' | 'weight' | 'height'>): Promise<void> {
  const EMAIL_HOST = process.env.EMAIL_HOST;
  const EMAIL_PORT = process.env.EMAIL_PORT;
  const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;
  const EMAIL_FROM = process.env.NOTIFICATION_FROM || 'no-reply@latribu.com';
  const EMAIL_TO = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_TO || 'g619alejandro@gmail.com';

  const subject = `Ephirox: onboarding completado cliente ${clientId}`;
  const summary = [`<strong>ID:</strong> ${clientId}`];
  if (info.country) summary.push(`<strong>País:</strong> ${info.country}`);
  if (info.city) summary.push(`<strong>Ciudad:</strong> ${info.city}`);
  if (info.weight) summary.push(`<strong>Peso:</strong> ${info.weight}`);
  if (info.height) summary.push(`<strong>Altura:</strong> ${info.height}`);
  const html = `<p>El cliente ha completado el proceso de onboarding personal.</p><p>${summary.join('<br>')}</p>`;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.log('sendClientNotification: email config no disponible, se omite el envío.', { clientId });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT),
      secure: EMAIL_SECURE,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    await transporter.sendMail({ from: EMAIL_FROM, to: EMAIL_TO, subject, html });
  } catch (e) {
    console.error('sendClientNotification error', e);
  }
}

export async function upsertPersonalInfo(clientId: string, input: PersonalInfoUpdateInput): Promise<PersonalInfo> {
  const existing = await getPersonalInfoByClientId(clientId);
  const wasAlreadyComplete = !!(existing && existing.completedAt);

  // Zod (packages/shared-types) usa el mismo wire format snake_case que el
  // legacy (phone_code, body_fat, onboarding_report...); Drizzle espera las
  // propiedades camelCase declaradas en schema.ts. El mapeo debe ser
  // explícito — spreadear `input` directamente insertaría columnas nulas.
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.age !== undefined) patch.age = input.age;
  if (input.birthdate !== undefined) patch.birthdate = input.birthdate;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.occupation !== undefined) patch.occupation = input.occupation;
  if (input.cedula !== undefined) patch.cedula = input.cedula;
  if (input.id_type !== undefined) patch.idType = input.id_type;
  if (input.email !== undefined) patch.email = input.email;
  if (input.country !== undefined) patch.country = input.country;
  if (input.city !== undefined) patch.city = input.city;
  if (input.phone_code !== undefined) patch.phoneCode = input.phone_code;
  if (input.phone_number !== undefined) patch.phoneNumber = input.phone_number;
  if (input.marital_status !== undefined) patch.maritalStatus = input.marital_status;
  if (input.weight !== undefined) patch.weight = input.weight;
  if (input.height !== undefined) patch.height = input.height;
  if (input.body_fat !== undefined) patch.bodyFat = input.body_fat;
  if (input.hormonal_status !== undefined) patch.hormonalStatus = input.hormonal_status;
  if (input.hormonal_status_other !== undefined) patch.hormonalStatusOther = input.hormonal_status_other;
  if (input.last_period_date !== undefined) patch.lastPeriodDate = input.last_period_date;
  // cycleLengthConfirmedAt se pisa automáticamente cada vez que se guarda un
  // cycle_length_days — onboarding y la revisión periódica de Fase C usan el
  // mismo campo, sin que el caller tenga que acordarse de mandarlo aparte.
  if (input.cycle_length_days !== undefined) {
    patch.cycleLengthDays = input.cycle_length_days;
    patch.cycleLengthConfirmedAt = new Date();
  }
  if (input.snores !== undefined) patch.snores = input.snores;
  if (input.sleep_apnea_signs !== undefined) patch.sleepApneaSigns = input.sleep_apnea_signs;
  if (input.cargo_type !== undefined) patch.cargoType = input.cargo_type;
  if (input.sector !== undefined) patch.sector = input.sector;
  if (input.apple_health_connected !== undefined) patch.appleHealthConnected = input.apple_health_connected;
  if (input.onboarding_report !== undefined) patch.onboardingReport = input.onboarding_report;
  if (input.complete) patch.completedAt = new Date();

  const [info] = await db
    .insert(personalInfo)
    .values({ clientId, ...patch })
    .onConflictDoUpdate({ target: personalInfo.clientId, set: patch })
    .returning();

  if (input.complete) {
    await sendClientNotification(clientId, info);
    if (!wasAlreadyComplete) {
      const client = await findClientById(clientId);
      await db.insert(adminNotifications).values({
        clientId,
        type: 'onboarding_complete',
        message: `${client ? client.name : 'Un cliente'} completó su información personal.`,
      });
    }
  }

  return info;
}

export class InvalidFileTypeError extends Error {
  constructor() {
    super('Formato inválido. Usa PDF o JPG/PNG.');
    this.name = 'InvalidFileTypeError';
  }
}

const ALLOWED_CHECKUP_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export async function uploadCheckupFile(
  clientId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string },
  onboardingReportRaw: unknown
): Promise<{ file_url: string; file_name: string; uploaded_at: string }> {
  if (!ALLOWED_CHECKUP_MIMETYPES.includes(file.mimetype)) {
    throw new InvalidFileTypeError();
  }
  const fileUrl = await uploadFile(`${clientId}/checkups`, file.buffer, file.mimetype, file.originalname);

  let report: Record<string, unknown> = {};
  if (onboardingReportRaw && typeof onboardingReportRaw === 'object') {
    report = onboardingReportRaw as Record<string, unknown>;
  } else if (typeof onboardingReportRaw === 'string') {
    try {
      report = JSON.parse(onboardingReportRaw);
    } catch {
      report = {};
    }
  }

  const uploadedAt = new Date().toISOString();
  const mergedReport = { ...report, checkup_file_url: fileUrl, checkup_file_name: file.originalname, checkup_uploaded_at: uploadedAt };

  await db
    .insert(personalInfo)
    .values({ clientId, onboardingReport: mergedReport })
    .onConflictDoUpdate({ target: personalInfo.clientId, set: { onboardingReport: mergedReport, updatedAt: new Date() } });

  return { file_url: fileUrl, file_name: file.originalname, uploaded_at: uploadedAt };
}
