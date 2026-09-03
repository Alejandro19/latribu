import { wompiProvider } from './wompi.provider.js';
import { stripeProvider } from './stripe.provider.js';
import type { PaymentProvider, SupportedProvider } from './types.js';

export type { PaymentProvider, SupportedProvider, ChargeResult, CreateChargeInput, WebhookVerificationResult } from './types.js';

const providers: Record<SupportedProvider, PaymentProvider> = {
  wompi: wompiProvider,
  stripe: stripeProvider,
};

export function getProvider(name: SupportedProvider): PaymentProvider {
  return providers[name];
}

export function listProviders(): { name: SupportedProvider; available: boolean }[] {
  return Object.values(providers).map((provider) => ({ name: provider.name, available: provider.isAvailable() }));
}
