import type { EvolutionCheckin } from './evolution-client';

// Puerto de las funciones de cálculo del módulo "Mi Evolución" en index.html
// (renderEvolution y helpers, ~L5087-5564) — misma lógica, sin cambios de
// comportamiento.

export function calculateSleepQualityAvg(checkins: EvolutionCheckin[]): number | null {
  const recent = checkins.filter((c) => c.sleepHours != null).slice(-7);
  if (!recent.length) return null;
  return recent.reduce((sum, c) => sum + Number(c.sleepHours), 0) / recent.length;
}

export function formatSleepHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export function monthlyAverages<T extends Record<string, unknown>>(
  records: T[],
  dateField: keyof T,
  valueField: keyof T
): Array<{ month: string; avg: number }> {
  const byMonth = new Map<string, number[]>();
  for (const r of records) {
    const value = r[valueField];
    if (value == null) continue;
    const monthKey = String(r[dateField]).slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(Number(value));
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({ month, avg: values.reduce((s, v) => s + v, 0) / values.length }));
}

export const EMOCION_SCORE: Record<string, number> = {
  ansioso: 1,
  irritable: 1,
  abrumado: 1,
  cansado: 3,
  tranquilo: 5,
  energia: 5,
};

export type KpiStatus = 'good' | 'watch' | 'neutral';

// La dirección "favorable" de peso/grasa/masa muscular depende del objetivo
// configurado por ese cliente en particular (client.objetivos) — nunca fija
// en el código. Sin objetivo confirmado aún, no se puede juzgar: se trata
// igual que "mantener" (informativo, sin marcar logro ni alerta).
export function getKpiStatus(
  delta: number | null,
  metrica: 'peso' | 'grasa_corporal' | 'masa_muscular',
  objetivos: Record<string, string> | undefined
): KpiStatus {
  if (delta === 0 || delta == null) return 'neutral';
  const objetivo = objetivos?.[metrica];
  if (!objetivo || objetivo === 'mantener') return 'neutral';
  const isFavorable = objetivo === 'bajar' ? delta < 0 : delta > 0;
  return isFavorable ? 'good' : 'watch';
}

// Sueño y cortisol no tienen objetivo configurable — mejor siempre es "subir"
// (dormir mejor, regularse mejor), igual para todos los clientes.
export function getWellnessTrendStatus(delta: number | null): KpiStatus {
  if (delta === 0 || delta == null) return 'neutral';
  return delta > 0 ? 'good' : 'watch';
}

export const comparisonLabelByCadence: Record<string, string> = {
  mensual: 'vs mes pasado',
  bimestral: 'vs hace 2 meses',
  personalizado: 'vs medición anterior',
};

// Índice de bienestar general: promedio ponderado 40/30/30 (constancia de
// entrenamiento / calidad de sueño / regulación de cortisol). Un componente
// sin datos aún se excluye del promedio — el peso se redistribuye entre los
// que sí tienen datos, nunca cuenta como cero.
export function computeWellnessIndex({
  trainingPct,
  sleepAvg,
  cortisolAvg,
}: {
  trainingPct: number | null;
  sleepAvg: number | null;
  cortisolAvg: number | null;
}): number | null {
  const components: Array<{ weight: number; score: number }> = [];
  if (trainingPct != null) components.push({ weight: 0.4, score: Math.max(0, Math.min(100, trainingPct)) });
  if (sleepAvg != null) components.push({ weight: 0.3, score: (sleepAvg / 5) * 100 });
  if (cortisolAvg != null) components.push({ weight: 0.3, score: (cortisolAvg / 5) * 100 });
  if (!components.length) return null;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  return Math.round(components.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0));
}
