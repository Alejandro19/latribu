import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  clients,
  trainingCompletions,
  trainingProtectorUses,
  phrases,
  achievementLogs,
  type TrainingCompletion,
  type Client,
  type Phrase,
  type AchievementLog,
} from '../models/schema.js';

export async function updateTrainingDays(clientId: string, trainingDays: number): Promise<Client | null> {
  const [client] = await db.update(clients).set({ trainingDays, updatedAt: new Date() }).where(eq(clients.id, clientId)).returning();
  return client ?? null;
}

export async function listTrainingCompletions(clientId: string): Promise<TrainingCompletion[]> {
  return db.select().from(trainingCompletions).where(eq(trainingCompletions.clientId, clientId));
}

export const DEFAULT_TRAINING_TZ = 'America/Mexico_City';
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function safeTz(tz: string | undefined): string {
  if (!tz) return DEFAULT_TRAINING_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TRAINING_TZ;
  }
}

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeTz(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function dowInTz(tz: string): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: safeTz(tz), weekday: 'short' }).format(new Date());
  return WEEKDAY_INDEX[short];
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// Semana calendario lunes→domingo, calculada en la tz dada — mismo criterio
// que getWeekStart() en el legacy (index.html).
function weekStartInTz(tz: string): string {
  const today = todayInTz(tz);
  const dow = dowInTz(tz);
  return addDaysISO(today, (dow === 0 ? -6 : 1) - dow);
}

// Identificador único de semana calendario ISO (año*100 + número de semana ISO),
// usado como week_number en achievement_logs — streak.streakWeeks NO sirve para
// esto porque se reinicia cada vez que se rompe una racha, causando colisiones
// contra el UNIQUE(client_id, type, week_number) de la tabla.
function isoWeekIdentifier(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return d.getUTCFullYear() * 100 + weekNo;
}

export class NoTrainingDaysError extends Error {
  constructor() {
    super('Este cliente no tiene días de entrenamiento asignados.');
    this.name = 'NoTrainingDaysError';
  }
}

export function pickRandomPhrase(pool: Phrase[], context: string): Phrase | null {
  const eligible = pool.filter((p) => p.active && (p.context === context || p.context === 'ambas'));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export async function getPhraseByContext(context: string): Promise<string | null> {
  const pool = await db.select().from(phrases).where(eq(phrases.active, true));
  const drawn = pickRandomPhrase(pool, context);
  return drawn ? drawn.text : null;
}

// Puerto del confirm-session del legacy (server.js:1305-1367), ahora completo:
// además de insertar training_completions, dibuja una frase (non-fatal) y
// calcula la racha; registra achievement_logs solo en la transición exacta
// de "semana incompleta" a "semana completa" causada por ESTA llamada — el
// protector nunca dispara un logro (no pasa por este código).
export async function confirmSession(
  clientId: string,
  tz: string,
  source: 'manual' | 'nfc' = 'manual'
): Promise<{ alreadyConfirmedToday: boolean; dayNumber: number | null; streak: TrainingStreak; phrase: string | null }> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  const trainingDays = client?.trainingDays || 0;
  if (!trainingDays) throw new NoTrainingDaysError();

  const effectiveTz = source === 'nfc' ? DEFAULT_TRAINING_TZ : tz;
  const today = todayInTz(effectiveTz);
  const weekStart = weekStartInTz(effectiveTz);
  const completions = await listTrainingCompletions(clientId);
  const alreadyConfirmedToday = completions.some((c) => c.completedDate === today);

  let dayNumber: number | null = null;
  let justInsertedNewSession = false;
  let wasCompletedBeforeThisCall = false;

  if (!alreadyConfirmedToday) {
    const doneThisWeek = new Set(completions.filter((c) => c.completedDate >= weekStart).map((c) => c.dayNumber)).size;
    wasCompletedBeforeThisCall = doneThisWeek >= trainingDays;
    dayNumber = Math.min(trainingDays, doneThisWeek + 1);

    const existing = await db
      .select()
      .from(trainingCompletions)
      .where(
        and(
          eq(trainingCompletions.clientId, clientId),
          eq(trainingCompletions.dayNumber, dayNumber),
          eq(trainingCompletions.completedDate, today)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(trainingCompletions).values({ clientId, dayNumber, completedDate: today, source });
      justInsertedNewSession = true;

      // Club Presencial: cada asistencia (este mismo botón, sin endpoint
      // nuevo) descuenta una sesión del paquete pagado — ver
      // clientsService.activatePaidPlan, que fija sessionsRemaining al
      // activar el pago. El bloqueo al vencer fecha_vencimiento (sin
      // excepciones) ya lo cubre ownerOrAdmin/isPlanExpired antes de llegar
      // acá, no hace falta un chequeo aparte.
      if (client?.clientType === 'coaching_1_1' && client.sessionsRemaining != null && client.sessionsRemaining > 0) {
        await db
          .update(clients)
          .set({ sessionsRemaining: client.sessionsRemaining - 1, updatedAt: new Date() })
          .where(eq(clients.id, clientId));
      }
    }
  }

  let phrase: string | null = null;
  try {
    const pool = await db.select().from(phrases).where(eq(phrases.active, true));
    const drawn = pickRandomPhrase(pool, 'confirmacion');
    phrase = drawn ? drawn.text : null;
  } catch (e) {
    console.error('[training] phrase draw failed (non-fatal):', e);
    phrase = null;
  }

  const streak = await computeTrainingStreakState(clientId, trainingDays, effectiveTz);

  if (justInsertedNewSession && !wasCompletedBeforeThisCall && streak.sessionsDoneThisWeek >= trainingDays) {
    try {
      const weekNumber = isoWeekIdentifier(weekStart);
      await db.insert(achievementLogs).values({ clientId, type: 'medalla', weekNumber });
      if (streak.streakWeeks > 0 && streak.streakWeeks % 4 === 0) {
        await db.insert(achievementLogs).values({ clientId, type: 'copa', weekNumber });
      }
    } catch (e) {
      console.error('[training] achievement log insert failed (non-fatal):', e);
    }
  }

  return { alreadyConfirmedToday, dayNumber, streak, phrase };
}

export async function listAchievements(clientId: string): Promise<AchievementLog[]> {
  return db.select().from(achievementLogs).where(eq(achievementLogs.clientId, clientId)).orderBy(desc(achievementLogs.earnedAt));
}

export type TrainingStreak = {
  streakWeeks: number;
  sessionsDoneThisWeek: number;
  sessionsRequiredThisWeek: number;
  protectorAvailable: boolean;
  protectorUsedThisWeek: boolean;
  atRisk: boolean;
};

// Puerto de computeTrainingStreakState (server.js:1254-1287).
export async function computeTrainingStreakState(clientId: string, trainingDays: number, tz: string): Promise<TrainingStreak> {
  const [completions, protectorUses] = await Promise.all([
    listTrainingCompletions(clientId),
    db.select().from(trainingProtectorUses).where(eq(trainingProtectorUses.clientId, clientId)),
  ]);
  const protectorWeeks = new Set(protectorUses.map((p) => p.weekStart));
  const weekStart = weekStartInTz(tz);
  const sessionsDoneThisWeek = new Set(completions.filter((c) => c.completedDate >= weekStart).map((c) => c.dayNumber)).size;
  const protectorUsedThisWeek = protectorWeeks.has(weekStart);

  let streakWeeks = trainingDays > 0 && (sessionsDoneThisWeek >= trainingDays || protectorUsedThisWeek) ? 1 : 0;
  let cStart = addDaysISO(weekStart, -7);
  for (let i = 0; i < 208 && trainingDays > 0; i++) {
    const cEnd = addDaysISO(cStart, 7);
    const doneInWeek = new Set(completions.filter((c) => c.completedDate >= cStart && c.completedDate < cEnd).map((c) => c.dayNumber)).size;
    if (doneInWeek >= trainingDays || protectorWeeks.has(cStart)) {
      streakWeeks++;
      cStart = addDaysISO(cStart, -7);
    } else break;
  }

  const dow = dowInTz(tz);
  const daysLeftInWeek = dow === 0 ? 1 : 8 - dow;
  const atRisk = trainingDays > 0 && !protectorUsedThisWeek && sessionsDoneThisWeek < trainingDays && daysLeftInWeek <= 2;

  return {
    streakWeeks,
    sessionsDoneThisWeek,
    sessionsRequiredThisWeek: trainingDays,
    protectorAvailable: !protectorUsedThisWeek,
    protectorUsedThisWeek,
    atRisk,
  };
}

export async function getStreak(clientId: string, tz: string): Promise<TrainingStreak> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const trainingDays = rows[0]?.trainingDays || 0;
  return computeTrainingStreakState(clientId, trainingDays, tz);
}

export async function useProtector(clientId: string, tz: string): Promise<TrainingStreak> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const trainingDays = rows[0]?.trainingDays || 0;
  const weekStart = weekStartInTz(tz);
  const existing = await db
    .select()
    .from(trainingProtectorUses)
    .where(and(eq(trainingProtectorUses.clientId, clientId), eq(trainingProtectorUses.weekStart, weekStart)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(trainingProtectorUses).values({ clientId, weekStart });
  }
  return computeTrainingStreakState(clientId, trainingDays, tz);
}

export async function listAllPhrases(): Promise<Phrase[]> {
  return db.select().from(phrases);
}

export async function createPhrase(text: string, context: string): Promise<Phrase> {
  const [created] = await db.insert(phrases).values({ text, context }).returning();
  return created;
}

export async function updatePhrase(
  id: string,
  patch: { text?: string; context?: string; active?: boolean }
): Promise<Phrase | null> {
  const [updated] = await db
    .update(phrases)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(phrases.id, id))
    .returning();
  return updated ?? null;
}

export async function deletePhrase(id: string): Promise<void> {
  await db.delete(phrases).where(eq(phrases.id, id));
}

export async function drawPreviewPhrase(context: string, excludeId?: string): Promise<Phrase | null> {
  const pool = await db.select().from(phrases).where(eq(phrases.active, true));
  const eligible = pool.filter((p) => p.context === context || p.context === 'ambas');
  const candidates = excludeId && eligible.length > 1 ? eligible.filter((p) => p.id !== excludeId) : eligible;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
