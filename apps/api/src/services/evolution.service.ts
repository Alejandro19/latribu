import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { evolutionCheckins, anthropometricRecords, bioInbodyRecords, clients, adminNotifications } from '../models/schema.js';
import type { EvolutionCheckin, Client } from '../models/schema.js';
import type { EvolutionCheckinInput } from '@latribu/shared-types';

// checkInbodyReminder — lógica reactiva sin cron (port de server.js:2085-2101)
async function checkInbodyReminder(client: Client | undefined) {
  if (!client || !client.inbodyReminderEnabled || !client.inbodyNextExpectedDate || client.inbodyReminderSentThisCycle) return;
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  const target = new Date(client.inbodyNextExpectedDate + 'T00:00:00');
  const daysUntil = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (daysUntil !== 7) return;
  try {
    await db.insert(adminNotifications).values({
      clientId: client.id,
      type: 'inbody_reminder',
      message: `${client.name} — InBody en 7 días. Próxima medición esperada el ${client.inbodyNextExpectedDate} (cadencia: ${client.inbodyCadenceType}). Confirma que tenga su cita de valoración agendada.`,
    });
    await db.update(clients).set({ inbodyReminderSentThisCycle: true }).where(eq(clients.id, client.id));
  } catch (e) {
    console.error('checkInbodyReminder: no fatal', e);
  }
}

export async function getEvolutionData(clientId: string) {
  const [checkins, anthropometrics, inbody, clientRows] = await Promise.all([
    db.select().from(evolutionCheckins).where(eq(evolutionCheckins.clientId, clientId)).orderBy(asc(evolutionCheckins.fecha)),
    db.select().from(anthropometricRecords).where(eq(anthropometricRecords.clientId, clientId)).orderBy(asc(anthropometricRecords.fecha)),
    db.select().from(bioInbodyRecords).where(eq(bioInbodyRecords.clientId, clientId)).orderBy(asc(bioInbodyRecords.fecha)),
    db.select().from(clients).where(eq(clients.id, clientId)).limit(1),
  ]);
  checkInbodyReminder(clientRows[0]).catch(() => {});
  return { checkins, anthropometrics, inbody };
}

export async function createCheckin(clientId: string, input: EvolutionCheckinInput): Promise<EvolutionCheckin> {
  const [checkin] = await db.insert(evolutionCheckins).values({
    clientId,
    fecha: input.fecha,
    strengthScore: input.strength_score ?? null,
    moodScore: input.mood_score ?? null,
    confidenceScore: input.confidence_score ?? null,
    securityScore: input.security_score ?? null,
    energyScore: input.energy_score ?? null,
    sleepHours: input.sleep_hours ?? null,
    adherencePct: input.adherence_pct ?? null,
    painFlag: input.pain_flag ?? null,
    painNotes: input.pain_notes ?? null,
    stressScore: input.stress_score ?? null,
    notes: input.notes ?? null,
  }).returning();
  return checkin;
}
