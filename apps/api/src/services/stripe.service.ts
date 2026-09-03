import Stripe from 'stripe';

let client: Stripe | null = null;

// Mismo patrón defensivo que requireSupabaseUrl/requireSupabaseServiceRoleKey
// en storage/index.ts — falla claro y explícito si falta la env var, en vez
// de un error críptico de Stripe más adelante.
function requireStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY no está configurada. Es necesaria para cobrar con Stripe.');
  }
  return key;
}

// Lazy: el cliente se construye en el primer uso real, no al importar el
// módulo — así los tests que no tocan Stripe (o que mockean stripeClient())
// nunca requieren la env var.
export function stripeClient(): Stripe {
  if (!client) {
    client = new Stripe(requireStripeSecretKey());
  }
  return client;
}

export function requireStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET no está configurada. Es necesaria para verificar el webhook de Stripe.');
  }
  return secret;
}

// Únicamente para tests — evita instanciar el SDK real de Stripe (que
// exigiría STRIPE_SECRET_KEY) al probar el resto del flujo.
export function setStripeClientForTests(fake: Stripe | null): void {
  client = fake;
}
