import { describe, it, expect } from 'vitest';
import { computePhenoAge, hasCompletePhenoAgeMarkers, extractPhenoAgeMarkers, type PhenoAgeMarkers } from '../src/services/phenoage.js';

const HEALTHY_MARKERS: PhenoAgeMarkers = {
  albumina: 45,
  creatinina: 0.9,
  glucosa: 85,
  pcr: 1.0,
  linfocitos_pct: 30,
  vcm: 90,
  rdw: 12.5,
  fosfatasa_alcalina: 70,
  leucocitos: 6.5,
};

const UNHEALTHY_MARKERS: PhenoAgeMarkers = {
  albumina: 38,
  creatinina: 1.1,
  glucosa: 110,
  pcr: 3.0,
  linfocitos_pct: 22,
  vcm: 96,
  rdw: 15,
  fosfatasa_alcalina: 100,
  leucocitos: 9,
};

describe('computePhenoAge', () => {
  it('matches a hand-computed reference value for a healthy 40-year-old profile', () => {
    // Referencia calculada de forma independiente con los mismos
    // coeficientes (Levine et al., 2018 / paquete dayoonkwon/BioAge,
    // orig=TRUE) fuera de este archivo — ver commit para el detalle.
    expect(computePhenoAge(HEALTHY_MARKERS, 40)).toBeCloseTo(30.7419, 3);
  });

  it('is monotonically increasing in chronological age when markers stay fixed', () => {
    const at30 = computePhenoAge(HEALTHY_MARKERS, 30);
    const at40 = computePhenoAge(HEALTHY_MARKERS, 40);
    const at60 = computePhenoAge(HEALTHY_MARKERS, 60);
    expect(at40).toBeGreaterThan(at30);
    expect(at60).toBeGreaterThan(at40);
  });

  it('reports a higher biological age for a worse marker profile at the same chronological age', () => {
    const healthy = computePhenoAge(HEALTHY_MARKERS, 40);
    const unhealthy = computePhenoAge(UNHEALTHY_MARKERS, 40);
    expect(unhealthy).toBeGreaterThan(healthy);
  });
});

describe('hasCompletePhenoAgeMarkers / extractPhenoAgeMarkers', () => {
  it('is false when any of the 9 required markers is missing', () => {
    const { leucocitos: _omit, ...rest } = HEALTHY_MARKERS;
    expect(hasCompletePhenoAgeMarkers(rest)).toBe(false);
    expect(extractPhenoAgeMarkers(rest)).toBeNull();
  });

  it('is false when a marker is present but not a finite number', () => {
    expect(hasCompletePhenoAgeMarkers({ ...HEALTHY_MARKERS, glucosa: Number.NaN })).toBe(false);
  });

  it('is true and extracts exactly the 9 markers when the panel has extra unrelated markers', () => {
    const datos = { ...HEALTHY_MARKERS, hba1c: 5.1, ldl: 90 };
    expect(hasCompletePhenoAgeMarkers(datos)).toBe(true);
    expect(extractPhenoAgeMarkers(datos)).toEqual(HEALTHY_MARKERS);
  });
});
