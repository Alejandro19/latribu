import { describe, it, expect } from 'vitest';
import {
  ClientCreateInputSchema,
  PermissionsPatchSchema,
  StatusPatchSchema,
  ClientTypePatchSchema,
  RenewPlanPatchSchema,
} from '../src/client.js';

describe('client schemas', () => {
  it('accepts a valid client creation input', () => {
    const result = ClientCreateInputSchema.safeParse({ name: 'Ana', email: 'a@a.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects a client creation input with an invalid email', () => {
    const result = ClientCreateInputSchema.safeParse({ name: 'Ana', email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid permissions patch', () => {
    const result = PermissionsPatchSchema.safeParse({ permissions: { training: true, nutrition: false } });
    expect(result.success).toBe(true);
  });

  it('accepts a valid status patch', () => {
    const result = StatusPatchSchema.safeParse({ status: 'inactive' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status patch', () => {
    const result = StatusPatchSchema.safeParse({ status: 'banned' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid client-type patch', () => {
    const result = ClientTypePatchSchema.safeParse({ client_type: 'mentoring' });
    expect(result.success).toBe(true);
  });

  it('rejects a client-type patch with a retired type', () => {
    const result = ClientTypePatchSchema.safeParse({ client_type: 'lead_wellness' });
    expect(result.success).toBe(false);
  });

  it('rejects a renew-plan patch with an invalid duration', () => {
    const result = RenewPlanPatchSchema.safeParse({ duration_days: 45 });
    expect(result.success).toBe(false);
  });

  it('accepts a renew-plan patch with explicit dates', () => {
    const result = RenewPlanPatchSchema.safeParse({ plan_start_date: '2026-01-01', plan_end_date: '2026-02-01' });
    expect(result.success).toBe(true);
  });

  it('rejects a renew-plan patch with malformed explicit dates', () => {
    const result = RenewPlanPatchSchema.safeParse({ plan_start_date: 'abc', plan_end_date: 'xyz' });
    expect(result.success).toBe(false);
  });

  it('accepts a renew-plan patch with duration_days as a string', () => {
    const result = RenewPlanPatchSchema.safeParse({ duration_days: '30' });
    expect(result.success).toBe(true);
  });
});
