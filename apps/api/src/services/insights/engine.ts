// Orquestador del motor de insights cruzados — exclusivo Mentoría. Ningún
// otro servicio/controller debe evaluar reglas por su cuenta; siempre entrar
// por `evaluateInsights`.
import { findClientById } from '../clients.service.js';
import { getPersonalInfoByClientId } from '../personal-info.service.js';
import { listLabPanels } from '../lab-panels.service.js';
import { computeWearableTrend } from './wearable-trend.js';
import { getLatestWeeklyReflection } from '../checkins.service.js';
import { resolverFaseCiclo, PREGNANCY_OR_LACTATION_STATUS } from './fase-ciclo.js';
import { getMarker } from './types.js';
import type { InsightsResult, LabPanelWithDia, ModuleKey, RuleContext, RuleResult } from './types.js';
import { cortisolRules } from './rules/cortisol.rules.js';
import { suenoRules } from './rules/sueno.rules.js';
import { entrenamientoRules } from './rules/entrenamiento.rules.js';
import { nutricionRules } from './rules/nutricion.rules.js';
import { puntoCiegoRules } from './rules/punto-ciego.rules.js';
import { miEvolucionRules } from './rules/mi-evolucion.rules.js';

// Umbral de "excede claramente la variación esperada por fase" (MEV-04):
// solo con esto se permite que CORT-01/ENT-02 disparen en fase lútea pese a
// coincidir con lo fisiológicamente esperable. La matriz no da un número
// exacto — este es el criterio de v1, documentado y ajustable acá.
const CORTISOL_SEVERO = 24; // ug/dL — ~33% sobre el límite superior óptimo (18)
const PCR_SEVERO = 2.0; // mg/L — el doble del límite superior óptimo (1.0)

// Los 4 módulos con una regla de seguridad propia (ver Matriz_Reglas_Mentoria_BIO360.md, "Reglas de Seguridad").
const SAFETY_RULE_BY_MODULE: Partial<Record<ModuleKey, string>> = {
  cortisol: 'CORT-07',
  sueno: 'SUE-07',
  entrenamiento: 'ENT-04',
  nutricion: 'NUT-07',
};

export class NotMentoringClientError extends Error {
  constructor() {
    super('El motor de insights es exclusivo para clientes Premium.');
  }
}

function runModule(rules: { id: string; evaluar: (ctx: RuleContext) => RuleResult | null }[], ctx: RuleContext): RuleResult[] {
  return rules.map((r) => r.evaluar(ctx)).filter((r): r is RuleResult => r !== null);
}

// MEV-04 — no activar CORT-01/ENT-02 si la magnitud coincide con la
// variación esperada de fase lútea; sí activar si la excede claramente.
function aplicarSupresionPorFase(modules: Record<ModuleKey, RuleResult[]>, ctx: RuleContext): void {
  const enFaseLutea = ctx.fase?.fase === 'lutea_temprana' || ctx.fase?.fase === 'lutea_tardia';
  if (!enFaseLutea) return;

  const cortisol = getMarker(ctx.latestPanel, 'cortisol');
  if (cortisol === null || cortisol < CORTISOL_SEVERO) {
    modules.cortisol = modules.cortisol.filter((r) => r.id !== 'CORT-01');
  }
  const pcr = getMarker(ctx.latestPanel, 'pcr');
  if (pcr === null || pcr < PCR_SEVERO) {
    modules.entrenamiento = modules.entrenamiento.filter((r) => r.id !== 'ENT-02');
  }
}

// CORT-09 (Neurowellness) dispara solo con HRV bajando, la misma condición
// base que ya usan CORT-01/02/03/06 junto con una señal más específica — sin
// esto, CORT-09 ("aumenta la frecuencia de tus prácticas") coexistiría y
// contradiría insights más específicos como CORT-01/02 ("no solo técnica de
// relajación" / "no agregar más técnicas"). Se muestra únicamente cuando es
// la única señal de cortisol del checkpoint.
function aplicarSupresionCort09(modules: Record<ModuleKey, RuleResult[]>): void {
  const cort09 = modules.cortisol.find((r) => r.id === 'CORT-09');
  if (cort09 && modules.cortisol.length > 1) {
    modules.cortisol = modules.cortisol.filter((r) => r.id !== 'CORT-09');
  }
}

// Las 4 reglas de seguridad anulan cualquier otra sugerencia del mismo
// módulo mientras estén activas.
function aplicarPrioridadDeSeguridad(modules: Record<ModuleKey, RuleResult[]>): void {
  for (const [moduleKey, safetyId] of Object.entries(SAFETY_RULE_BY_MODULE) as [ModuleKey, string][]) {
    const results = modules[moduleKey];
    const safety = results.find((r) => r.id === safetyId);
    if (safety) modules[moduleKey] = [safety];
  }
}

export async function evaluateInsights(clientId: string): Promise<InsightsResult> {
  const client = await findClientById(clientId);
  if (!client || client.clientType !== 'mentoring') throw new NotMentoringClientError();

  const personalInfo = await getPersonalInfoByClientId(clientId);
  const hormonalStatus = personalInfo?.hormonalStatus ?? null;

  // Terreno médico, no de coaching — el motor completo no se ejecuta.
  if (hormonalStatus === PREGNANCY_OR_LACTATION_STATUS) {
    return {
      excluded: 'embarazo_lactancia',
      mensaje: 'Este módulo no aplica durante embarazo o lactancia — es terreno médico, no de coaching.',
    };
  }

  const [panelsRaw, wearableTrend, latestReflection] = await Promise.all([
    listLabPanels(clientId),
    computeWearableTrend(clientId),
    getLatestWeeklyReflection(clientId),
  ]);

  const panels: LabPanelWithDia[] = panelsRaw
    .map((p) => ({
      semanaNumero: p.semanaNumero,
      fecha: p.fecha,
      datos: (p.datos ?? {}) as Record<string, number>,
      diaCicloPanel: p.diaCicloPanel ?? null,
    }))
    .sort((a, b) => a.semanaNumero - b.semanaNumero);

  const latestPanel = panels.length > 0 ? panels[panels.length - 1] : null;
  const previousPanel = panels.length > 1 ? panels[panels.length - 2] : null;

  const fase = resolverFaseCiclo({
    hormonalStatus,
    lastPeriodDate: personalInfo?.lastPeriodDate ?? null,
    cycleLengthDays: personalInfo?.cycleLengthDays ?? null,
  });

  const ctx: RuleContext = {
    client: {
      gender: personalInfo?.gender ?? null,
      birthdate: personalInfo?.birthdate ?? null,
      hormonalStatus,
      snores: personalInfo?.snores ?? null,
      sleepApneaSigns: personalInfo?.sleepApneaSigns ?? null,
    },
    // stress_level/coping_techniques/wakeups: si hay una reflexión semanal,
    // pisa la foto fija del onboarding con el dato más reciente — si no,
    // el motor quedaría "congelado" en el día 0 para siempre (ver Contexto
    // del plan de Fase C).
    baseline: {
      ...(personalInfo?.onboardingReport as Record<string, unknown> | null ?? {}),
      ...(latestReflection ? {
        stress_level: latestReflection.estresCronico,
        ...(latestReflection.tecnicasManejoUsadas != null ? { coping_techniques: latestReflection.tecnicasManejoUsadas } : {}),
        ...(latestReflection.despertaresNocturnosSemana != null ? { wakeups: latestReflection.despertaresNocturnosSemana } : {}),
      } : {}),
    },
    panels,
    latestPanel,
    previousPanel,
    wearableTrend,
    fase,
  };

  const modules: Record<ModuleKey, RuleResult[]> = {
    cortisol: runModule(cortisolRules, ctx),
    sueno: runModule(suenoRules, ctx),
    entrenamiento: runModule(entrenamientoRules, ctx),
    nutricion: runModule(nutricionRules, ctx),
    puntoCiego: runModule(puntoCiegoRules, ctx),
    miEvolucion: runModule(miEvolucionRules, ctx),
  };

  aplicarSupresionPorFase(modules, ctx);
  aplicarSupresionCort09(modules);
  aplicarPrioridadDeSeguridad(modules);

  return { excluded: null, fase, modules };
}
