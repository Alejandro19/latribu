import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  clients,
  trainingCompletions,
  sleepLogs,
  cortisolCheckins,
  wellnessIndexHistory,
} from '../models/schema.js';
import { isModuleAllowedForType } from './type-module-access.service.js';

// Puerto server-side de computeWellnessIndex (apps/web/lib/evolution-logic.ts)
// — un componente sin datos se excluye del promedio, nunca cuenta como cero;
// el peso se redistribuye entre los que sí tienen datos.
function weightedAverage(components: Array<{ weight: number; score: number }>): number | null {
  if (!components.length) return null;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  return Math.round(components.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0));
}

// Índice de bienestar general "clásico" (Mi Evolución, ya shippeado): 40%
// entrenamiento / 30% sueño / 30% cortisol. Se reutiliza tal cual como el
// score del componente "Mi Evolución" del índice nuevo (decisión de
// producto: cuenta dos veces — directo arriba y anidado acá — es
// intencional, no un bug).
function computeEvolutionSubIndex(trainingPct: number | null, sleepAvg: number | null, cortisolAvg: number | null): number | null {
  const components: Array<{ weight: number; score: number }> = [];
  if (trainingPct != null) components.push({ weight: 0.4, score: Math.max(0, Math.min(100, trainingPct)) });
  if (sleepAvg != null) components.push({ weight: 0.3, score: (sleepAvg / 5) * 100 });
  if (cortisolAvg != null) components.push({ weight: 0.3, score: (cortisolAvg / 5) * 100 });
  return weightedAverage(components);
}

const EMOCION_SCORE: Record<string, number> = {
  ansioso: 1,
  irritable: 1,
  abrumado: 1,
  cansado: 3,
  tranquilo: 5,
  energia: 5,
};

// Promedio del mes calendario más reciente que tenga registros — mismo
// criterio que monthlyAverages(...) del lado web (agrupa por mes, toma el
// último bucket).
function latestMonthAverage(dates: string[], values: number[]): number | null {
  const byMonth = new Map<string, number[]>();
  dates.forEach((d, i) => {
    const monthKey = d.slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(values[i]);
  });
  const months = Array.from(byMonth.keys()).sort();
  if (!months.length) return null;
  const last = byMonth.get(months[months.length - 1])!;
  return last.reduce((s, v) => s + v, 0) / last.length;
}

async function calculateTrainingPct(clientId: string): Promise<number | null> {
  const [client] = await db.select({ trainingDays: clients.trainingDays }).from(clients).where(eq(clients.id, clientId)).limit(1);
  const trainingDays = client?.trainingDays || 0;
  if (!trainingDays) return null;
  const completions = await db.select().from(trainingCompletions).where(eq(trainingCompletions.clientId, clientId));
  const now = new Date();
  const monthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-`;
  const doneDays = new Set(completions.filter((c) => c.completedDate.startsWith(monthPrefix)).map((c) => c.completedDate)).size;
  const expected = trainingDays * 4;
  return expected > 0 ? Math.round((doneDays / expected) * 100) : null;
}

async function calculateSleepAvg(clientId: string): Promise<number | null> {
  const logs = await db.select().from(sleepLogs).where(eq(sleepLogs.clientId, clientId));
  return latestMonthAverage(logs.map((l) => l.date), logs.map((l) => l.quality));
}

async function calculateCortisolAvg(clientId: string): Promise<number | null> {
  const checkins = await db.select().from(cortisolCheckins).where(eq(cortisolCheckins.clientId, clientId));
  const scored = checkins.filter((c) => EMOCION_SCORE[c.emotion] != null);
  return latestMonthAverage(scored.map((c) => c.checkinDate), scored.map((c) => EMOCION_SCORE[c.emotion]));
}

// Lunes de la semana ISO vigente (UTC), formato YYYY-MM-DD.
function currentWeekStartUTC(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday));
  return monday.toISOString().slice(0, 10);
}

export type WellnessIndexResult = {
  value: number;
  previousValue: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'stable' | 'none';
  componentsUsed: Record<string, number>;
};

// Índice de bienestar unificado (home + Mi Evolución, mismo valor en los dos
// lugares). Nutrición nunca se incluye — hoy no existe ningún dato medible
// de adherencia para ese módulo (decisión de producto, ver plan). El resto
// de los componentes solo entra si el tipo de cliente tiene ese módulo
// habilitado en la matriz de Roles y Perfiles (client_type_module_permissions).
export async function computeWellnessIndexForClient(clientId: string): Promise<WellnessIndexResult | null> {
  const [client] = await db.select({ clientType: clients.clientType }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return null;

  const [trainingAllowed, cortisolAllowed, sleepAllowed, evolutionAllowed] = await Promise.all([
    isModuleAllowedForType(client.clientType, 'training'),
    isModuleAllowedForType(client.clientType, 'cortisol'),
    isModuleAllowedForType(client.clientType, 'rest'),
    isModuleAllowedForType(client.clientType, 'evolution'),
  ]);

  const [trainingPct, sleepAvg, cortisolAvg] = await Promise.all([
    trainingAllowed ? calculateTrainingPct(clientId) : Promise.resolve(null),
    sleepAllowed ? calculateSleepAvg(clientId) : Promise.resolve(null),
    cortisolAllowed ? calculateCortisolAvg(clientId) : Promise.resolve(null),
  ]);

  const evolutionScore = evolutionAllowed ? computeEvolutionSubIndex(trainingPct, sleepAvg, cortisolAvg) : null;

  const componentsUsed: Record<string, number> = {};
  const components: Array<{ weight: number; score: number }> = [];
  if (trainingPct != null) {
    components.push({ weight: 15, score: Math.max(0, Math.min(100, trainingPct)) });
    componentsUsed.training = Math.round(trainingPct);
  }
  if (cortisolAvg != null) {
    const score = (cortisolAvg / 5) * 100;
    components.push({ weight: 15, score });
    componentsUsed.cortisol = Math.round(score);
  }
  if (sleepAvg != null) {
    const score = (sleepAvg / 5) * 100;
    components.push({ weight: 15, score });
    componentsUsed.sleep = Math.round(score);
  }
  if (evolutionScore != null) {
    components.push({ weight: 40, score: evolutionScore });
    componentsUsed.evolution = Math.round(evolutionScore);
  }

  const value = weightedAverage(components);
  if (value == null) return null;

  const periodStart = currentWeekStartUTC();
  await db
    .insert(wellnessIndexHistory)
    .values({ clientId, periodStart, value, componentsUsed })
    .onConflictDoUpdate({
      target: [wellnessIndexHistory.clientId, wellnessIndexHistory.periodStart],
      set: { value, componentsUsed },
    });

  const [previousRow] = await db
    .select()
    .from(wellnessIndexHistory)
    .where(and(eq(wellnessIndexHistory.clientId, clientId), lt(wellnessIndexHistory.periodStart, periodStart)))
    .orderBy(desc(wellnessIndexHistory.periodStart))
    .limit(1);

  const previousValue = previousRow?.value ?? null;
  const delta = previousValue == null ? null : value - previousValue;
  const trend: WellnessIndexResult['trend'] = delta == null ? 'none' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';

  return { value, previousValue, delta, trend, componentsUsed };
}
