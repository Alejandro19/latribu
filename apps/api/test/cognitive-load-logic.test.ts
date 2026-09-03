import { describe, it, expect } from 'vitest';
import {
  weightedAverageUnrounded,
  computeActivacionMatutina,
  computeScoreHrv,
  computeCargaCognitiva,
  percentile75,
  selectThresholdWindow,
  computeThreshold,
  computeConsecutiveDaysOverThreshold,
  shouldAlert,
} from '../src/services/cognitive-load-logic.js';

describe('weightedAverageUnrounded', () => {
  it('returns null with no components', () => {
    expect(weightedAverageUnrounded([])).toBeNull();
  });

  it('computes a plain weighted average without rounding', () => {
    const result = weightedAverageUnrounded([{ weight: 0.5, score: 7 }, { weight: 0.5, score: 8 }]);
    expect(result).toBeCloseTo(7.5, 5);
  });

  it('redistributes the missing weight instead of counting it as zero', () => {
    // Solo 2 de 4 componentes con peso 0.35/0.25/0.2/0.2 (total 1) — al
    // faltar los de 0.2 y 0.25, el resultado debe ser el promedio de los
    // dos restantes ponderado por su proporción relativa (0.35 y 0.2 →
    // 0.35/0.55 y 0.2/0.55), NUNCA como si los faltantes valieran 0.
    const result = weightedAverageUnrounded([{ weight: 0.35, score: 10 }, { weight: 0.2, score: 0 }]);
    expect(result).toBeCloseTo(10 * (0.35 / 0.55), 5);
  });
});

describe('computeActivacionMatutina', () => {
  it('matches the exact formula for the best possible answers', () => {
    // energía=5, tensión=1 (ninguna tensión), claridad=5
    expect(computeActivacionMatutina(5, 1, 5)).toBeCloseTo(10, 5);
  });

  it('matches the exact formula for the worst possible answers', () => {
    // energía=1, tensión=5 (mucha tensión), claridad=1
    expect(computeActivacionMatutina(1, 5, 1)).toBeCloseTo(2, 5);
  });

  it('matches a mid-range example', () => {
    // (3 + (6-3) + 3) / 3 * 2 = (3+3+3)/3*2 = 3*2 = 6
    expect(computeActivacionMatutina(3, 3, 3)).toBeCloseTo(6, 5);
  });
});

describe('computeScoreHrv', () => {
  it('returns 10 when actual HRV equals baseline', () => {
    expect(computeScoreHrv(50, 50)).toBeCloseTo(10, 5);
  });

  it('drops below 10 when actual HRV is below baseline', () => {
    // 10 - ((50-40)/50*10) = 10 - 2 = 8
    expect(computeScoreHrv(50, 40)).toBeCloseTo(8, 5);
  });

  it('clamps at 0 for a severe drop', () => {
    expect(computeScoreHrv(50, 0)).toBe(0);
  });

  it('clamps at 10 when actual HRV exceeds baseline', () => {
    expect(computeScoreHrv(50, 80)).toBe(10);
  });

  it('returns null with no baseline', () => {
    expect(computeScoreHrv(0, 40)).toBeNull();
  });
});

describe('computeCargaCognitiva', () => {
  it('returns null when no component has data', () => {
    expect(computeCargaCognitiva({ scoreHrv: null, activacionMatutina: null, recuperacionPct: null, suenoScore: null })).toBeNull();
  });

  it('computes 10 minus the weighted wellbeing average when every component is perfect', () => {
    const result = computeCargaCognitiva({ scoreHrv: 10, activacionMatutina: 10, recuperacionPct: 100, suenoScore: 100 });
    expect(result).toBeCloseTo(0, 5);
  });

  it('computes 10 when every component is at its worst', () => {
    const result = computeCargaCognitiva({ scoreHrv: 0, activacionMatutina: 0, recuperacionPct: 0, suenoScore: 0 });
    expect(result).toBeCloseTo(10, 5);
  });

  it('redistributes weight when a component is missing instead of treating it as data', () => {
    // Solo HRV (0.35) y Sueño (0.2) disponibles, ambos perfectos (10) —
    // bienestar ponderado debe seguir siendo 10 (no se diluye por los
    // componentes faltantes), así que Carga_Cognitiva = 0.
    const result = computeCargaCognitiva({ scoreHrv: 10, activacionMatutina: null, recuperacionPct: null, suenoScore: 100 });
    expect(result).toBeCloseTo(0, 5);
  });
});

describe('percentile75', () => {
  it('returns null for an empty array', () => {
    expect(percentile75([])).toBeNull();
  });

  it('picks the nearest-rank 75th percentile of a sorted set', () => {
    // 8 valores 1..8 → ceil(0.75*8)-1 = 5 (índice 0-based) → valor 6
    expect(percentile75([1, 2, 3, 4, 5, 6, 7, 8])).toBe(6);
  });

  it('does not require the input to be pre-sorted', () => {
    expect(percentile75([8, 1, 4, 2, 7, 3, 6, 5])).toBe(6);
  });
});

describe('selectThresholdWindow', () => {
  const days = (n: number, score: number) =>
    Array.from({ length: n }, (_, i) => ({ fecha: `2026-01-${String(i + 1).padStart(2, '0')}`, score }));

  it('uses the full history when shorter than the long window', () => {
    const history = days(20, 5);
    expect(selectThresholdWindow(history, 60)).toHaveLength(20);
  });

  it('caps at the long window, keeping the most recent days', () => {
    const history = [
      ...Array.from({ length: 70 }, (_, i) => ({ fecha: `2026-${i < 31 ? '01' : '02'}-${String((i % 31) + 1).padStart(2, '0')}`, score: i })),
    ];
    const windowed = selectThresholdWindow(history, 60);
    expect(windowed).toHaveLength(60);
    // Los primeros 10 días (los más viejos) deben quedar fuera de la ventana.
    expect(windowed.some((d) => d.score < 10)).toBe(false);
  });
});

describe('computeThreshold', () => {
  it('returns null with fewer than the minimum history days', () => {
    const history = Array.from({ length: 13 }, (_, i) => ({ fecha: `2026-01-${String(i + 1).padStart(2, '0')}`, score: 5 }));
    expect(computeThreshold(history, 14)).toBeNull();
  });

  it('computes the percentile once the minimum is met', () => {
    const history = Array.from({ length: 14 }, (_, i) => ({ fecha: `2026-01-${String(i + 1).padStart(2, '0')}`, score: i + 1 }));
    expect(computeThreshold(history, 14)).toBe(percentile75(history.map((h) => h.score)));
  });
});

describe('computeConsecutiveDaysOverThreshold', () => {
  it('counts consecutive days strictly above the threshold from the most recent day back', () => {
    const history = [
      { fecha: '2026-01-01', score: 5 },
      { fecha: '2026-01-02', score: 9 },
      { fecha: '2026-01-03', score: 9 },
      { fecha: '2026-01-04', score: 9 },
    ];
    expect(computeConsecutiveDaysOverThreshold(history, 7)).toBe(3);
  });

  it('resets to 0 when the most recent day is at or below the threshold', () => {
    const history = [
      { fecha: '2026-01-01', score: 9 },
      { fecha: '2026-01-02', score: 9 },
      { fecha: '2026-01-03', score: 7 }, // igual al umbral, no cuenta como "por encima"
    ];
    expect(computeConsecutiveDaysOverThreshold(history, 7)).toBe(0);
  });

  it('counts through a calendar gap with no score that day (no wearable sync ≠ "day at or below threshold")', () => {
    const history = [
      { fecha: '2026-01-01', score: 9 },
      { fecha: '2026-01-03', score: 9 }, // 01-02 no tiene fila (sin dato ese día)
    ];
    // La función opera sobre los días CON score disponibles, no sobre el
    // calendario — un día sin dato no es evidencia de "por debajo del
    // umbral", así que no corta la racha (decisión documentada en el código).
    expect(computeConsecutiveDaysOverThreshold(history, 7)).toBe(2);
  });
});

describe('shouldAlert', () => {
  it('is false below the alert threshold', () => {
    expect(shouldAlert(2)).toBe(false);
  });

  it('is true at exactly 3 consecutive days', () => {
    expect(shouldAlert(3)).toBe(true);
  });

  it('is true above 3 consecutive days', () => {
    expect(shouldAlert(5)).toBe(true);
  });
});
