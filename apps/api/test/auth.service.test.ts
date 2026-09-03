import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  isPlanExpired,
} from '../src/services/auth.service.js';

describe('auth.service', () => {
  it('hashes and verifies a password round-trip', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('signs and verifies a token round-trip', () => {
    const token = signToken({ id: 'abc', role: 'admin', name: 'Ana', email: 'a@a.com' });
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ id: 'abc', role: 'admin', name: 'Ana', email: 'a@a.com' });
  });

  it('throws on an invalid token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });

  it('isPlanExpired returns false for a null client', () => {
    expect(isPlanExpired(null)).toBe(false);
  });

  it('isPlanExpired returns false for a client type outside ACTIVE_PLAN_TYPES', () => {
    expect(isPlanExpired({ clientType: 'sin_clasificar', planEndDate: '2000-01-01' })).toBe(false);
  });

  it('isPlanExpired returns false when plan_end_date is null', () => {
    expect(isPlanExpired({ clientType: 'coaching_1_1', planEndDate: null })).toBe(false);
  });

  it('isPlanExpired returns true for a coaching client past their end date', () => {
    expect(isPlanExpired({ clientType: 'coaching_1_1', planEndDate: '2000-01-01' })).toBe(true);
  });

  it('isPlanExpired returns false for a coaching client before their end date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isPlanExpired({ clientType: 'mentoring', planEndDate: future.toISOString().slice(0, 10) })).toBe(false);
  });
});
