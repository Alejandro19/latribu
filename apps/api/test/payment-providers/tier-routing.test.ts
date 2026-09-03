import { describe, it, expect, afterEach } from 'vitest';
import { resolveProviderForTier } from '../../src/services/payment-providers/tier-routing.js';

describe('resolveProviderForTier', () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeKey;
  });

  it('Presencial (coaching_1_1) siempre resuelve a wompi, sin importar si Stripe está disponible', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_whatever';
    expect(resolveProviderForTier('coaching_1_1')).toBe('wompi');
  });

  it('Elite (mentoring) resuelve a wompi (puente TRM) cuando Stripe no está configurado', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(resolveProviderForTier('mentoring')).toBe('wompi');
  });

  it('Elite (mentoring) se apaga solo hacia stripe en cuanto existe STRIPE_SECRET_KEY', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_whatever';
    expect(resolveProviderForTier('mentoring')).toBe('stripe');
  });
});
