// Resume los últimos ~35 días de wearable_metricas en agregados que las
// reglas consumen directamente — ninguna regla vuelve a consultar la tabla
// ni recalcula tendencias por su cuenta.
//
// Los umbrales de "tendencia sostenida" (RECENT_WINDOW_DAYS/PRIOR_WINDOW_DAYS
// /TREND_THRESHOLD_PCT) son una heurística de v1 documentada acá — la
// matriz pide "tendencia bajista sostenida 3-4 semanas" sin dar una fórmula
// exacta. Ajustable sin tocar ninguna regla.
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { wearableMetricas, type WearableMetrica } from '../../models/schema.js';

const LOOKBACK_DAYS = 35;
const RECENT_WINDOW_DAYS = 7;
const TREND_THRESHOLD_PCT = 0.10; // 10% de diferencia entre ventana reciente y previa para considerar tendencia real

export type Tendencia = 'sube' | 'baja' | 'estable' | 'sin_datos';

export type WearableTrendSummary = {
  hrvPromedio: number | null;
  hrvTendencia: Tendencia;
  fcReposoPromedio: number | null;
  fcReposoTendencia: Tendencia;
  temperaturaPielTendencia: Tendencia;
  suenoProfundoPctPromedio: number | null;
  suenoScorePromedio: number | null;
  recoveryScorePromedio: number | null;
  readinessScorePromedio: number | null;
  spo2NocturnoSostenidoBajo: boolean; // SUE-07 — SpO2 bajo varias noches seguidas, no un solo dato aislado
  diasConDatos: number;
};

const SPO2_BAJO_UMBRAL = 92; // % — por debajo se considera desaturación nocturna relevante
const SPO2_NOCHES_SOSTENIDO = 3; // mínimo de noches con SpO2 bajo dentro de la ventana para considerarlo "sostenido"

function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function tendenciaEntre(reciente: number | null, previo: number | null): Tendencia {
  if (reciente === null || previo === null || previo === 0) return 'sin_datos';
  const cambio = (reciente - previo) / Math.abs(previo);
  if (cambio > TREND_THRESHOLD_PCT) return 'sube';
  if (cambio < -TREND_THRESHOLD_PCT) return 'baja';
  return 'estable';
}

function splitByRecency(rows: WearableMetrica[]): { recientes: WearableMetrica[]; previos: WearableMetrica[] } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const recientes = rows.filter((r) => r.fecha >= cutoffStr);
  const previos = rows.filter((r) => r.fecha < cutoffStr);
  return { recientes, previos };
}

export async function computeWearableTrend(clientId: string): Promise<WearableTrendSummary> {
  const desde = new Date();
  desde.setDate(desde.getDate() - LOOKBACK_DAYS);
  const rows = await db
    .select()
    .from(wearableMetricas)
    .where(and(eq(wearableMetricas.clientId, clientId), gte(wearableMetricas.fecha, desde.toISOString().split('T')[0])))
    .orderBy(desc(wearableMetricas.fecha));

  if (rows.length === 0) {
    return {
      hrvPromedio: null, hrvTendencia: 'sin_datos',
      fcReposoPromedio: null, fcReposoTendencia: 'sin_datos',
      temperaturaPielTendencia: 'sin_datos',
      suenoProfundoPctPromedio: null, suenoScorePromedio: null,
      recoveryScorePromedio: null, readinessScorePromedio: null,
      spo2NocturnoSostenidoBajo: false, diasConDatos: 0,
    };
  }

  const { recientes, previos } = splitByRecency(rows);
  const hrvPromedio = avg(rows.map((r) => r.hrvNocturno));
  const fcReposoPromedio = avg(rows.map((r) => r.fcReposo));
  const suenoProfundoPctPromedio = avg(
    rows
      .filter((r) => r.suenoTotalMinutos && r.suenoProfundoMinutos)
      .map((r) => (r.suenoProfundoMinutos! / r.suenoTotalMinutos!) * 100)
  );

  const spo2BajasNoches = rows.filter((r) => r.spo2 !== null && r.spo2 !== undefined && r.spo2 < SPO2_BAJO_UMBRAL).length;

  return {
    hrvPromedio,
    hrvTendencia: tendenciaEntre(avg(recientes.map((r) => r.hrvNocturno)), avg(previos.map((r) => r.hrvNocturno))),
    fcReposoPromedio,
    fcReposoTendencia: tendenciaEntre(avg(recientes.map((r) => r.fcReposo)), avg(previos.map((r) => r.fcReposo))),
    temperaturaPielTendencia: tendenciaEntre(avg(recientes.map((r) => r.temperaturaPiel)), avg(previos.map((r) => r.temperaturaPiel))),
    suenoProfundoPctPromedio,
    suenoScorePromedio: avg(rows.map((r) => r.suenoScore)),
    recoveryScorePromedio: avg(rows.map((r) => r.recoveryScore)),
    readinessScorePromedio: avg(rows.map((r) => r.readinessScore)),
    spo2NocturnoSostenidoBajo: spo2BajasNoches >= SPO2_NOCHES_SOSTENIDO,
    diasConDatos: rows.length,
  };
}
