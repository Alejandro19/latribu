import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { membershipPayments, type MembershipPayment } from '../models/schema.js';
import type { SupportedProvider } from './payment-providers/types.js';

export type CreatePendingPaymentInput = {
  clientId: string;
  clientType: string;
  durationMonths: number;
  packageSize?: number;
  amountCents: number;
  currency: string;
  provider: SupportedProvider;
  providerReference: string;
  trmUsed?: number;
  trmDate?: string;
  marginApplied?: number;
};

export async function createPendingPayment(input: CreatePendingPaymentInput): Promise<MembershipPayment> {
  const [payment] = await db
    .insert(membershipPayments)
    .values({
      clientId: input.clientId,
      clientType: input.clientType,
      durationMonths: input.durationMonths,
      packageSize: input.packageSize ?? null,
      amountCents: input.amountCents,
      currency: input.currency,
      provider: input.provider,
      providerReference: input.providerReference,
      status: 'pending',
      trmUsed: input.trmUsed != null ? String(input.trmUsed) : null,
      trmDate: input.trmDate ?? null,
      marginApplied: input.marginApplied != null ? String(input.marginApplied) : null,
    })
    .returning();
  return payment;
}

export async function findById(id: string): Promise<MembershipPayment | null> {
  const rows = await db.select().from(membershipPayments).where(eq(membershipPayments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findByProviderReference(provider: SupportedProvider, providerReference: string): Promise<MembershipPayment | null> {
  const rows = await db
    .select()
    .from(membershipPayments)
    .where(and(eq(membershipPayments.provider, provider), eq(membershipPayments.providerReference, providerReference)))
    .limit(1);
  return rows[0] ?? null;
}

// Historial de pagos del cliente — usado por la vista admin de auditoría.
export async function findAllByClientId(clientId: string): Promise<MembershipPayment[]> {
  return db.select().from(membershipPayments).where(eq(membershipPayments.clientId, clientId)).orderBy(desc(membershipPayments.createdAt));
}

export async function markSucceeded(id: string): Promise<MembershipPayment | null> {
  const [payment] = await db
    .update(membershipPayments)
    .set({ status: 'succeeded', succeededAt: new Date() })
    .where(eq(membershipPayments.id, id))
    .returning();
  return payment ?? null;
}

// Activación inmediata (cliente ya activo en un tier pagable) — el webhook
// hizo succeeded + applied de una.
export async function markApplied(id: string): Promise<MembershipPayment | null> {
  const [payment] = await db.update(membershipPayments).set({ appliedAt: new Date() }).where(eq(membershipPayments.id, id)).returning();
  return payment ?? null;
}

// Pago confirmado por el proveedor pero de un cliente sin membresía paga
// previa — queda pendiente de que un admin lo apruebe (ver
// POST /api/clients/:id/membership-payments/:paymentId/approve).
export async function markRequiresApproval(id: string): Promise<MembershipPayment | null> {
  const [payment] = await db.update(membershipPayments).set({ requiresApproval: true }).where(eq(membershipPayments.id, id)).returning();
  return payment ?? null;
}
