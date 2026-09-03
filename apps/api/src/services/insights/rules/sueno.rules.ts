// SUE-01..09 — Matriz_Reglas_Mentoria_BIO360.md, pestaña "Sueño". Varias
// condiciones piden correlación "esa misma noche" (SUE-05/06) que esta v1 no
// puede aislar con la granularidad disponible (wearable_metricas es diario,
// no por evento) — se aproxima con el promedio/tendencia de la ventana
// reciente, documentado en cada regla.
import { estaFueraDeRango } from '../rango-optimo.js';
import { getMarker, baselineNum, baselineStr } from '../types.js';
import type { Rule } from '../types.js';

const DEEP_SLEEP_PCT_REDUCIDO = 15; // % — por debajo se considera sueño profundo reducido (referencia general, no clínica)
const SLEEP_SCORE_BAJO = 70;
const FC_REPOSO_INUSUALMENTE_BAJA = 50; // bpm

export const suenoRules: Rule[] = [
  {
    id: 'SUE-01',
    evaluar(ctx) {
      const ferritina = getMarker(ctx.latestPanel, 'ferritina');
      const wakeups = baselineStr(ctx.baseline, 'wakeups');
      if (ferritina === null || ferritina >= 70) return null;
      if (wakeups && wakeups !== 'Ninguno') {
        return { id: 'SUE-01', tipo: 'optimizar', mensaje: 'Sugerir suplementación de hierro; validar mejora de despertares en el próximo checkpoint.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'SUE-02',
    evaluar(ctx) {
      const magnesio = getMarker(ctx.latestPanel, 'magnesio');
      const sleepQuality = baselineNum(ctx.baseline, 'sleep_quality');
      if (magnesio === null || magnesio >= 1.7 || sleepQuality === null || sleepQuality > 5) return null;
      const profundoReducido = ctx.wearableTrend.suenoProfundoPctPromedio !== null && ctx.wearableTrend.suenoProfundoPctPromedio < DEEP_SLEEP_PCT_REDUCIDO;
      if (profundoReducido) {
        return { id: 'SUE-02', tipo: 'optimizar', mensaje: 'Sugerir magnesio antes de dormir; medir la mejora con el % de sueño profundo del wearable (más rápido que esperar el próximo panel).', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'SUE-03',
    evaluar(ctx) {
      const glucosa = getMarker(ctx.latestPanel, 'glucosa');
      const insulina = getMarker(ctx.latestPanel, 'insulina');
      const homaIr = getMarker(ctx.latestPanel, 'homa_ir');
      const alterado = (glucosa !== null && estaFueraDeRango(glucosa, { min: 70, max: 100 }))
        || (insulina !== null && estaFueraDeRango(insulina, { min: 0, max: 10 }))
        || (homaIr !== null && estaFueraDeRango(homaIr, { min: 0, max: 2.5 }));
      if (!alterado) return null;
      const lastMealHour = baselineStr(ctx.baseline, 'last_meal');
      const cenaTardia = !!lastMealHour && parseHour(lastMealHour) !== null && parseHour(lastMealHour)! >= 21;
      const wakeups = baselineStr(ctx.baseline, 'wakeups');
      if (cenaTardia && wakeups && wakeups !== 'Ninguno') {
        return { id: 'SUE-03', tipo: 'optimizar', mensaje: 'Ajustar composición y horario de la última comida — ejemplo de por qué cruzar 3 fuentes explica lo que ninguna explica sola.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'SUE-04',
    evaluar(ctx) {
      const tsh = getMarker(ctx.latestPanel, 'tsh');
      const t3 = getMarker(ctx.latestPanel, 't3');
      const t4 = getMarker(ctx.latestPanel, 't4');
      const tiroidesAlterada = (tsh !== null && estaFueraDeRango(tsh, { min: 0.5, max: 2.5 }))
        || (t3 !== null && estaFueraDeRango(t3, { min: 2.3, max: 4.2 }))
        || (t4 !== null && estaFueraDeRango(t4, { min: 0.8, max: 1.8 }));
      if (!tiroidesAlterada) return null;
      const fcBaja = ctx.wearableTrend.fcReposoPromedio !== null && ctx.wearableTrend.fcReposoPromedio < FC_REPOSO_INUSUALMENTE_BAJA;
      const brainFog = baselineStr(ctx.baseline, 'brain_fog');
      const energiaBaja = brainFog === 'Siempre' || brainFog === 'Frecuentemente';
      if (fcBaja && energiaBaja) {
        return { id: 'SUE-04', tipo: 'vigilar', mensaje: 'Señala causa hormonal de mal descanso/energía, no atribuible solo al hábito del cliente.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'SUE-05',
    evaluar(ctx) {
      const lastCoffee = baselineStr(ctx.baseline, 'last_coffee');
      const hour = lastCoffee ? parseHour(lastCoffee) : null;
      if (hour === null || hour < 15) return null;
      if (ctx.wearableTrend.suenoScorePromedio !== null && ctx.wearableTrend.suenoScorePromedio < SLEEP_SCORE_BAJO) {
        return { id: 'SUE-05', tipo: 'optimizar', mensaje: 'Correlación personalizada cafeína–sueño; ajustar la hora de corte de cafeína específica para ese cliente.' };
      }
      return null;
    },
  },
  {
    id: 'SUE-06',
    evaluar(ctx) {
      const alcohol = baselineStr(ctx.baseline, 'alcohol');
      if (!alcohol || alcohol === 'Nunca') return null;
      const tgo = getMarker(ctx.latestPanel, 'tgo');
      const tgp = getMarker(ctx.latestPanel, 'tgp');
      const ggt = getMarker(ctx.latestPanel, 'ggt');
      const cayoSuenoOHrv = ctx.wearableTrend.suenoProfundoPctPromedio !== null && ctx.wearableTrend.suenoProfundoPctPromedio < DEEP_SLEEP_PCT_REDUCIDO;
      if (!cayoSuenoOHrv) return null;
      const hepaticoElevado = (tgo !== null && estaFueraDeRango(tgo, { min: 0, max: 40 }))
        || (tgp !== null && estaFueraDeRango(tgp, { min: 0, max: 56 }))
        || (ggt !== null && estaFueraDeRango(ggt, { min: 0, max: 48 }));
      return {
        id: 'SUE-06',
        tipo: hepaticoElevado ? 'vigilar' : 'optimizar',
        mensaje: hepaticoElevado
          ? 'Mostrar al cliente el efecto medible de su propio consumo; transaminasas elevadas — escalar a vigilar función hepática.'
          : 'Mostrar al cliente el efecto medible de su propio consumo de alcohol en su sueño.',
        validoHastaProximoCheckpoint: hepaticoElevado,
      };
    },
  },
  {
    // Regla de seguridad — prioridad máxima sobre cualquier otra de este módulo (ver engine.ts).
    id: 'SUE-07',
    evaluar(ctx) {
      const antecedente = ctx.client.snores === 'Sí' || ctx.client.sleepApneaSigns === 'Sí';
      if (ctx.wearableTrend.spo2NocturnoSostenidoBajo && antecedente) {
        return { id: 'SUE-07', tipo: 'derivar_medico', mensaje: 'Derivar a evaluación con especialista (estudio de sueño); no aplica protocolo de higiene de sueño.' };
      }
      return null;
    },
  },
  {
    id: 'SUE-08',
    evaluar(ctx) {
      if (!ctx.previousPanel || !ctx.latestPanel) return null;
      const ferritinaAntes = getMarker(ctx.previousPanel, 'ferritina');
      const ferritinaAhora = getMarker(ctx.latestPanel, 'ferritina');
      const magnesioAntes = getMarker(ctx.previousPanel, 'magnesio');
      const magnesioAhora = getMarker(ctx.latestPanel, 'magnesio');
      if ([ferritinaAntes, ferritinaAhora, magnesioAntes, magnesioAhora].some((v) => v === null)) return null;
      const ferritinaMejora = distanciaAlRango(ferritinaAhora!, 70, 150) < distanciaAlRango(ferritinaAntes!, 70, 150);
      const magnesioMejora = distanciaAlRango(magnesioAhora!, 1.7, 2.2) < distanciaAlRango(magnesioAntes!, 1.7, 2.2);
      const suenoProfundoNoBaja = ctx.wearableTrend.hrvTendencia !== 'baja';
      if (ferritinaMejora && magnesioMejora && suenoProfundoNoBaja) {
        return { id: 'SUE-08', tipo: 'optimizar', mensaje: 'Validación en Evolution.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    // Nivel 2 — informativo, no dispara ni suprime SUE-01/02/03 (a diferencia
    // de MEV-04, que sí suprime CORT-01/ENT-02 — ver engine.ts).
    id: 'SUE-09',
    evaluar(ctx) {
      if (!ctx.fase) return null;
      const enVentana = ctx.fase.fase === 'menstrual' || ctx.fase.fase === 'lutea_tardia';
      if (!enVentana) return null;
      const sleepQuality = baselineNum(ctx.baseline, 'sleep_quality');
      const suenoProfundoBajo = ctx.wearableTrend.suenoProfundoPctPromedio !== null && ctx.wearableTrend.suenoProfundoPctPromedio < DEEP_SLEEP_PCT_REDUCIDO;
      if ((sleepQuality !== null && sleepQuality <= 5) || suenoProfundoBajo) {
        return { id: 'SUE-09', tipo: 'regla_sistema', mensaje: 'Es normal dormir algo peor estos días por cambios hormonales propios del ciclo.' };
      }
      return null;
    },
  },
];

function parseHour(value: string): number | null {
  const match = value.match(/^(\d{1,2}):/);
  return match ? Number(match[1]) : null;
}

function distanciaAlRango(valor: number, min: number, max: number): number {
  if (valor < min) return min - valor;
  if (valor > max) return valor - max;
  return 0;
}
