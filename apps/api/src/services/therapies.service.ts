import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communityTherapies, therapyReservations, type CommunityTherapy, type TherapyReservation } from '../models/schema.js';
import type { CommunityTherapyInput } from '@latribu/shared-types';

function toTherapyInsert(input: CommunityTherapyInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    discountPct: input.discount_pct ?? 0,
    provider: input.provider ?? null,
    imageUrl: input.image_url ?? null,
    active: input.active ?? true,
    sortOrder: input.sort_order ?? 0,
  };
}

function toTherapyUpdate(input: Partial<CommunityTherapyInput>) {
  return {
    title: input.title,
    description: input.description,
    discountPct: input.discount_pct,
    provider: input.provider,
    imageUrl: input.image_url,
    active: input.active,
    sortOrder: input.sort_order,
  };
}

export async function listActiveTherapiesWithCounts(): Promise<Array<CommunityTherapy & { confirmedCount: number }>> {
  const therapies = await db.select().from(communityTherapies).where(eq(communityTherapies.active, true)).orderBy(asc(communityTherapies.sortOrder));
  if (therapies.length === 0) return [];
  const confirmed = await db.select().from(therapyReservations).where(eq(therapyReservations.status, 'confirmada'));
  const countByTherapy = new Map<string, number>();
  for (const r of confirmed) countByTherapy.set(r.therapyId, (countByTherapy.get(r.therapyId) ?? 0) + 1);
  return therapies.map((t) => ({ ...t, confirmedCount: countByTherapy.get(t.id) ?? 0 }));
}

export async function createTherapy(input: CommunityTherapyInput): Promise<CommunityTherapy> {
  const [therapy] = await db.insert(communityTherapies).values(toTherapyInsert(input)).returning();
  return therapy;
}

export async function updateTherapy(therapyId: string, input: Partial<CommunityTherapyInput>): Promise<CommunityTherapy | null> {
  const [therapy] = await db.update(communityTherapies).set(toTherapyUpdate(input)).where(eq(communityTherapies.id, therapyId)).returning();
  return therapy ?? null;
}

export async function deleteTherapy(therapyId: string): Promise<void> {
  await db.delete(communityTherapies).where(eq(communityTherapies.id, therapyId));
}

export async function setTherapyImage(therapyId: string, imageUrl: string): Promise<CommunityTherapy | null> {
  const [therapy] = await db.update(communityTherapies).set({ imageUrl }).where(eq(communityTherapies.id, therapyId)).returning();
  return therapy ?? null;
}

export async function reserveTherapy(therapyId: string, clientId: string): Promise<{ reservation: TherapyReservation | null; conflict: boolean }> {
  const existing = await db
    .select()
    .from(therapyReservations)
    .where(and(eq(therapyReservations.therapyId, therapyId), eq(therapyReservations.clientId, clientId)));
  if (existing[0]?.status === 'confirmada') return { reservation: null, conflict: true };

  if (existing[0]) {
    const [reservation] = await db
      .update(therapyReservations)
      .set({ status: 'confirmada' })
      .where(eq(therapyReservations.id, existing[0].id))
      .returning();
    return { reservation, conflict: false };
  }
  const [reservation] = await db.insert(therapyReservations).values({ therapyId, clientId }).returning();
  return { reservation, conflict: false };
}

export async function cancelTherapyReservation(therapyId: string, clientId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(therapyReservations)
    .where(and(eq(therapyReservations.therapyId, therapyId), eq(therapyReservations.clientId, clientId), eq(therapyReservations.status, 'confirmada')));
  if (!existing[0]) return false;
  await db.update(therapyReservations).set({ status: 'cancelada' }).where(eq(therapyReservations.id, existing[0].id));
  return true;
}

export async function listClientTherapyReservations(clientId: string): Promise<TherapyReservation[]> {
  return db.select().from(therapyReservations).where(eq(therapyReservations.clientId, clientId));
}