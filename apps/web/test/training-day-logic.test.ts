import { describe, it, expect } from 'vitest';
import { getCategoryLockState, CATEGORY_ORDER } from '../lib/training-day-logic';
import type { Exercise } from '../lib/training-client';

function exercise(id: string, category: Exercise['category']): Exercise {
  return {
    id,
    clientId: 'c1',
    title: id,
    dayNumber: 1,
    category,
    series: 3,
    reps: '10',
    duration: null,
    restTime: '01:00',
    youtubeUrl: null,
    description: null,
    recommendations: null,
    sortOrder: 0,
  };
}

describe('CATEGORY_ORDER', () => {
  it('is warmup, strength, core, cardio, stretching in that order', () => {
    expect(CATEGORY_ORDER).toEqual(['warmup', 'strength', 'core', 'cardio', 'stretching']);
  });
});

describe('getCategoryLockState', () => {
  it('returns no_asignada when the day has no exercises in that category', () => {
    expect(getCategoryLockState('cardio', [exercise('e1', 'warmup')], new Set())).toBe('no_asignada');
  });

  it('returns active for the first assigned category', () => {
    expect(getCategoryLockState('warmup', [exercise('e1', 'warmup')], new Set())).toBe('active');
  });

  it('returns locked when a prior assigned category is not fully done', () => {
    const exercises = [exercise('e1', 'warmup'), exercise('e2', 'strength')];
    expect(getCategoryLockState('strength', exercises, new Set())).toBe('locked');
  });

  it('returns active once all prior assigned categories are done', () => {
    const exercises = [exercise('e1', 'warmup'), exercise('e2', 'strength')];
    expect(getCategoryLockState('strength', exercises, new Set(['e1']))).toBe('active');
  });

  it('skips categories with zero exercises when checking prior completion', () => {
    // no warmup assigned at all — strength should be active even though warmup isn't "done"
    const exercises = [exercise('e1', 'strength')];
    expect(getCategoryLockState('strength', exercises, new Set())).toBe('active');
  });

  it('returns done when all exercises in the category are completed', () => {
    const exercises = [exercise('e1', 'warmup')];
    expect(getCategoryLockState('warmup', exercises, new Set(['e1']))).toBe('done');
  });
});
