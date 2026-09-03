import { describe, it, expect } from 'vitest';
import {
  calculateSleepQualityAvg,
  formatSleepHours,
  monthlyAverages,
  getKpiStatus,
  getWellnessTrendStatus,
} from '../lib/evolution-logic';
import type { EvolutionCheckin } from '../lib/evolution-client';

function checkin(overrides: Partial<EvolutionCheckin>): EvolutionCheckin {
  return {
    id: 'c1', clientId: 'client-1', fecha: '2026-08-01',
    strengthScore: null, moodScore: null, confidenceScore: null, securityScore: null, energyScore: null,
    notes: null, sleepHours: null, adherencePct: null, painFlag: null, painNotes: null, stressScore: null,
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateSleepQualityAvg', () => {
  it('averages sleepHours from up to the last 7 checkins that have it', () => {
    const checkins = [checkin({ sleepHours: 6 }), checkin({ sleepHours: 8 }), checkin({ sleepHours: null })];
    expect(calculateSleepQualityAvg(checkins)).toBe(7);
  });

  it('returns null when no checkin has sleepHours', () => {
    expect(calculateSleepQualityAvg([checkin({})])).toBeNull();
  });
});

describe('formatSleepHours', () => {
  it('formats fractional hours as Xh Ym', () => {
    expect(formatSleepHours(7)).toBe('7h 0m');
    expect(formatSleepHours(7.5)).toBe('7h 30m');
  });
});

describe('monthlyAverages', () => {
  it('groups by YYYY-MM and averages the value field, sorted ascending', () => {
    const records = [
      { date: '2026-06-10', quality: 4 },
      { date: '2026-06-20', quality: 6 },
      { date: '2026-07-05', quality: 8 },
    ];
    expect(monthlyAverages(records, 'date', 'quality')).toEqual([
      { month: '2026-06', avg: 5 },
      { month: '2026-07', avg: 8 },
    ]);
  });

  it('skips records where the value field is null', () => {
    const records = [{ date: '2026-06-10', quality: null }];
    expect(monthlyAverages(records, 'date', 'quality')).toEqual([]);
  });
});

describe('getKpiStatus', () => {
  it('returns neutral without a delta or without a configured objetivo', () => {
    expect(getKpiStatus(null, 'peso', { peso: 'bajar' })).toBe('neutral');
    expect(getKpiStatus(-1, 'peso', undefined)).toBe('neutral');
    expect(getKpiStatus(-1, 'peso', { peso: 'mantener' })).toBe('neutral');
  });

  it('is good when the delta direction matches the objetivo', () => {
    expect(getKpiStatus(-1, 'peso', { peso: 'bajar' })).toBe('good');
    expect(getKpiStatus(1, 'masa_muscular', { masa_muscular: 'subir' })).toBe('good');
  });

  it('is watch when the delta moves against the objetivo', () => {
    expect(getKpiStatus(1, 'peso', { peso: 'bajar' })).toBe('watch');
  });
});

describe('getWellnessTrendStatus', () => {
  it('is good for a positive delta and watch for a negative one', () => {
    expect(getWellnessTrendStatus(1)).toBe('good');
    expect(getWellnessTrendStatus(-1)).toBe('watch');
    expect(getWellnessTrendStatus(0)).toBe('neutral');
  });
});
