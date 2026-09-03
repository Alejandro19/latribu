// Carga Cognitiva diaria (Stress, Prompt 02 §5 parte 2) — el job nocturno
// (ver jobs/cognitive-load-cron.ts) llama a computeAndStoreCognitiveLoadForDate
// una vez por cliente elegible; el endpoint de lectura (getCognitiveLoadOverview)
// deriva umbral/racha/alerta en el momento de la consulta a partir del
// historial guardado — nunca se cachean aparte, para que no puedan
// desincronizarse del historial real.
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wearableMetricas, morningCheckins, cognitiveLoadHistory, clients } from '../models/schema.js';
import { isModuleAllowedForType } from './type-module-access.service.js';
import {
  computeScoreHrv,
  computeCargaCognitiva,
  computeThreshold,
  computeConsecutiveDaysOverThreshold,
  shouldAlert,
  ALERT_STREAK_THRESHOLD,
  type DailyScore,
} from './cognitive-load-logic.js';

const HRV_BASELINE_WINDOW_DAYS = 14;
const TREND_DAYS = 14;
const THRESHOLD_MIN_HISTORY_DAYS = 14;

// Promedio de HRV nocturno de los primeros días con wearable conectado
// (spec: "primeros 7-14 días") — los más viejos disponibles, no los más
// recientes; una vez que el cliente tiene 14+ días de historial esto queda
// fijo (no se recalcula corriendo con el tiempo).
async function getHrvBaseline(clientId: string): Promise<number | null> {
  const rows = await db
    .select({ hrvNocturno: wearableMetricas.hrvNocturno })
    .from(wearableMetricas)
    .where(eq(wearableMetricas.clientId, clientId))
    .orderBy(asc(wearableMetricas.fecha))
    .limit(HRV_BASELINE_WINDOW_DAYS);
  const values = rows.map((r) => r.hrvNocturno).filter((v): v is number => v != null);
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Calcula (sin guardar) la Carga Cognitiva de un cliente en una fecha dada,
// a partir del wearable de ese día + el check-in matutino de ese día.
export async function computeCognitiveLoadForDate(clientId: string, fecha: string): Promise<number | null> {
  const [[wearableRow], [checkinRow]] = await Promise.all([
    db.select().from(wearableMetricas).where(and(eq(wearableMetricas.clientId, clientId), eq(wearableMetricas.fecha, fecha))).limit(1),
    db.select().from(morningCheckins).where(and(eq(morningCheckins.clientId, clientId), eq(morningCheckins.fecha, fecha))).limit(1),
  ]);

  let scoreHrv: number | null = null;
  if (wearableRow?.hrvNocturno != null) {
    const baseline = await getHrvBaseline(clientId);
    scoreHrv = baseline != null ? computeScoreHrv(baseline, wearableRow.hrvNocturno) : null;
  }

  const recuperacionPct = wearableRow?.recoveryScore ?? wearableRow?.readinessScore ?? null;

  return computeCargaCognitiva({
    scoreHrv,
    activacionMatutina: checkinRow?.activacionMatutina ?? null,
    recuperacionPct,
    suenoScore: wearableRow?.suenoScore ?? null,
  });
}

// Llamado por el job nocturno: calcula y guarda (upsert) la Carga Cognitiva
// de "hoy" para un cliente. Si ningún componente tuvo datos ese día, no
// inserta fila (spec: "si ningún componente tiene datos, no calcular el
// score ese día") — un día sin fila se trata en lectura como día sin dato,
// nunca como score 0.
export async function computeAndStoreCognitiveLoadForDate(clientId: string, fecha: string): Promise<void> {
  const score = await computeCognitiveLoadForDate(clientId, fecha);
  if (score == null) return;
  await db
    .insert(cognitiveLoadHistory)
    .values({ clientId, fecha, score })
    .onConflictDoUpdate({ target: [cognitiveLoadHistory.clientId, cognitiveLoadHistory.fecha], set: { score } });
}

// Corrida del job nocturno para todos los clientes con acceso a Stress
// (matriz de Roles y Perfiles) — un cliente por vez, un fallo individual no
// interrumpe al resto (mismo criterio que wearable-sync-cron.ts).
export async function runCognitiveLoadNightlyJob(fecha: string = new Date().toISOString().slice(0, 10)): Promise<void> {
  const rows = await db.select({ id: clients.id, clientType: clients.clientType }).from(clients);
  for (const row of rows) {
    const allowed = await isModuleAllowedForType(row.clientType, 'cortisol');
    if (!allowed) continue;
    try {
      await computeAndStoreCognitiveLoadForDate(row.id, fecha);
    } catch (e) {
      console.error(`cognitive-load-cron: falló el cálculo para cliente ${row.id}`, e);
    }
  }
}

export type CognitiveLoadLatest = {
  hrv: number | null;
  activacionMatutina: number | null; // autorreporte — nunca renombrar a lenguaje clínico
  recuperacionPct: number | null;
};

export type CognitiveLoadOverview = {
  today: number | null;
  trend: DailyScore[]; // últimos 14 días con dato, para "Tendencia 14 días"
  threshold: number | null; // null si hay menos de 14 días de historial
  consecutiveDaysOverThreshold: number;
  alert: boolean;
  alertStreakThreshold: typeof ALERT_STREAK_THRESHOLD;
  latest: CognitiveLoadLatest; // valores crudos más recientes, para los 3 datos de la tarjeta de tendencia
};

// Últimos valores crudos disponibles (no necesariamente del mismo día entre
// sí — el wearable y el check-in matutino pueden estar desfasados) para los
// 3 datos que muestra la tarjeta "Tendencia 14 días".
async function getLatestRawComponents(clientId: string): Promise<CognitiveLoadLatest> {
  const [[wearableRow], [checkinRow]] = await Promise.all([
    db
      .select({ hrvNocturno: wearableMetricas.hrvNocturno, recoveryScore: wearableMetricas.recoveryScore, readinessScore: wearableMetricas.readinessScore })
      .from(wearableMetricas)
      .where(eq(wearableMetricas.clientId, clientId))
      .orderBy(desc(wearableMetricas.fecha))
      .limit(1),
    db
      .select({ activacionMatutina: morningCheckins.activacionMatutina })
      .from(morningCheckins)
      .where(eq(morningCheckins.clientId, clientId))
      .orderBy(desc(morningCheckins.fecha))
      .limit(1),
  ]);
  return {
    hrv: wearableRow?.hrvNocturno ?? null,
    activacionMatutina: checkinRow?.activacionMatutina ?? null,
    recuperacionPct: wearableRow?.recoveryScore ?? wearableRow?.readinessScore ?? null,
  };
}

// Vista de lectura para el módulo Stress: puntaje de hoy (si ya lo calculó
// el job nocturno), tendencia de 14 días, umbral sostenible y racha/alerta —
// todo derivado del historial guardado en el momento de la consulta.
export async function getCognitiveLoadOverview(clientId: string): Promise<CognitiveLoadOverview> {
  const rows = await db
    .select({ fecha: cognitiveLoadHistory.fecha, score: cognitiveLoadHistory.score })
    .from(cognitiveLoadHistory)
    .where(eq(cognitiveLoadHistory.clientId, clientId));
  const history: DailyScore[] = rows.map((r) => ({ fecha: r.fecha, score: r.score })).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = history.find((h) => h.fecha === today);
  const trend = history.slice(-TREND_DAYS);
  const threshold = computeThreshold(history, THRESHOLD_MIN_HISTORY_DAYS);
  const consecutiveDaysOverThreshold = threshold != null ? computeConsecutiveDaysOverThreshold(history, threshold) : 0;
  const latest = await getLatestRawComponents(clientId);

  return {
    today: todayRow?.score ?? null,
    trend,
    threshold,
    consecutiveDaysOverThreshold,
    alert: shouldAlert(consecutiveDaysOverThreshold),
    alertStreakThreshold: ALERT_STREAK_THRESHOLD,
    latest,
  };
}
