import { eq, desc } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { db } from '../db/index.js';
import { renderEmailHtml } from './email-template.js';
import {
  blindspotCases,
  blindspotTasks,
  blindspotSessionLogs,
  adminNotifications,
  clients,
  type BlindspotCase,
  type BlindspotTask,
  type BlindspotSessionLog,
} from '../models/schema.js';
import type {
  BlindspotCaseCreateInput,
  BlindspotCaseUpdateInput,
  BlindspotTaskInput,
  BlindspotTaskUpdateInput,
  BlindspotSessionLogInput,
} from '@latribu/shared-types';

export async function listCases(): Promise<BlindspotCase[]> {
  return db.select().from(blindspotCases).orderBy(desc(blindspotCases.createdAt));
}

export async function getCaseById(id: string): Promise<BlindspotCase | null> {
  const rows = await db.select().from(blindspotCases).where(eq(blindspotCases.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCaseByClientId(clientId: string): Promise<BlindspotCase | null> {
  const rows = await db.select().from(blindspotCases).where(eq(blindspotCases.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

export async function createCase(input: BlindspotCaseCreateInput): Promise<BlindspotCase> {
  const [blindspotCase] = await db
    .insert(blindspotCases)
    .values({ clientId: input.clientId, initialAssessment: input.initialAssessment })
    .returning();
  return blindspotCase;
}

export async function updateCase(id: string, input: BlindspotCaseUpdateInput): Promise<BlindspotCase | null> {
  const [updated] = await db
    .update(blindspotCases)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(blindspotCases.id, id))
    .returning();
  return updated ?? null;
}

export async function acknowledgeCrisis(id: string): Promise<void> {
  await db.update(blindspotCases).set({ crisisFlag: false }).where(eq(blindspotCases.id, id));
}

export async function listTasksByCaseId(caseId: string): Promise<BlindspotTask[]> {
  return db.select().from(blindspotTasks).where(eq(blindspotTasks.caseId, caseId)).orderBy(desc(blindspotTasks.createdAt));
}

export async function createTask(caseId: string, therapistId: string, input: BlindspotTaskInput): Promise<BlindspotTask> {
  const [task] = await db
    .insert(blindspotTasks)
    .values({ caseId, createdBy: therapistId, title: input.title, description: input.description, dueDate: input.dueDate ?? undefined })
    .returning();
  return task;
}

export async function getTaskById(id: string): Promise<BlindspotTask | null> {
  const rows = await db.select().from(blindspotTasks).where(eq(blindspotTasks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateTaskStatus(id: string, input: BlindspotTaskUpdateInput): Promise<BlindspotTask | null> {
  const completedAt = input.status === 'completada' ? new Date() : null;
  const [updated] = await db
    .update(blindspotTasks)
    .set({ status: input.status, completedAt })
    .where(eq(blindspotTasks.id, id))
    .returning();
  return updated ?? null;
}

export async function listSessionLogsByCaseId(caseId: string): Promise<BlindspotSessionLog[]> {
  return db.select().from(blindspotSessionLogs).where(eq(blindspotSessionLogs.caseId, caseId)).orderBy(desc(blindspotSessionLogs.sessionDate));
}

export async function createSessionLog(caseId: string, therapistId: string, input: BlindspotSessionLogInput): Promise<BlindspotSessionLog> {
  const [log] = await db
    .insert(blindspotSessionLogs)
    .values({
      caseId,
      createdBy: therapistId,
      sessionDate: input.sessionDate,
      progressMarker: input.progressMarker,
      internalSummary: input.internalSummary,
      clientNote: input.clientNote,
    })
    .returning();
  // Un cierre de proceso reportado en sesión mueve el caso a 'en_proceso' si
  // seguía en 'referido' — visibilidad automática sin paso manual del admin.
  const current = await getCaseById(caseId);
  if (current && current.status === 'referido') {
    await db.update(blindspotCases).set({ status: 'en_proceso', updatedAt: new Date() }).where(eq(blindspotCases.id, caseId));
  }
  return log;
}

async function sendCrisisEmail(clientName: string, raisedBy: string, caseId: string): Promise<void> {
  const EMAIL_HOST = process.env.EMAIL_HOST;
  const EMAIL_PORT = process.env.EMAIL_PORT;
  const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_PASS = process.env.EMAIL_PASS;
  const EMAIL_FROM = process.env.NOTIFICATION_FROM || 'no-reply@latribu.com';
  const EMAIL_TO = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_TO || 'g619alejandro@gmail.com';

  const subject = `URGENTE — Alerta de crisis en Punto Ciego: ${clientName}`;
  const html = renderEmailHtml({
    preheader: `Alerta de crisis: ${clientName}`,
    bodyHtml: `<p style="margin:0 0 12px;"><strong>Se levantó una alerta de crisis</strong> en el módulo Punto Ciego.</p>
<p style="margin:0 0 12px;"><strong>Cliente:</strong> ${clientName}<br>
<strong>Levantada por:</strong> ${raisedBy}<br>
<strong>Caso:</strong> ${caseId}</p>
<p style="margin:0;">Entra al panel admin para atender el caso lo antes posible.</p>`,
  });

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.log('sendCrisisEmail: email config no disponible, se omite el envío.', { caseId });
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
    console.error('sendCrisisEmail error', e);
  }
}

export async function raiseCrisis(caseId: string, raisedBy: 'cliente' | 'terapeuta' | 'admin'): Promise<void> {
  const blindspotCase = await getCaseById(caseId);
  if (!blindspotCase) return;

  await db
    .update(blindspotCases)
    .set({ crisisFlag: true, crisisFlaggedAt: new Date(), crisisFlaggedBy: raisedBy })
    .where(eq(blindspotCases.id, caseId));

  const clientRows = await db.select().from(clients).where(eq(clients.id, blindspotCase.clientId)).limit(1);
  const clientName = clientRows[0]?.name ?? 'Cliente desconocido';

  await db.insert(adminNotifications).values({
    clientId: blindspotCase.clientId,
    type: 'blindspot_crisis',
    message: `Alerta de crisis en Punto Ciego para ${clientName} (levantada por ${raisedBy}).`,
  });

  await sendCrisisEmail(clientName, raisedBy, caseId);
}
