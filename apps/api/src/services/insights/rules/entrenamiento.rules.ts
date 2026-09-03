// ENT-01..05 — Matriz_Reglas_Mentoria_BIO360.md, pestaña "Entrenamiento".
// ENT-02 está sujeta a supresión por MEV-04 (fase lútea) — aplicada en
// engine.ts, no acá.
import { resolverRangoOptimo } from '../rango-optimo.js';
import { getMarker, baselineNum, baselineStr } from '../types.js';
import type { Rule } from '../types.js';

export const entrenamientoRules: Rule[] = [
  {
    // Solo aplica a clientes hombres — el rango de referencia de
    // testosterona libre es específico de sexo (ver Marcadores Sanguíneos);
    // no evaluar con ese umbral en clientas mujeres.
    id: 'ENT-01',
    evaluar(ctx) {
      if (ctx.client.gender !== 'Masculino') return null;
      const testosteronaLibre = getMarker(ctx.latestPanel, 'testosterona_libre');
      const rango = resolverRangoOptimo('testosterona_libre', ctx.client);
      const trainingDays = baselineNum(ctx.baseline, 'training_days');
      if (testosteronaLibre === null || !rango || testosteronaLibre >= rango.min) return null;
      if (ctx.wearableTrend.hrvTendencia === 'baja' && trainingDays !== null && trainingDays >= 5) {
        return { id: 'ENT-01', tipo: 'vigilar', mensaje: 'Señala causa hormonal de la falta de recuperación, no solo exceso de programación; reducir volumen antes de suplementar.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'ENT-02',
    evaluar(ctx) {
      const pcr = getMarker(ctx.latestPanel, 'pcr');
      const trainingDays = baselineNum(ctx.baseline, 'training_days');
      if (pcr === null || pcr <= 1.0) return null;
      const entrenamientoConsistente = trainingDays !== null && trainingDays >= 3;
      const estancado = ctx.wearableTrend.hrvTendencia !== 'sube';
      if (entrenamientoConsistente && estancado) {
        return { id: 'ENT-02', tipo: 'vigilar', mensaje: 'Diferencia inflamación crónica (requiere atención) de fatiga normal de adaptación al entrenamiento.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'ENT-03',
    evaluar(ctx) {
      const ferritina = getMarker(ctx.latestPanel, 'ferritina');
      const hemoglobina = getMarker(ctx.latestPanel, 'hemoglobina');
      const hematocrito = getMarker(ctx.latestPanel, 'hematocrito');
      const hbRango = resolverRangoOptimo('hemoglobina', ctx.client);
      const htoRango = resolverRangoOptimo('hematocrito', ctx.client);
      const ferritinaBaja = ferritina !== null && ferritina < 70;
      const hbBaja = hemoglobina !== null && hbRango !== null && hemoglobina < hbRango.min;
      const htoBajo = hematocrito !== null && htoRango !== null && hematocrito < htoRango.min;
      if (!ferritinaBaja && !hbBaja && !htoBajo) return null;
      const energyAm = baselineNum(ctx.baseline, 'energy_am');
      const energyPm = baselineNum(ctx.baseline, 'energy_pm');
      const fatigaReportada = (energyAm !== null && energyAm <= 4) || (energyPm !== null && energyPm <= 4);
      if (fatigaReportada) {
        return { id: 'ENT-03', tipo: 'optimizar', mensaje: 'Explica caídas de rendimiento no atribuibles a disciplina; especialmente relevante en clientas mujeres.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    // Regla de seguridad — prioridad máxima sobre cualquier otra de este módulo (ver engine.ts).
    id: 'ENT-04',
    evaluar(ctx) {
      const medicalClearance = baselineStr(ctx.baseline, 'medical_clearance');
      const injury = baselineStr(ctx.baseline, 'injury');
      const lesionActiva = !!injury && !/^ningun/i.test(injury);
      if (medicalClearance === 'No' || lesionActiva) {
        return { id: 'ENT-04', tipo: 'derivar_medico', mensaje: 'Bloquea cualquier sugerencia automática de aumentar intensidad, sin importar otros marcadores.' };
      }
      return null;
    },
  },
  {
    id: 'ENT-05',
    evaluar(ctx) {
      if (!ctx.previousPanel || !ctx.latestPanel) return null;
      const rango = resolverRangoOptimo('testosterona_libre', ctx.client);
      const testAntes = getMarker(ctx.previousPanel, 'testosterona_libre');
      const testAhora = getMarker(ctx.latestPanel, 'testosterona_libre');
      const glucosaAntes = getMarker(ctx.previousPanel, 'glucosa');
      const glucosaAhora = getMarker(ctx.latestPanel, 'glucosa');
      const hormonalMejora = rango && testAntes !== null && testAhora !== null
        && distanciaAlRango(testAhora, rango.min, rango.max) < distanciaAlRango(testAntes, rango.min, rango.max);
      const metabolicoMejora = glucosaAntes !== null && glucosaAhora !== null
        && distanciaAlRango(glucosaAhora, 70, 100) < distanciaAlRango(glucosaAntes, 70, 100);
      if ((hormonalMejora || metabolicoMejora) && ctx.wearableTrend.hrvTendencia === 'sube') {
        return { id: 'ENT-05', tipo: 'optimizar', mensaje: 'Confirma que el programa funciona a nivel hormonal, no solo subjetivo.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
];

function distanciaAlRango(valor: number, min: number, max: number): number {
  if (valor < min) return min - valor;
  if (valor > max) return valor - max;
  return 0;
}
