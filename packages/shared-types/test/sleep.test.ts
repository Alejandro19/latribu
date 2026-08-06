import { describe, it, expect } from 'vitest';
import { SleepProtocolUpdateSchema, SleepLogInputSchema } from '../src/sleep.js';

describe('sleep protocol schema', () => {
  it('accepts a full protocol update', () => {
    const result = SleepProtocolUpdateSchema.safeParse({
      protocol_text: 'Apaga pantallas 1h antes de dormir.',
      sleep_window: '22:30 - 06:30',
      supplement: 'Magnesio 400mg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty patch (all fields optional)', () => {
    expect(SleepProtocolUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts null values (clearing a field)', () => {
    const result = SleepProtocolUpdateSchema.safeParse({ supplement: null });
    expect(result.success).toBe(true);
  });
});

describe('sleep log schema', () => {
  it('accepts a valid log', () => {
    const result = SleepLogInputSchema.safeParse({ hours: 7.5, quality: 4 });
    expect(result.success).toBe(true);
  });

  it('rejects missing hours', () => {
    expect(SleepLogInputSchema.safeParse({ quality: 4 }).success).toBe(false);
  });

  it('rejects missing quality', () => {
    expect(SleepLogInputSchema.safeParse({ hours: 7 }).success).toBe(false);
  });

  it('rejects a quality outside 1-5', () => {
    expect(SleepLogInputSchema.safeParse({ hours: 7, quality: 6 }).success).toBe(false);
    expect(SleepLogInputSchema.safeParse({ hours: 7, quality: 0 }).success).toBe(false);
  });

  it('rejects negative hours', () => {
    expect(SleepLogInputSchema.safeParse({ hours: -1, quality: 3 }).success).toBe(false);
  });

  it('accepts fractional hours', () => {
    expect(SleepLogInputSchema.safeParse({ hours: 6.5, quality: 3 }).success).toBe(true);
  });
});
