// Firma común del motor de reglas — un archivo por módulo en ./rules/
// exporta un array de `Rule`, todos con esta misma forma. Ninguna regla
// consulta la base de datos directamente: todo el contexto ya viene resuelto
// (rango-optimo, fase-ciclo, wearable-trend) antes de evaluar.
import type { FaseCicloResultado } from './fase-ciclo.js';
import type { WearableTrendSummary } from './wearable-trend.js';

export type LabPanelWithDia = {
  semanaNumero: number;
  fecha: string | null;
  datos: Record<string, number>;
  diaCicloPanel: number | null;
};

// Respuestas del baseline que NO se promovieron a columnas tipadas de
// personalInfo — vienen tal cual del snapshot `onboarding_report` (jsonb),
// keyed por el mismo field id del wizard (ver apps/web/lib/wizard-modules.ts).
// Usar los helpers de abajo para leerlas con el tipo esperado.
export type BaselineAnswers = Record<string, unknown>;

export function baselineStr(answers: BaselineAnswers, key: string): string | null {
  const v = answers[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function baselineNum(answers: BaselineAnswers, key: string): number | null {
  const v = answers[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function baselineArr(answers: BaselineAnswers, key: string): string[] {
  const v = answers[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

// Extrae la hora (0-23) de un campo tipo 'time' del wizard (formato "HH:MM").
export function baselineHour(answers: BaselineAnswers, key: string): number | null {
  const v = baselineStr(answers, key);
  if (!v) return null;
  const match = v.match(/^(\d{1,2}):/);
  return match ? Number(match[1]) : null;
}

export function getMarker(panel: LabPanelWithDia | null, marcador: string): number | null {
  if (!panel) return null;
  const v = panel.datos[marcador];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export type RuleContext = {
  client: {
    gender: string | null;
    birthdate: string | null;
    hormonalStatus: string | null;
    snores: string | null;
    sleepApneaSigns: string | null;
  };
  baseline: BaselineAnswers;
  panels: LabPanelWithDia[]; // ordenados ascendente por semanaNumero
  latestPanel: LabPanelWithDia | null;
  previousPanel: LabPanelWithDia | null; // el checkpoint anterior al más reciente, si existe
  wearableTrend: WearableTrendSummary;
  fase: FaseCicloResultado | null;
};

export type InsightTipo = 'optimizar' | 'vigilar' | 'derivar_medico' | 'regla_sistema';

export type RuleResult = {
  id: string;
  tipo: InsightTipo;
  mensaje: string;
  // MEV-02: true para cualquier insight que dependa de `panels` — el
  // frontend (Fase B) debe mostrarlo siempre como "válido hasta tu próximo
  // checkpoint", nunca como alerta en tiempo real.
  validoHastaProximoCheckpoint?: boolean;
};

export type Rule = {
  id: string;
  evaluar: (ctx: RuleContext) => RuleResult | null;
};

export type ModuleKey = 'cortisol' | 'sueno' | 'entrenamiento' | 'nutricion' | 'puntoCiego' | 'miEvolucion';

export type InsightsResult =
  | { excluded: 'embarazo_lactancia'; mensaje: string }
  | {
      excluded: null;
      fase: FaseCicloResultado | null;
      modules: Record<ModuleKey, RuleResult[]>;
    };
