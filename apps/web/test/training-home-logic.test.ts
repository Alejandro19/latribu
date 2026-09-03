import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getWeekStart, isDayCompletedThisWeek, isDayUnlocked, calculateDisciplineStats } from '../lib/training-home-logic';
import type { TrainingCompletion } from '../lib/training-client';

function completion(dayNumber: number, completedDate: string): TrainingCompletion {
  return { id: `c-${dayNumber}-${completedDate}`, clientId: 'c1', dayNumber, completedDate, source: 'manual' };
}

describe('getWeekStart', () => {
  it('returns the Monday of the week for a Wednesday', () => {
    expect(getWeekStart(new Date('2026-07-29T12:00:00'))).toBe('2026-07-27');
  });
  it('returns the same date for a Monday', () => {
    expect(getWeekStart(new Date('2026-07-27T12:00:00'))).toBe('2026-07-27');
  });
  it('rolls back to the prior Monday for a Sunday', () => {
    expect(getWeekStart(new Date('2026-08-02T12:00:00'))).toBe('2026-07-27');
  });
});

describe('isDayCompletedThisWeek / isDayUnlocked', () => {
  // isDayCompletedThisWeek/isDayUnlocked calculan "esta semana" contra
  // new Date() real (sin parámetro inyectable) — se fija el reloj a un punto
  // conocido dentro de la semana del 27 jul-2 ago para que este test no se
  // vuelva flaky con el paso del tiempo real.
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  const weekStart = getWeekStart(new Date('2026-07-29T12:00:00'));
  const completions = [completion(1, weekStart)];

  it('day 1 is always unlocked', () => {
    expect(isDayUnlocked(1, [])).toBe(true);
  });

  it('day 2 is unlocked once day 1 is completed this week', () => {
    expect(isDayUnlocked(2, completions)).toBe(true);
  });

  it('day 2 is locked if day 1 has not been completed this week', () => {
    expect(isDayUnlocked(2, [])).toBe(false);
  });

  it('isDayCompletedThisWeek reflects completions within this week only', () => {
    expect(isDayCompletedThisWeek(1, completions)).toBe(true);
    expect(isDayCompletedThisWeek(1, [completion(1, '2020-01-01')])).toBe(false);
  });
});

describe('calculateDisciplineStats', () => {
  it('computes doneDays/expected/pct against 4x trainingDays for the current month', () => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const completions = [completion(1, `${monthPrefix}05`), completion(2, `${monthPrefix}06`)];
    const stats = calculateDisciplineStats(completions, 3);
    expect(stats.doneDays).toBe(2);
    expect(stats.expected).toBe(12);
    expect(stats.pct).toBe(17);
  });

  it('returns 0 pct when trainingDays is 0', () => {
    expect(calculateDisciplineStats([], 0)).toEqual({ doneDays: 0, expected: 0, pct: 0 });
  });
});
