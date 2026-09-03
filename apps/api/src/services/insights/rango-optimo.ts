// MEV-03 — Regla de sistema: nunca comparar Testosterona Total, Testosterona
// Libre, Estradiol, DHEA-S, Hemoglobina, Hematocrito o Creatinina contra un
// valor fijo único. Este es el ÚNICO punto que resuelve la banda de
// género/edad/estado hormonal correcta — ninguna regla debe reimplementar
// esta lógica (ver Matriz_Reglas_Mentoria_BIO360.md, Leyenda y pestaña
// "Marcadores Sanguíneos").
import {
  FIXED_MARKER_RANGES, GENDER_RANGES, ESTRADIOL_RANGES, DHEA_RANGES,
  type MarkerId, type Range,
} from './marker-ranges.js';

export type RangoOptimoContext = {
  gender: string | null;
  birthdate: string | null;
  hormonalStatus?: string | null;
};

export const POSMENOPAUSIA = 'Posmenopausia';

export function computeAge(birthdate: string | null, today: Date = new Date()): number | null {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const beforeBirthdayThisYear =
    today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

export function resolverRangoOptimo(marcador: MarkerId, ctx: RangoOptimoContext): Range | null {
  const fixed = FIXED_MARKER_RANGES[marcador];
  if (fixed) return fixed;

  const isMale = ctx.gender === 'Masculino';
  const isFemale = ctx.gender === 'Femenino';

  if (marcador === 'estradiol') {
    if (isMale) return ESTRADIOL_RANGES.hombres;
    if (isFemale) {
      return ctx.hormonalStatus === POSMENOPAUSIA ? ESTRADIOL_RANGES.mujeresPosmenopausicas : ESTRADIOL_RANGES.mujeresPremenopausicas;
    }
    return null; // género no binario/no informado: sin banda de referencia en la matriz
  }

  if (marcador === 'dhea') {
    const age = computeAge(ctx.birthdate);
    if (age === null) return null;
    const bands = isMale ? DHEA_RANGES.hombres : isFemale ? DHEA_RANGES.mujeres : null;
    if (!bands) return null;
    const band = bands.find((b) => age >= b.min && age <= b.max);
    return band?.range ?? null;
  }

  const genderRange = GENDER_RANGES[marcador];
  if (genderRange) {
    if (isMale) return genderRange.hombres ?? null;
    if (isFemale) return genderRange.mujeres ?? null;
    return null;
  }

  return null;
}

export function estaFueraDeRango(valor: number, rango: Range): boolean {
  return valor < rango.min || valor > rango.max;
}
