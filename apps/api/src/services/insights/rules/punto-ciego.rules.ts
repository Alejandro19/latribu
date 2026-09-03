// PC-01..03 — Matriz_Reglas_Mentoria_BIO360.md, pestaña "Punto Ciego".
import { resolverRangoOptimo, estaFueraDeRango } from '../rango-optimo.js';
import { GENDER_DEPENDENT_MARKERS, FIXED_MARKER_RANGES, type MarkerId } from '../marker-ranges.js';
import { baselineNum, baselineStr } from '../types.js';
import type { Rule } from '../types.js';

const ALL_MARKERS: MarkerId[] = [
  ...Object.keys(FIXED_MARKER_RANGES) as MarkerId[],
  ...GENDER_DEPENDENT_MARKERS,
];

export const puntoCiegoRules: Rule[] = [
  {
    id: 'PC-01',
    evaluar(ctx) {
      if (!ctx.latestPanel) return null;
      const hayMarcadorAlterado = ALL_MARKERS.some((marcador) => {
        const valor = ctx.latestPanel!.datos[marcador];
        if (typeof valor !== 'number') return false;
        const rango = resolverRangoOptimo(marcador, ctx.client);
        return !!rango && estaFueraDeRango(valor, rango);
      });
      if (!hayMarcadorAlterado) return null;
      const energyAm = baselineNum(ctx.baseline, 'energy_am');
      const energyPm = baselineNum(ctx.baseline, 'energy_pm');
      const mood = baselineStr(ctx.baseline, 'mood');
      const percepcionPositiva = (energyAm !== null && energyAm >= 7) || (energyPm !== null && energyPm >= 7) || mood === 'Estable' || mood === 'Generalmente alto';
      if (percepcionPositiva) {
        return { id: 'PC-01', tipo: 'vigilar', mensaje: 'El caso central del módulo: mostrar al cliente lo que aún no está sintiendo.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'PC-02',
    evaluar(ctx) {
      const pcr = ctx.latestPanel?.datos.pcr;
      if (typeof pcr !== 'number' || pcr <= 1.0) return null;
      const sleepQuality = baselineNum(ctx.baseline, 'sleep_quality');
      const trainingDays = baselineNum(ctx.baseline, 'training_days');
      const disciplinaReportada = (sleepQuality !== null && sleepQuality >= 7) && (trainingDays !== null && trainingDays >= 3);
      if (disciplinaReportada && ctx.wearableTrend.hrvTendencia === 'baja') {
        return { id: 'PC-02', tipo: 'vigilar', mensaje: 'Tu esfuerzo no se refleja en tu recuperación — posible inflamación oculta.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'PC-03',
    evaluar(ctx) {
      const testosteronaTotal = ctx.latestPanel?.datos.testosterona_total;
      const estradiol = ctx.latestPanel?.datos.estradiol;
      const testosteronaRango = resolverRangoOptimo('testosterona_total', ctx.client);
      const estradiolRango = resolverRangoOptimo('estradiol', ctx.client);
      const testosteronaAlterada = typeof testosteronaTotal === 'number' && !!testosteronaRango && estaFueraDeRango(testosteronaTotal, testosteronaRango);
      const estradiolAlterado = typeof estradiol === 'number' && !!estradiolRango && estaFueraDeRango(estradiol, estradiolRango);
      if (!testosteronaAlterada && !estradiolAlterado) return null;
      const stress = baselineNum(ctx.baseline, 'stress_level');
      if (stress !== null && stress <= 3 && ctx.wearableTrend.hrvTendencia === 'baja') {
        return { id: 'PC-03', tipo: 'vigilar', mensaje: 'Señala que el estrés percibido no coincide con el estado fisiológico real.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
];
