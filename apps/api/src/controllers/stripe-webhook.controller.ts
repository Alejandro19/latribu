import { createWebhookHandler } from './payment-webhook.controller.js';

// La verificación de firma y la lógica de activación viven en
// payment-providers/stripe.provider.ts + payment-webhook.controller.ts
// (compartidas con Wompi) — este archivo solo fija qué proveedor es.
export const handleStripeWebhook = createWebhookHandler('stripe');
