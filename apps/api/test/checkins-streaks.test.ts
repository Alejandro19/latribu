import { describe, it, expect } from 'vitest';
import { computeDailyCheckinStreak, computeWeeklyReflectionStreak } from '../src/services/checkins.service.js';

describe('computeDailyCheckinStreak', () => {
  it('returns 0 when there is no row for today, regardless of past history', () => {
    expect(computeDailyCheckinStreak(['2026-08-30', '2026-08-29'], '2026-08-31')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeDailyCheckinStreak(['2026-08-31', '2026-08-30', '2026-08-29'], '2026-08-31')).toBe(3);
  });

  it('stops at the first gap looking backward from today', () => {
    expect(computeDailyCheckinStreak(['2026-08-31', '2026-08-30', '2026-08-27'], '2026-08-31')).toBe(2);
  });

  it('is unaffected by unrelated future/duplicate dates', () => {
    expect(computeDailyCheckinStreak(['2026-08-31', '2026-08-31', '2026-09-01'], '2026-08-31')).toBe(1);
  });
});

describe('computeWeeklyReflectionStreak', () => {
  it('returns 0 when there is no reflection for the current week', () => {
    expect(computeWeeklyReflectionStreak(['2026-08-17', '2026-08-24'], '2026-08-31')).toBe(0);
  });

  it('counts consecutive weeks ending the current week', () => {
    expect(computeWeeklyReflectionStreak(['2026-08-17', '2026-08-24', '2026-08-31'], '2026-08-31')).toBe(3);
  });

  it('stops at the first missing week looking backward', () => {
    expect(computeWeeklyReflectionStreak(['2026-08-03', '2026-08-24', '2026-08-31'], '2026-08-31')).toBe(2);
  });
});
