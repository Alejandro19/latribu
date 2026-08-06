import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sleepProtocols, sleepLogs, type SleepProtocol, type SleepLog } from '../models/schema.js';
import type { SleepProtocolUpdate, SleepLogInput } from '@latribu/shared-types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getProtocol(clientId: string): Promise<SleepProtocol | null> {
  const rows = await db.select().from(sleepProtocols).where(eq(sleepProtocols.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertProtocol(clientId: string, patch: SleepProtocolUpdate): Promise<SleepProtocol> {
  const fields: Record<string, unknown> = {};
  if (patch.protocol_text !== undefined) fields.protocolText = patch.protocol_text;
  if (patch.sleep_window !== undefined) fields.sleepWindow = patch.sleep_window;
  if (patch.supplement !== undefined) fields.supplement = patch.supplement;

  const [protocol] = await db
    .insert(sleepProtocols)
    .values({ clientId, ...fields })
    .onConflictDoUpdate({ target: sleepProtocols.clientId, set: { ...fields, updatedAt: new Date() } })
    .returning();
  return protocol;
}

export async function getTodayLog(clientId: string): Promise<SleepLog | null> {
  const rows = await db
    .select()
    .from(sleepLogs)
    .where(and(eq(sleepLogs.clientId, clientId), eq(sleepLogs.date, today())));
  return rows[0] ?? null;
}

export async function listLogs(clientId: string): Promise<SleepLog[]> {
  return db.select().from(sleepLogs).where(eq(sleepLogs.clientId, clientId)).orderBy(asc(sleepLogs.date));
}

export async function logSleep(clientId: string, input: SleepLogInput): Promise<SleepLog> {
  const date = today();
  const [log] = await db
    .insert(sleepLogs)
    .values({ clientId, date, hours: input.hours, quality: input.quality, loggedAt: new Date() })
    .onConflictDoUpdate({
      target: [sleepLogs.clientId, sleepLogs.date],
      set: { hours: input.hours, quality: input.quality, loggedAt: new Date() },
    })
    .returning();
  return log;
}
