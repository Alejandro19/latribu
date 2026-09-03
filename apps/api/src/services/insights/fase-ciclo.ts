// Cálculo de fase de ciclo menstrual — Matriz_Reglas_Mentoria_BIO360.md,
// pestaña "Fase de Ciclo". Alimenta MEV-04 (suprime falsas alertas de
// estrés/recuperación) y MEV-05 (contexto informativo en Cortisol, Sueño,
// Entrenamiento y Mi Evolución). Nunca prescribe entrenamiento distinto por
// fase — eso queda fuera de alcance a propósito (evidencia mixta).

export const NATURAL_CYCLE_STATUSES = ['Ciclo menstrual natural y regular', 'Ciclo menstrual natural pero irregular'];
export const IRREGULAR_CYCLE_STATUS = 'Ciclo menstrual natural pero irregular';
export const PREGNANCY_OR_LACTATION_STATUS = 'Embarazada o en lactancia';

export type FaseCiclo = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea_temprana' | 'lutea_tardia';
export type Confianza = 'alta' | 'media' | 'estimado';

export type FaseCicloResultado = {
  fase: FaseCiclo;
  diaActual: number;
  confianza: Confianza;
  mensaje: string;
};

export type FaseCicloContext = {
  hormonalStatus: string | null;
  lastPeriodDate: string | null;
  cycleLengthDays: number | null;
  today?: Date;
};

const MENSAJES: Record<FaseCiclo, string> = {
  menstrual: 'Estás en tu fase menstrual — es normal dormir algo peor o sentir menos energía estos días.',
  folicular: 'Estás en fase folicular — buen momento para exigencia física si tu recuperación lo permite.',
  ovulatoria: 'Estás en tu ventana ovulatoria.',
  lutea_temprana: 'Estás en fase lútea — es esperable ver tu HRV algo más bajo y tu temperatura algo más alta.',
  lutea_tardia: 'Estás en la fase premenstrual — es normal dormir peor o sentirte más cansada estos días, no es una señal de alarma.',
};

function diffInDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// Devuelve null cuando no corresponde mostrar/usar la fase: ciclo no
// natural, datos incompletos, o fecha de último período vencida (más de
// duración_ciclo + 10 días de antigüedad — pedir confirmación antes).
export function resolverFaseCiclo(ctx: FaseCicloContext): FaseCicloResultado | null {
  if (!ctx.hormonalStatus || !NATURAL_CYCLE_STATUSES.includes(ctx.hormonalStatus)) return null;
  if (!ctx.lastPeriodDate || !ctx.cycleLengthDays || ctx.cycleLengthDays <= 0) return null;

  const today = ctx.today ?? new Date();
  const lastPeriod = new Date(ctx.lastPeriodDate);
  if (Number.isNaN(lastPeriod.getTime())) return null;

  const daysSincePeriod = diffInDays(today, lastPeriod);
  if (daysSincePeriod < 0) return null;
  if (daysSincePeriod > ctx.cycleLengthDays + 10) return null; // vencida — pedir confirmación de período primero

  const cycleLength = ctx.cycleLengthDays;
  const diaActual = (daysSincePeriod % cycleLength) + 1; // 1-indexado
  const diaOvulacion = cycleLength - 14;

  let fase: FaseCiclo;
  if (diaActual <= 5) {
    fase = 'menstrual';
  } else if (diaActual <= diaOvulacion - 2) {
    fase = 'folicular';
  } else if (diaActual <= diaOvulacion + 2) {
    fase = 'ovulatoria';
  } else if (diaActual <= cycleLength - 4) {
    fase = 'lutea_temprana';
  } else {
    fase = 'lutea_tardia';
  }

  const confianza: Confianza = ctx.hormonalStatus === IRREGULAR_CYCLE_STATUS ? 'estimado' : 'alta';
  return { fase, diaActual, confianza, mensaje: MENSAJES[fase] };
}

// MEV-04 — variación esperada en fase lútea (temprana o tardía): HRV bajo,
// FC en reposo alta y temperatura alta son fisiología normal en esa ventana,
// no una señal de estrés/mala recuperación.
export function esVariacionEsperadaPorFaseLutea(fase: FaseCicloResultado | null): boolean {
  return fase?.fase === 'lutea_temprana' || fase?.fase === 'lutea_tardia';
}

const PERIOD_WINDOW_BEFORE_DAYS = 2; // "ventana predicha ±2 días" — arranca 2 días antes del día esperado
const PERIOD_WINDOW_AFTER_DAYS = 10; // mismo límite de "vencida" que resolverFaseCiclo — no insistir más allá

// Check-ins (Fase C) — "¿Tu período ya llegó?" solo dentro de la ventana
// predicha, nunca en calendario fijo. A diferencia de resolverFaseCiclo, acá
// se necesita el días-desde-período CRUDO (sin módulo de duración_ciclo):
// si el cliente no confirma en varios ciclos seguidos, diaActual "envuelto"
// volvería a verse como día 1-2 y la ventana nunca se detectaría vencida.
export function isPeriodConfirmationDue(ctx: FaseCicloContext): boolean {
  if (!ctx.hormonalStatus || !NATURAL_CYCLE_STATUSES.includes(ctx.hormonalStatus)) return false;
  if (!ctx.lastPeriodDate || !ctx.cycleLengthDays || ctx.cycleLengthDays <= 0) return false;

  const today = ctx.today ?? new Date();
  const lastPeriod = new Date(ctx.lastPeriodDate);
  if (Number.isNaN(lastPeriod.getTime())) return false;

  const daysSincePeriod = diffInDays(today, lastPeriod);
  if (daysSincePeriod < 0) return false;

  return (
    daysSincePeriod >= ctx.cycleLengthDays - PERIOD_WINDOW_BEFORE_DAYS &&
    daysSincePeriod <= ctx.cycleLengthDays + PERIOD_WINDOW_AFTER_DAYS
  );
}
