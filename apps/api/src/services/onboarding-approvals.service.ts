import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clientNotifications, labPanels, type Client } from '../models/schema.js';
import { findClientById, updateClient } from './clients.service.js';

export class WearableNotReadyError extends Error {
  constructor() {
    super('Aún no se alcanzan los 7 días mínimos de datos de wearable.');
    this.name = 'WearableNotReadyError';
  }
}

// Cuando baseline + wearable + laboratorio semana 0 quedan aprobados
// simultáneamente por primera vez, dispara la notificación de "Semana 1" y
// marca week1ActivatedAt — idempotente, nunca se repite. Se llama tras CADA
// aprobación individual (baseline, wearable, o laboratorio semana 0).
async function checkWeek1Activation(clientId: string): Promise<void> {
  const client = await findClientById(clientId);
  if (!client || client.week1ActivatedAt) return;
  if (!client.baselineApprovedAt || !client.wearableApprovedAt) return;

  const [labWeek0] = await db
    .select({ status: labPanels.status })
    .from(labPanels)
    .where(and(eq(labPanels.clientId, clientId), eq(labPanels.semanaNumero, 0)));
  if (!labWeek0 || labWeek0.status !== 'aprobado') return;

  await updateClient(clientId, { week1ActivatedAt: new Date() });
  await db.insert(clientNotifications).values({
    clientId,
    message: 'Tu Semana 1 y tu protocolo inicial están en proceso — el equipo lo está preparando con tus datos ya validados.',
  });
}

export async function approveBaseline(clientId: string): Promise<Client | null> {
  const client = await updateClient(clientId, { baselineApprovedAt: new Date() });
  if (!client) return null;
  await db.insert(clientNotifications).values({ clientId, message: 'Tu baseline (cuestionario + InBody) fue validado por el equipo.' });
  await checkWeek1Activation(clientId);
  return client;
}

export async function approveWearable(clientId: string): Promise<Client | null> {
  const existing = await findClientById(clientId);
  if (!existing) return null;
  if (!existing.wearableBaselineReadyAt) throw new WearableNotReadyError();

  const client = await updateClient(clientId, { wearableApprovedAt: new Date() });
  if (!client) return null;
  await db.insert(clientNotifications).values({ clientId, message: 'Tu conexión de wearable fue validada por el equipo.' });
  await checkWeek1Activation(clientId);
  return client;
}

// Expuesto para que lab-panels.controller.ts lo llame tras aprobar
// específicamente el checkpoint semana 0 (los checkpoints 6/12 no afectan
// Semana 1, que ya arrancó para ese cliente).
export { checkWeek1Activation };
