import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communityRetreats, retreatReservations, type CommunityRetreat, type RetreatReservation } from '../models/schema.js';
import { CommunityRetreatInput } from '@latribu/shared-types';

export async function listActiveRetreatsWithCounts(): Promise<Array<CommunityRetreat & { confirmedCount: number }>> {
  const retreats = await db.select().from(communityRetreats).where(eq(communityRetreats.active, true)).orderBy(asc(communityRetreats.startDate));
  if (retreats.length === 0) return [];
  const confirmed = await db.select().from(retreatReservations).where(eq(retreatReservations.status, 'confirmada'));
  const countByRetreat = new Map<string, number>();
  for (const r of confirmed) countByRetreat.set(r.retreatId, (countByRetreat.get(r.retreatId) ?? 0) + 1);
  return retreats.map((r) => ({ ...r, confirmedCount: countByRetreat.get(r.id) ?? 0 }));
}

export async function createRetreat(input: CommunityRetreatInput): Promise<CommunityRetreat> {
  const [retreat] = await db.insert(communityRetreats).values({
    title: input.title,
    description: input.description ?? null,
    startDate: input.start_date ? new Date(input.start_date) : null,
    endDate: input.end_date ? new Date(input.end_date) : null,
    location: input.location ?? null,
    capacity: input.capacity ?? null,
    priceCents: input.price_cents ?? null,
    imageUrl: input.image_url ?? null,
    active: input.active ?? true,
    sortOrder: input.sort_order ?? 0,
  }).returning();
  return retreat;
}

export async function updateRetreat(retreatId: string, input: Partial<CommunityRetreatInput>): Promise<CommunityRetreat | null> {
  const [retreat] = await db.update(communityRetreats).set({
    title: input.title ?? undefined,
    description: input.description ?? undefined,
    // Mismo criterio que updateEvent(): ausente = no tocar, string vacío =
    // borrar a NULL, string con valor = actualizar. Antes cualquier update
    // parcial que no repitiera las fechas (ej. "Desactivar") las borraba.
    startDate: input.start_date !== undefined ? (input.start_date ? new Date(input.start_date) : null) : undefined,
    endDate: input.end_date !== undefined ? (input.end_date ? new Date(input.end_date) : null) : undefined,
    location: input.location ?? undefined,
    capacity: input.capacity ?? undefined,
    priceCents: input.price_cents ?? undefined,
    imageUrl: input.image_url ?? undefined,
    active: input.active ?? undefined,
    sortOrder: input.sort_order ?? undefined,
  }).where(eq(communityRetreats.id, retreatId)).returning();
  return retreat ?? null;
}

export async function deleteRetreat(retreatId: string): Promise<void> {
  await db.delete(communityRetreats).where(eq(communityRetreats.id, retreatId));
}

// Update dedicado a solo `imageUrl` — updateRetreat() de arriba pisa
// startDate/endDate a NULL en cualquier update parcial que no las repita
// (ternario sin rama `undefined`), así que no sirve para un patch de un
// solo campo.
export async function setRetreatImage(retreatId: string, imageUrl: string): Promise<CommunityRetreat | null> {
  const [retreat] = await db.update(communityRetreats).set({ imageUrl }).where(eq(communityRetreats.id, retreatId)).returning();
  return retreat ?? null;
}

export async function reserveRetreat(retreatId: string, clientId: string): Promise<{ reservation: RetreatReservation | null; conflict: boolean }> {
  const existing = await db
    .select()
    .from(retreatReservations)
    .where(and(eq(retreatReservations.retreatId, retreatId), eq(retreatReservations.clientId, clientId)));
  if (existing[0]?.status === 'confirmada') return { reservation: null, conflict: true };

  if (existing[0]) {
    const [reservation] = await db
      .update(retreatReservations)
      .set({ status: 'confirmada' })
      .where(eq(retreatReservations.id, existing[0].id))
      .returning();
    return { reservation, conflict: false };
  }
  const [reservation] = await db.insert(retreatReservations).values({ retreatId, clientId }).returning();
  return { reservation, conflict: false };
}

export async function cancelRetreatReservation(retreatId: string, clientId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(retreatReservations)
    .where(and(eq(retreatReservations.retreatId, retreatId), eq(retreatReservations.clientId, clientId), eq(retreatReservations.status, 'confirmada')));
  if (!existing[0]) return false;
  await db.update(retreatReservations).set({ status: 'cancelada' }).where(eq(retreatReservations.id, existing[0].id));
  return true;
}

export async function listClientRetreatReservations(clientId: string): Promise<RetreatReservation[]> {
  return db.select().from(retreatReservations).where(eq(retreatReservations.clientId, clientId));
}
