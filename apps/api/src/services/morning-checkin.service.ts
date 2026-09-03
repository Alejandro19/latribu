// Check-in matutino de autorreporte (Stress) — reemplaza la fuente
// inexistente de "Cortisol AM". Un día sin respuesta no tiene fila; nunca
// se rellena con un valor por defecto ni se repite el último (ver
// morning_checkins en schema.ts).
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { morningCheckins, type MorningCheckin } from '../models/schema.js';
import { computeActivacionMatutina } from './cognitive-load-logic.js';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayMorningCheckin(clientId: string): Promise<MorningCheckin | null> {
  const rows = await db
    .select()
    .from(morningCheckins)
    .where(and(eq(morningCheckins.clientId, clientId), eq(morningCheckins.fecha, todayISO())))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertTodayMorningCheckin(
  clientId: string,
  input: { energia: number; tension: number; claridad: number }
): Promise<MorningCheckin> {
  const activacionMatutina = computeActivacionMatutina(input.energia, input.tension, input.claridad);
  const [row] = await db
    .insert(morningCheckins)
    .values({ clientId, fecha: todayISO(), ...input, activacionMatutina })
    .onConflictDoUpdate({
      target: [morningCheckins.clientId, morningCheckins.fecha],
      set: { ...input, activacionMatutina },
    })
    .returning();
  return row;
}
