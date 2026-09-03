// Funciones puras del cálculo de Carga Cognitiva y Activación Matutina
// (Stress, Prompt 02 §5) — separadas de cognitive-load.service.ts (que
// toca la base de datos) para poder testearlas sin mocks.

export type WeightedComponent = { weight: number; score: number };

// Mismo patrón que weightedAverage() en wellness-index.service.ts (excluir
// componentes sin dato y redistribuir su peso proporcionalmente entre los
// que sí tienen), pero SIN redondear a entero: ese índice es 0-100 y
// redondea a propósito, Carga Cognitiva es 0-10 con un decimal y perdería
// precisión real (7.35 → 7).
export function weightedAverageUnrounded(components: WeightedComponent[]): number | null {
  if (!components.length) return null;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return null;
  return components.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Activación Matutina = ((Energía + (6 - Tensión) + Claridad) / 3) × 2, escala 0-10.
export function computeActivacionMatutina(energia: number, tension: number, claridad: number): number {
  return ((energia + (6 - tension) + claridad) / 3) * 2;
}

// Score_HRV = 10 - ((HRV_baseline - HRV_actual) / HRV_baseline × 10), clamp 0-10.
export function computeScoreHrv(hrvBaseline: number, hrvActual: number): number | null {
  if (!hrvBaseline || hrvBaseline <= 0) return null;
  return clamp(10 - ((hrvBaseline - hrvActual) / hrvBaseline) * 10, 0, 10);
}

export type CargaCognitivaInputs = {
  scoreHrv: number | null;
  activacionMatutina: number | null; // ya en escala 0-10
  recuperacionPct: number | null; // 0-100
  suenoScore: number | null; // 0-100
};

// Bienestar_ponderado = HRV×0.35 + ActivaciónMatutina×0.25 + Recuperación×0.20 + Sueño×0.20
// Carga_Cognitiva = 10 - Bienestar_ponderado. Un componente sin dato se
// excluye y su peso se redistribuye (weightedAverageUnrounded). Si ningún
// componente tiene datos, no hay score ese día (null).
export function computeCargaCognitiva(inputs: CargaCognitivaInputs): number | null {
  const components: WeightedComponent[] = [];
  if (inputs.scoreHrv != null) components.push({ weight: 0.35, score: inputs.scoreHrv });
  if (inputs.activacionMatutina != null) components.push({ weight: 0.25, score: clamp(inputs.activacionMatutina, 0, 10) });
  if (inputs.recuperacionPct != null) components.push({ weight: 0.2, score: clamp(inputs.recuperacionPct / 10, 0, 10) });
  if (inputs.suenoScore != null) components.push({ weight: 0.2, score: clamp(inputs.suenoScore / 10, 0, 10) });

  const bienestarPonderado = weightedAverageUnrounded(components);
  if (bienestarPonderado == null) return null;
  return 10 - bienestarPonderado;
}

// Percentil 75 por rango más cercano (nearest-rank): ordena ascendente y
// toma el elemento en la posición ceil(0.75 × n) — 1.
export function percentile75(scores: number[]): number | null {
  if (!scores.length) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.75 * sorted.length) - 1));
  return sorted[index];
}

export type DailyScore = { fecha: string; score: number };

// Ventana para el percentil 75 (spec §2.2.1): 60 días si hay suficiente
// historial, si no, todo el disponible — pero nunca menos de 14 días
// (con menos de 14, no se calcula umbral en absoluto, ver computeThreshold).
export function selectThresholdWindow(history: DailyScore[], longWindowDays = 60): DailyScore[] {
  const sorted = [...history].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return sorted.length >= longWindowDays ? sorted.slice(-longWindowDays) : sorted;
}

export function computeThreshold(history: DailyScore[], minHistoryDays = 14): number | null {
  if (history.length < minHistoryDays) return null;
  return percentile75(selectThresholdWindow(history).map((h) => h.score));
}

// Días consecutivos con Carga_Cognitiva ESTRICTAMENTE por encima del umbral,
// contando hacia atrás desde el día más reciente CON score disponible — un
// día igual o por debajo corta la racha (spec §2.3.2). Decisión: opera
// sobre los días con dato, no sobre el calendario — un día sin wearable
// sync (sin fila en el historial) no es evidencia de "por debajo del
// umbral", así que no corta la racha por sí solo.
export function computeConsecutiveDaysOverThreshold(history: DailyScore[], threshold: number): number {
  const sorted = [...history].sort((a, b) => b.fecha.localeCompare(a.fecha));
  let streak = 0;
  for (const day of sorted) {
    if (day.score > threshold) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export const ALERT_STREAK_THRESHOLD = 3;

export function shouldAlert(consecutiveDaysOverThreshold: number): boolean {
  return consecutiveDaysOverThreshold >= ALERT_STREAK_THRESHOLD;
}
