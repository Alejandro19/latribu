import { describe, it, expect } from 'vitest';
import {
  ExerciseInputSchema,
  ExerciseOrderPatchSchema,
  TrainingDaysPatchSchema,
  ConfirmSessionInputSchema,
} from '../src/training.js';

describe('ExerciseInputSchema', () => {
  it('accepts a valid strength exercise', () => {
    const result = ExerciseInputSchema.safeParse({
      title: 'Press banca',
      day_number: 1,
      category: 'strength',
      series: 4,
      reps: '10-12',
      rest_time: '01:30',
    });
    expect(result.success).toBe(true);
  });

  it('rejects day_number outside 1-7', () => {
    const result = ExerciseInputSchema.safeParse({ title: 'X', day_number: 8, category: 'strength' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = ExerciseInputSchema.safeParse({ title: 'X', day_number: 1, category: 'yoga' });
    expect(result.success).toBe(false);
  });
});

describe('ExerciseOrderPatchSchema', () => {
  it('accepts up and down', () => {
    expect(ExerciseOrderPatchSchema.safeParse({ direction: 'up' }).success).toBe(true);
    expect(ExerciseOrderPatchSchema.safeParse({ direction: 'down' }).success).toBe(true);
  });
  it('rejects any other value', () => {
    expect(ExerciseOrderPatchSchema.safeParse({ direction: 'sideways' }).success).toBe(false);
  });
});

describe('TrainingDaysPatchSchema', () => {
  it('accepts 1-7', () => {
    expect(TrainingDaysPatchSchema.safeParse({ training_days: 7 }).success).toBe(true);
  });
  it('rejects 0 and 8', () => {
    expect(TrainingDaysPatchSchema.safeParse({ training_days: 0 }).success).toBe(false);
    expect(TrainingDaysPatchSchema.safeParse({ training_days: 8 }).success).toBe(false);
  });
});

describe('ConfirmSessionInputSchema', () => {
  it('requires a non-empty tz', () => {
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City' }).success).toBe(true);
    expect(ConfirmSessionInputSchema.safeParse({ tz: '' }).success).toBe(false);
  });
  it('accepts an optional source of manual or nfc, defaults to nothing when omitted', () => {
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City', source: 'nfc' }).success).toBe(true);
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City', source: 'manual' }).success).toBe(true);
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City' }).success).toBe(true);
  });
  it('rejects an invalid source value', () => {
    expect(ConfirmSessionInputSchema.safeParse({ tz: 'America/Mexico_City', source: 'web' }).success).toBe(false);
  });
});
