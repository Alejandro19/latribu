// CORT-01..08 — Matriz_Reglas_Mentoria_BIO360.md, pestaña "Cortisol".
// CORT-01 y CORT-02 usan "HRV en tendencia bajista (sostenida)" — proxy:
// wearableTrend.hrvTendencia === 'baja' (últimos 7 días vs. los 21 previos,
// ver wearable-trend.ts). CORT-01 está sujeta a supresión por MEV-04
// (fase lútea) — aplicada en engine.ts, no acá.
import { resolverRangoOptimo, estaFueraDeRango } from '../rango-optimo.js';
import { getMarker, baselineNum, baselineStr } from '../types.js';
import type { Rule } from '../types.js';

const CORTISOL_RANGO_BAJO_MAX = 12; // mitad inferior de 6-18 ug/dL ("rango bajo del óptimo")

export const cortisolRules: Rule[] = [
  {
    id: 'CORT-01',
    evaluar(ctx) {
      const cortisol = getMarker(ctx.latestPanel, 'cortisol');
      const stress = baselineNum(ctx.baseline, 'stress_level');
      if (cortisol === null || stress === null) return null;
      if (cortisol > 18 && ctx.wearableTrend.hrvTendencia === 'baja' && stress >= 7) {
        return { id: 'CORT-01', tipo: 'vigilar', mensaje: 'Concordancia total en 3 fuentes: prioridad alta de intervención en carga de estrés, no solo técnica de relajación.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'CORT-02',
    evaluar(ctx) {
      const cortisol = getMarker(ctx.latestPanel, 'cortisol');
      const dhea = getMarker(ctx.latestPanel, 'dhea');
      if (cortisol === null || dhea === null) return null;
      const dheaRango = resolverRangoOptimo('dhea', ctx.client);
      if (!dheaRango) return null;
      const cortisolBajo = cortisol >= 6 && cortisol <= CORTISOL_RANGO_BAJO_MAX;
      const dheaBajo = dhea < dheaRango.min;
      if (cortisolBajo && dheaBajo && ctx.wearableTrend.hrvTendencia === 'baja') {
        return { id: 'CORT-02', tipo: 'vigilar', mensaje: 'Patrón de agotamiento, no de estrés agudo: reducir carga total (entrenamiento + vida), no agregar más técnicas de manejo del estrés.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'CORT-03',
    evaluar(ctx) {
      const cortisol = getMarker(ctx.latestPanel, 'cortisol');
      if (cortisol === null || !estaEnRango(cortisol, 6, 18)) return null;
      const energyAm = baselineNum(ctx.baseline, 'energy_am');
      const energyPm = baselineNum(ctx.baseline, 'energy_pm');
      const energiaBaja = (energyAm !== null && energyAm <= 4) || (energyPm !== null && energyPm <= 4);
      if (energiaBaja && ctx.wearableTrend.hrvTendencia === 'baja') {
        return { id: 'CORT-03', tipo: 'vigilar', mensaje: 'Descarta estrés como causa; revisar Ferritina/TSH antes de intervenir en manejo de estrés.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'CORT-04',
    evaluar(ctx) {
      const magnesio = getMarker(ctx.latestPanel, 'magnesio');
      const stress = baselineNum(ctx.baseline, 'stress_level');
      const coping = baselineStr(ctx.baseline, 'coping_techniques');
      const sinTecnica = !coping || /ningun/i.test(coping);
      if (magnesio === null || stress === null) return null;
      if (magnesio < 1.7 && stress >= 7 && sinTecnica) {
        return { id: 'CORT-04', tipo: 'optimizar', mensaje: 'Sugerir suplementación de magnesio junto con una técnica de respiración; el déficit potencia la respuesta al estrés.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'CORT-05',
    evaluar(ctx) {
      const cortisol = getMarker(ctx.latestPanel, 'cortisol');
      const glucosa = getMarker(ctx.latestPanel, 'glucosa');
      const homaIr = getMarker(ctx.latestPanel, 'homa_ir');
      const anxietyFood = baselineStr(ctx.baseline, 'anxiety_food');
      if (cortisol === null || cortisol <= 18) return null;
      const metabolicoAlterado = (glucosa !== null && !estaEnRango(glucosa, 70, 100)) || (homaIr !== null && !estaEnRango(homaIr, 0, 2.5));
      if (metabolicoAlterado && anxietyFood) {
        return { id: 'CORT-05', tipo: 'optimizar', mensaje: 'Ajustar el timing de comidas alrededor del pico de estrés del día, en vez de abordar el antojo como falta de voluntad.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'CORT-06',
    evaluar(ctx) {
      const pcr = getMarker(ctx.latestPanel, 'pcr');
      const sleepQuality = baselineNum(ctx.baseline, 'sleep_quality');
      const trainingDays = baselineNum(ctx.baseline, 'training_days');
      if (pcr === null || pcr <= 1.0) return null;
      const habitosCorrectos = (sleepQuality !== null && sleepQuality >= 7) && (trainingDays !== null && trainingDays >= 3);
      if (habitosCorrectos && ctx.wearableTrend.hrvTendencia === 'baja') {
        return { id: 'CORT-06', tipo: 'vigilar', mensaje: 'Señala inflamación sistémica, no estrés psicológico, como causa de baja recuperación.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    // Regla de seguridad — prioridad máxima sobre cualquier otra de este módulo (ver engine.ts).
    id: 'CORT-07',
    evaluar(ctx) {
      const potasio = getMarker(ctx.latestPanel, 'potasio');
      if (potasio === null) return null;
      if (!estaEnRango(potasio, 3.5, 5.0)) {
        return { id: 'CORT-07', tipo: 'derivar_medico', mensaje: 'Derivar a evaluación médica de inmediato; no aplica ningún protocolo de coaching (riesgo cardíaco).' };
      }
      return null;
    },
  },
  {
    id: 'CORT-08',
    evaluar(ctx) {
      if (!ctx.previousPanel || !ctx.latestPanel) return null;
      const cortisolAntes = getMarker(ctx.previousPanel, 'cortisol');
      const cortisolAhora = getMarker(ctx.latestPanel, 'cortisol');
      const dheaAntes = getMarker(ctx.previousPanel, 'dhea');
      const dheaAhora = getMarker(ctx.latestPanel, 'dhea');
      const dheaRango = resolverRangoOptimo('dhea', ctx.client);
      if ([cortisolAntes, cortisolAhora, dheaAntes, dheaAhora].some((v) => v === null) || !dheaRango) return null;
      const cortisolMejora = distanciaAlRango(cortisolAhora!, 6, 18) < distanciaAlRango(cortisolAntes!, 6, 18);
      const dheaMejora = distanciaAlRango(dheaAhora!, dheaRango.min, dheaRango.max) < distanciaAlRango(dheaAntes!, dheaRango.min, dheaRango.max);
      if (cortisolMejora && dheaMejora && ctx.wearableTrend.hrvTendencia === 'sube') {
        return { id: 'CORT-08', tipo: 'optimizar', mensaje: 'Validación triple del protocolo; se muestra en Evolution como "protocolo confirmado".', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    // Neurowellness — extiende la matriz existente, no crea un motor nuevo.
    // Solo depende de wearableTrend (no de panels), así que nunca lleva
    // validoHastaProximoCheckpoint (esa bandera es solo para insights que sí
    // dependen de un checkpoint de laboratorio, ver types.ts). Se suprime en
    // engine.ts cuando cualquier otra regla de cortisol también dispara —
    // CORT-01/02/03/06 ya usan esta misma condición de HRV más una señal
    // concordante más específica, así que CORT-09 solo debe verse cuando el
    // HRV bajando es la única señal disponible (ver aplicarSupresionCort09).
    id: 'CORT-09',
    evaluar(ctx) {
      if (ctx.wearableTrend.hrvTendencia === 'baja') {
        return {
          id: 'CORT-09',
          tipo: 'optimizar',
          mensaje: 'Tu HRV muestra una tendencia sostenida a la baja — es buen momento para aumentar la frecuencia de tus prácticas de regulación del sistema nervioso (respiración vagal, recuperación activa) esta semana.',
        };
      }
      return null;
    },
  },
];

function estaEnRango(valor: number, min: number, max: number): boolean {
  return !estaFueraDeRango(valor, { min, max });
}

function distanciaAlRango(valor: number, min: number, max: number): number {
  if (valor < min) return min - valor;
  if (valor > max) return valor - max;
  return 0;
}
