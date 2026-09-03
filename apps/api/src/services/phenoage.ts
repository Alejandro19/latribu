import { PHENOAGE_MARKER_IDS } from './insights/marker-ranges.js';

// Edad Biológica — fórmula PhenoAge (Levine et al., 2018), coeficientes
// verificados contra el paquete de referencia dayoonkwon/BioAge
// (phenoage_calc.R, rama orig=TRUE) y cruzados con una segunda fuente
// independiente. Confirmados con Alejandro antes de implementar (2026-08-31).
//
// Los 4 valores de entrada que ya existían en el panel de 32 marcadores se
// reciben en SU unidad de almacenamiento estándar (ver MARKER_UNITS en
// lab-ai-extraction.service.ts) y se convierten acá a la unidad que exige la
// fórmula original — nunca se duplica el campo (mismo criterio que ya se
// aplicaba para no duplicar PCR):
//   - creatinina: mg/dL → µmol/L (×88.4)
//   - glucosa: mg/dL → mmol/L (×0.0555)
//   - pcr: mg/L → mg/dL (÷10) antes de tomar ln(PCR)
//   - leucocitos: x10³/µL, sin conversión (coincide con la unidad de la fórmula)
export type PhenoAgeMarkers = {
  albumina: number; // g/L
  creatinina: number; // mg/dL (unidad de almacenamiento del panel)
  glucosa: number; // mg/dL (unidad de almacenamiento del panel)
  pcr: number; // mg/L (unidad de almacenamiento del panel)
  linfocitos_pct: number; // %
  vcm: number; // fL
  rdw: number; // %
  fosfatasa_alcalina: number; // U/L
  leucocitos: number; // x10³/µL
};

// true solo si `datos` trae los 9 marcadores requeridos con valores
// numéricos finitos — el cálculo de Edad Biológica nunca se aproxima ni se
// hace con datos parciales, por instrucción explícita del producto.
export function hasCompletePhenoAgeMarkers(datos: Record<string, unknown>): datos is Record<string, number> {
  return PHENOAGE_MARKER_IDS.every((id) => typeof datos[id] === 'number' && Number.isFinite(datos[id] as number));
}

export function extractPhenoAgeMarkers(datos: Record<string, unknown>): PhenoAgeMarkers | null {
  if (!hasCompletePhenoAgeMarkers(datos)) return null;
  return {
    albumina: datos.albumina,
    creatinina: datos.creatinina,
    glucosa: datos.glucosa,
    pcr: datos.pcr,
    linfocitos_pct: datos.linfocitos_pct,
    vcm: datos.vcm,
    rdw: datos.rdw,
    fosfatasa_alcalina: datos.fosfatasa_alcalina,
    leucocitos: datos.leucocitos,
  };
}

// Fórmula PhenoAge original (Levine et al., 2018) — no modificar sin volver
// a verificar contra la fuente. `edadCronologica` es la edad del cliente en
// la fecha del checkpoint del panel (no la edad actual).
export function computePhenoAge(markers: PhenoAgeMarkers, edadCronologica: number): number {
  const creatininaUmol = markers.creatinina * 88.4;
  const glucosaMmol = markers.glucosa * 0.0555;
  const pcrMgDl = markers.pcr / 10;
  const lnCrp = Math.log(pcrMgDl);

  const xb =
    -19.90667 +
    -0.03359355 * markers.albumina +
    0.009506491 * creatininaUmol +
    0.1953192 * glucosaMmol +
    0.09536762 * lnCrp +
    -0.01199984 * markers.linfocitos_pct +
    0.02676401 * markers.vcm +
    0.3306156 * markers.rdw +
    0.001868778 * markers.fosfatasa_alcalina +
    0.05542406 * markers.leucocitos +
    0.08035356 * edadCronologica;

  const m = 1 - Math.exp((-1.51714 * Math.exp(xb)) / 0.007692696);
  return 141.50225 + Math.log(-0.0055305 * Math.log(1 - m)) / 0.090165;
}
