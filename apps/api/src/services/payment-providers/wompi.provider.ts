import { createHash, randomUUID } from 'node:crypto';
import type { ChargeResult, CreateChargeInput, PaymentProvider, WebhookVerificationResult } from './types.js';

// Formato verificado contra docs.wompi.co (Widget/Web Checkout + Eventos) —
// no inventado. Sin dependencia npm: solo node:crypto, porque el flujo de
// Widget no requiere ninguna llamada server-to-server a la API de Wompi para
// armar el cobro (a diferencia de Stripe, que sí crea un PaymentIntent real).

function requirePublicKey(): string {
  const key = process.env.WOMPI_PUBLIC_KEY;
  if (!key) throw new Error('WOMPI_PUBLIC_KEY no está configurada.');
  return key;
}

function requireIntegritySecret(): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) throw new Error('WOMPI_INTEGRITY_SECRET no está configurada.');
  return secret;
}

function requireEventsSecret(): string {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) throw new Error('WOMPI_EVENTS_SECRET no está configurada.');
  return secret;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

type WompiEventPayload = {
  event?: string;
  data?: unknown;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
};

export const wompiProvider: PaymentProvider = {
  name: 'wompi',

  isAvailable(): boolean {
    return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET);
  },

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    // La referencia la generamos nosotros (Wompi no expone un endpoint de
    // "crear cobro" para el flujo de Widget) — se guarda como
    // providerReference y es lo que el webhook usa para encontrar esta fila.
    const reference = randomUUID();
    // Wompi exige el código de moneda en mayúscula (COP, USD, GTQ) tanto en
    // la firma de integridad como en el widget — el resto del sistema usa
    // minúscula como convención interna (igual que Stripe), así que se
    // normaliza acá, en el borde con Wompi.
    const currency = input.currency.toUpperCase();
    const raw = `${reference}${input.amountCents}${currency}${requireIntegritySecret()}`;
    const integritySignature = createHash('sha256').update(raw).digest('hex');
    return {
      provider: 'wompi',
      providerReference: reference,
      publicKey: requirePublicKey(),
      amountInCents: input.amountCents,
      currency,
      integritySignature,
    };
  },

  verifyWebhook(rawBody: Buffer): WebhookVerificationResult {
    let payload: WompiEventPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      return { valid: false };
    }
    const properties = payload.signature?.properties;
    const checksum = payload.signature?.checksum;
    if (!properties || !checksum || payload.timestamp == null) return { valid: false };

    let eventsSecret: string;
    try {
      eventsSecret = requireEventsSecret();
    } catch {
      return { valid: false };
    }

    const concatenated =
      properties.map((path) => String(getByPath(payload.data, path))).join('') + String(payload.timestamp) + eventsSecret;
    const computed = createHash('sha256').update(concatenated).digest('hex');
    if (computed.toLowerCase() !== checksum.toLowerCase()) return { valid: false };

    if (payload.event !== 'transaction.updated') return { valid: true, actionable: false };

    const transaction = (payload.data as { transaction?: { status?: string; reference?: string } } | undefined)?.transaction;
    if (!transaction?.reference) return { valid: true, actionable: false };

    return {
      valid: true,
      actionable: true,
      approved: transaction.status === 'APPROVED',
      providerReference: transaction.reference,
    };
  },
};
