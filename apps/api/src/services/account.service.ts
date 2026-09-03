import type { PayableClientType } from '@latribu/shared-types';
import { db } from '../db/index.js';
import { uploadFile } from '../storage/index.js';
import * as clientsService from './clients.service.js';
import * as legalAcceptanceService from './legal-acceptance.service.js';
import * as membershipPricesService from './membership-prices.service.js';
import * as membershipPaymentsService from './membership-payments.service.js';
import { getProvider, listProviders } from './payment-providers/index.js';
import { resolveProviderForTier } from './payment-providers/tier-routing.js';
import { getCurrentTrm } from './trm.service.js';
import type { ChargeResult } from './payment-providers/index.js';
import type { LegalAcceptanceInput } from './legal-acceptance.service.js';
import type { Client } from '../models/schema.js';

export async function getLatestLegalAcceptance(clientId: string) {
  return legalAcceptanceService.findLatestAcceptanceByClientId(clientId);
}

// Cada re-aceptación (ej. tras editar el consentimiento desde el panel de
// cuenta) es una fila nueva — recordLegalAcceptance nunca actualiza ni borra.
export async function submitLegalAcceptance(clientId: string, input: LegalAcceptanceInput): Promise<void> {
  await legalAcceptanceService.recordLegalAcceptance(db, clientId, input);
}

type UploadedFile = { buffer: Buffer; mimetype: string; originalname: string };

export async function uploadAvatar(clientId: string, file: UploadedFile): Promise<Client | null> {
  const avatarUrl = await uploadFile(`clients/${clientId}/avatar`, file.buffer, file.mimetype, file.originalname);
  return clientsService.updateClient(clientId, { avatarUrl });
}

export async function updateNotificationPreferences(
  clientId: string,
  patch: Record<string, boolean>
): Promise<Client | null> {
  const existing = await clientsService.findClientById(clientId);
  const current = (existing?.notificationPreferences as Record<string, boolean>) ?? {};
  return clientsService.updateClient(clientId, { notificationPreferences: { ...current, ...patch } });
}

export async function updateLanguage(clientId: string, language: 'es' | 'en'): Promise<Client | null> {
  return clientsService.updateClient(clientId, { language });
}

export async function requestDeletion(clientId: string): Promise<Client | null> {
  return clientsService.requestAccountDeletion(clientId);
}

export type AccountExport = {
  profile: { name: string; email: string; avatarUrl: string | null };
  membership: {
    clientType: string;
    memberNumber: number | null;
    activatedAt: Date | null;
    status: string;
    plan: string;
  };
  legalAcceptances: Awaited<ReturnType<typeof legalAcceptanceService.findAllAcceptancesByClientId>>;
  exportedAt: string;
};

// Alcance mínimo acordado: perfil, membresía e historial de aceptaciones
// legales — nada de mediciones/Oura/nutrición en esta entrega.
export async function exportAccountData(clientId: string): Promise<AccountExport | null> {
  const [client, acceptances] = await Promise.all([
    clientsService.findClientById(clientId),
    legalAcceptanceService.findAllAcceptancesByClientId(clientId),
  ]);
  if (!client) return null;
  return {
    profile: { name: client.name, email: client.email, avatarUrl: client.avatarUrl },
    membership: {
      clientType: client.clientType,
      memberNumber: client.memberNumber,
      activatedAt: client.activatedAt,
      status: client.status,
      plan: client.plan,
    },
    legalAcceptances: acceptances,
    exportedAt: new Date().toISOString(),
  };
}

export class PriceNotConfiguredError extends Error {
  constructor() {
    super('Este plan todavía no tiene un precio configurado. Contacta al administrador.');
    this.name = 'PriceNotConfiguredError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super('Este medio de pago no está disponible todavía.');
    this.name = 'ProviderUnavailableError';
    this.provider = provider;
  }
  provider: string;
}

// Wompi es el proveedor activo hoy; Stripe queda detrás de la misma
// interfaz, construido pero inactivo hasta tener una llave real — ver
// payment-providers/index.ts.
export function getAvailableProviders() {
  return listProviders();
}

export type MembershipCheckout = ChargeResult & { membershipPaymentId: string };

// Arma el cobro y la fila 'pending' correspondiente. El proveedor NUNCA lo
// elige el cliente — lo resuelve resolveProviderForTier (config central,
// único lugar editable). NUNCA activa la membresía acá — eso solo lo hace
// el webhook (payment-webhook.controller.ts), sin importar de qué proveedor
// vino ni si terminó activando directo o quedando pendiente de aprobación.
export async function createMembershipCheckout(
  clientId: string,
  input: { clientType: PayableClientType; durationMonths: number; packageSize?: number }
): Promise<MembershipCheckout> {
  const price = await membershipPricesService.findPrice(input.clientType, input.durationMonths, input.packageSize);
  if (!price || price.amountCents <= 0) throw new PriceNotConfiguredError();

  const providerName = resolveProviderForTier(input.clientType);
  const provider = getProvider(providerName);
  if (!provider.isAvailable()) throw new ProviderUnavailableError(providerName);

  let amountCents = price.amountCents;
  let currency = price.currency;
  let trmAudit: { trmUsed: number; trmDate: string; marginApplied: number } | undefined;

  // Puente Elite: el monto de referencia es en USD, pero Wompi solo cobra en
  // COP — se convierte acá con la TRM oficial del día + margen, fijada en
  // este momento y nunca recalculada después (ver trm.service.ts). Cuando
  // Stripe esté disponible, resolveProviderForTier devuelve 'stripe' y este
  // bloque se salta por completo — se cobra el USD de referencia directo.
  if (input.clientType === 'mentoring' && providerName === 'wompi') {
    const trm = await getCurrentTrm();
    const margin = Number(process.env.WOMPI_ELITE_MARGIN ?? '0.03');
    const usdAmount = price.amountCents / 100;
    amountCents = Math.round(usdAmount * trm.value * (1 + margin) * 100);
    currency = 'cop';
    trmAudit = { trmUsed: trm.value, trmDate: trm.date, marginApplied: margin };
  }

  const charge = await provider.createCharge({ amountCents, currency, clientId });

  const payment = await membershipPaymentsService.createPendingPayment({
    clientId,
    clientType: input.clientType,
    durationMonths: input.durationMonths,
    packageSize: input.packageSize,
    amountCents,
    currency,
    provider: charge.provider,
    providerReference: charge.providerReference,
    ...trmAudit,
  });

  return { ...charge, membershipPaymentId: payment.id };
}

// Lo consulta el frontend mientras espera la confirmación real — nunca se
// asume éxito solo porque Stripe Elements devolvió "succeeded" del lado del
// cliente (ver PanelMembresias.tsx).
export async function getMembershipPaymentStatus(clientId: string, paymentId: string): Promise<{ status: string } | null> {
  const payment = await membershipPaymentsService.findById(paymentId);
  if (!payment || payment.clientId !== clientId) return null;
  return { status: payment.status };
}
