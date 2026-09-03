import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { membershipPrices, type MembershipPrice } from '../models/schema.js';

export async function listPrices(): Promise<MembershipPrice[]> {
  return db.select().from(membershipPrices);
}

// packageSize solo aplica a coaching_1_1 (Presencial) — para el resto de
// los tiers, la fila tiene packageSize NULL, así que se busca con isNull()
// en vez de eq() (SQL "= NULL" nunca matchea).
export async function findPrice(clientType: string, durationMonths: number, packageSize?: number): Promise<MembershipPrice | null> {
  const rows = await db
    .select()
    .from(membershipPrices)
    .where(
      and(
        eq(membershipPrices.clientType, clientType),
        eq(membershipPrices.durationMonths, durationMonths),
        packageSize != null ? eq(membershipPrices.packageSize, packageSize) : isNull(membershipPrices.packageSize)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function updatePrice(id: string, amountCents: number): Promise<MembershipPrice | null> {
  const [price] = await db
    .update(membershipPrices)
    .set({ amountCents, updatedAt: new Date() })
    .where(eq(membershipPrices.id, id))
    .returning();
  return price ?? null;
}
