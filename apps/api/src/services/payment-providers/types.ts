// Interfaz común de "proveedor de pagos" — Wompi es el proveedor activo hoy;
// Stripe queda detrás de la misma interfaz, construido pero inactivo hasta
// tener una llave real (ver payment-providers/index.ts).
//
// Deliberadamente NO se fuerza la misma forma de resultado entre proveedores
// (ChargeResult es una unión discriminada): cada proveedor tiene su propio
// modelo de checkout (Wompi: referencia + firma para su Widget; Stripe:
// client_secret para Stripe Elements) y el frontend ya sabe, por el campo
// `provider`, cómo renderizar cada uno.

export type SupportedProvider = 'wompi' | 'stripe';

export type CreateChargeInput = {
  amountCents: number;
  currency: string;
  clientId: string;
};

export type ChargeResult =
  | {
      provider: 'wompi';
      providerReference: string;
      publicKey: string;
      amountInCents: number;
      currency: string;
      integritySignature: string;
    }
  | {
      provider: 'stripe';
      providerReference: string;
      clientSecret: string;
    };

// `actionable: false` = firma válida pero no es un evento que nos interese
// (ej. un tipo de evento de Wompi que no es transaction.updated, o un tipo
// de evento de Stripe que no es payment_intent.succeeded) — se responde 200
// sin hacer nada, para que el proveedor no reintente. `valid: false` = la
// firma/checksum no pasó la verificación, se responde 400.
export type WebhookVerificationResult =
  | { valid: false }
  | { valid: true; actionable: false }
  | { valid: true; actionable: true; approved: boolean; providerReference: string };

export interface PaymentProvider {
  readonly name: SupportedProvider;
  // Nunca revienta — si faltan env vars, devuelve false para que el
  // checkout responda un 503 claro en vez de un error 500 genérico.
  isAvailable(): boolean;
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookVerificationResult;
}
