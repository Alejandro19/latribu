// NUT-01..07 — Matriz_Reglas_Mentoria_BIO360.md, pestaña "Nutrición".
import { resolverRangoOptimo, estaFueraDeRango } from '../rango-optimo.js';
import { HEPATIC_SAFETY_MULTIPLIER, FIXED_MARKER_RANGES } from '../marker-ranges.js';
import { getMarker, baselineNum, baselineStr } from '../types.js';
import type { Rule } from '../types.js';

export const nutricionRules: Rule[] = [
  {
    id: 'NUT-01',
    evaluar(ctx) {
      const glucosa = getMarker(ctx.latestPanel, 'glucosa');
      const homaIr = getMarker(ctx.latestPanel, 'homa_ir');
      const alterado = (glucosa !== null && estaFueraDeRango(glucosa, { min: 70, max: 100 }))
        || (homaIr !== null && estaFueraDeRango(homaIr, { min: 0, max: 2.5 }));
      if (!alterado) return null;
      const lastMeal = baselineStr(ctx.baseline, 'last_meal');
      const hour = lastMeal ? parseHour(lastMeal) : null;
      const ultraproc = baselineStr(ctx.baseline, 'ultraproc');
      if (hour !== null && hour >= 21 && ultraproc === 'Alto') {
        return { id: 'NUT-01', tipo: 'optimizar', mensaje: 'Ajustar la ventana de alimentación y la composición de la última comida.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'NUT-02',
    evaluar(ctx) {
      const ldl = getMarker(ctx.latestPanel, 'ldl');
      const hdl = getMarker(ctx.latestPanel, 'hdl');
      const trigliceridos = getMarker(ctx.latestPanel, 'trigliceridos');
      const dietType = baselineStr(ctx.baseline, 'diet_type');
      if (!dietType || (ldl === null && hdl === null && trigliceridos === null)) return null;
      return { id: 'NUT-02', tipo: 'optimizar', mensaje: 'Confirma si el protocolo mueve los lípidos en la dirección esperada antes del siguiente checkpoint.', validoHastaProximoCheckpoint: true };
    },
  },
  {
    id: 'NUT-03',
    evaluar(ctx) {
      const b12 = getMarker(ctx.latestPanel, 'b12');
      const homocisteina = getMarker(ctx.latestPanel, 'homocisteina');
      const deficiente = (b12 !== null && b12 < 400) || (homocisteina !== null && homocisteina > 10);
      if (!deficiente) return null;
      const dietType = baselineStr(ctx.baseline, 'diet_type');
      const bajaProteinaAnimal = dietType === 'Vegano' || dietType === 'Vegetariano';
      const energyAm = baselineNum(ctx.baseline, 'energy_am');
      const fatiga = energyAm !== null && energyAm <= 4;
      if (bajaProteinaAnimal && fatiga) {
        return { id: 'NUT-03', tipo: 'optimizar', mensaje: 'Deficiencia nutricional específica, no atribuible a otra causa; suplementar y confirmar en el próximo checkpoint.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'NUT-04',
    evaluar(ctx) {
      const zinc = getMarker(ctx.latestPanel, 'zinc');
      const magnesio = getMarker(ctx.latestPanel, 'magnesio');
      const bajo = (zinc !== null && zinc < 70) || (magnesio !== null && magnesio < 1.7);
      if (!bajo) return null;
      const suplementando = baselineStr(ctx.baseline, 'supps_active') === 'Sí';
      if (suplementando) {
        return { id: 'NUT-04', tipo: 'vigilar', mensaje: 'Confirma que la dosis/protocolo actual es insuficiente; ajustar antes del próximo checkpoint.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'NUT-05',
    evaluar(ctx) {
      const alcohol = baselineStr(ctx.baseline, 'alcohol');
      if (!alcohol || alcohol === 'Nunca') return null;
      const tgo = getMarker(ctx.latestPanel, 'tgo');
      const tgp = getMarker(ctx.latestPanel, 'tgp');
      const ggt = getMarker(ctx.latestPanel, 'ggt');
      const leveElevado = (tgo !== null && estaFueraDeRango(tgo, { min: 0, max: 40 }) && !excedeSeguridad(tgo, 40))
        || (tgp !== null && estaFueraDeRango(tgp, { min: 0, max: 56 }) && !excedeSeguridad(tgp, 56))
        || (ggt !== null && estaFueraDeRango(ggt, { min: 0, max: 48 }) && !excedeSeguridad(ggt, 48));
      if (leveElevado) {
        return { id: 'NUT-05', tipo: 'vigilar', mensaje: 'Correlaciona el consumo con la función hepática; seguimiento obligatorio en el próximo checkpoint.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    id: 'NUT-06',
    evaluar(ctx) {
      const creatinina = getMarker(ctx.latestPanel, 'creatinina');
      const bun = getMarker(ctx.latestPanel, 'bun');
      const creatininaRango = resolverRangoOptimo('creatinina', ctx.client);
      const alterado = (creatinina !== null && creatininaRango !== null && estaFueraDeRango(creatinina, creatininaRango))
        || (bun !== null && !inFixedRange('bun', bun));
      if (!alterado) return null;
      const water = baselineNum(ctx.baseline, 'water_liters');
      if (water !== null && water < 2) {
        return { id: 'NUT-06', tipo: 'vigilar', mensaje: 'Descartar hidratación insuficiente antes de asumir un problema renal.', validoHastaProximoCheckpoint: true };
      }
      return null;
    },
  },
  {
    // Regla de seguridad — prioridad máxima sobre cualquier otra de este módulo (ver engine.ts).
    id: 'NUT-07',
    evaluar(ctx) {
      const tgo = getMarker(ctx.latestPanel, 'tgo');
      const tgp = getMarker(ctx.latestPanel, 'tgp');
      const ggt = getMarker(ctx.latestPanel, 'ggt');
      if (excedeSeguridad(tgo, 40) || excedeSeguridad(tgp, 56) || excedeSeguridad(ggt, 48)) {
        return { id: 'NUT-07', tipo: 'derivar_medico', mensaje: 'Derivar a evaluación médica; no aplica protocolo nutricional.' };
      }
      return null;
    },
  },
];

function excedeSeguridad(valor: number | null, limiteSuperior: number): boolean {
  return valor !== null && valor > limiteSuperior * HEPATIC_SAFETY_MULTIPLIER;
}

function inFixedRange(marcador: 'bun', valor: number): boolean {
  const rango = FIXED_MARKER_RANGES[marcador];
  return !!rango && !estaFueraDeRango(valor, rango);
}

function parseHour(value: string): number | null {
  const match = value.match(/^(\d{1,2}):/);
  return match ? Number(match[1]) : null;
}
