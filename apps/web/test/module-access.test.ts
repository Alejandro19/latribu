import { describe, it, expect } from 'vitest';
import { getModuleAccessState } from '../lib/module-access';

describe('getModuleAccessState', () => {
  it('returns "ok" for a module not present in moduleAccess at all (not gated)', () => {
    expect(getModuleAccessState('personal-info', { moduleAccess: {}, planExpired: true })).toBe('ok');
  });

  it('returns "not_included" for a gated module the matrix disallows, regardless of expiry', () => {
    expect(getModuleAccessState('training', { moduleAccess: { training: false }, planExpired: false })).toBe('not_included');
    expect(getModuleAccessState('training', { moduleAccess: { training: false }, planExpired: true })).toBe('not_included');
  });

  it('returns "expired" for a gated module the matrix allows, but the plan is expired', () => {
    expect(getModuleAccessState('training', { moduleAccess: { training: true }, planExpired: true })).toBe('expired');
  });

  it('returns "ok" for a gated module the matrix allows, with an active plan', () => {
    expect(getModuleAccessState('training', { moduleAccess: { training: true }, planExpired: false })).toBe('ok');
  });
});
