import type Stripe from 'stripe';
import { stripeClient, requireStripeWebhookSecret } from '../stripe.service.js';
import type { ChargeResult, CreateChargeInput, PaymentProvider, WebhookVerificationResult } from './types.js';

// Envoltorio fino sobre stripe.service.ts — la lógica es la misma que ya
// vivía en account.service.ts (createCharge) y stripe-webhook.controller.ts
// (verifyWebhook), solo movida detrás de la interfaz común. Inactivo hasta
// que exista STRIPE_SECRET_KEY real (isAvailable() lo refleja).
export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  isAvailable(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const paymentIntent = await stripeClient().paymentIntents.create({
      amount: input.amountCents,
      currency: input.currency,
      automatic_payment_methods: { enabled: true },
      metadata: { clientId: input.clientId },
    });
    if (!paymentIntent.client_secret) throw new Error('Stripe no devolvió un client_secret.');
    return { provider: 'stripe', providerReference: paymentIntent.id, clientSecret: paymentIntent.client_secret };
  },

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookVerificationResult {
    const signature = headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') return { valid: false };

    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(rawBody, signature, requireStripeWebhookSecret());
    } catch {
      return { valid: false };
    }

    if (event.type !== 'payment_intent.succeeded') return { valid: true, actionable: false };
    const intent = event.data.object as Stripe.PaymentIntent;
    return { valid: true, actionable: true, approved: true, providerReference: intent.id };
  },
};
