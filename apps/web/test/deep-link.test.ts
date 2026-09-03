import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { captureIncomingDeepLink, getPendingAction, clearPendingAction, isTrainingConfirmAction } from '../lib/deep-link';

describe('deep-link', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures m and a query params into localStorage', () => {
    captureIncomingDeepLink('?m=entrenamiento&a=confirmar');
    expect(getPendingAction()).toEqual({ m: 'entrenamiento', a: 'confirmar' });
  });

  it('does nothing when m or a is missing', () => {
    captureIncomingDeepLink('?m=entrenamiento');
    expect(getPendingAction()).toBeNull();
  });

  it('clearPendingAction removes the stored action', () => {
    captureIncomingDeepLink('?m=entrenamiento&a=confirmar');
    clearPendingAction();
    expect(getPendingAction()).toBeNull();
  });

  it('isTrainingConfirmAction recognizes the entrenamiento:confirmar action only', () => {
    expect(isTrainingConfirmAction({ m: 'entrenamiento', a: 'confirmar' })).toBe(true);
    expect(isTrainingConfirmAction({ m: 'otro', a: 'confirmar' })).toBe(false);
    expect(isTrainingConfirmAction(null)).toBe(false);
  });

  it('expires a pending action past the 1-hour TTL and clears it from localStorage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00Z'));
    captureIncomingDeepLink('?m=entrenamiento&a=confirmar');

    vi.setSystemTime(new Date('2026-07-30T13:00:01Z'));
    expect(getPendingAction()).toBeNull();
    expect(window.localStorage.getItem('lt_pending_action')).toBeNull();
  });

  it('still returns a pending action captured just under the 1-hour TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T12:00:00Z'));
    captureIncomingDeepLink('?m=entrenamiento&a=confirmar');

    vi.setSystemTime(new Date('2026-07-30T12:59:59Z'));
    expect(getPendingAction()).toEqual({ m: 'entrenamiento', a: 'confirmar' });
  });
});
