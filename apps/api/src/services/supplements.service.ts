import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { supplements, clients, clientNotifications, type Supplement } from '../models/schema.js';
import type { SupplementInput } from '@latribu/shared-types';

async function unlockModule(clientId: string): Promise<void> {
  const rows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client) return;
  const permissions = (client.permissions as Record<string, boolean>) || {};
  if (permissions.supplementation === true) return;
  await db.update(clients).set({ permissions: { ...permissions, supplementation: true } }).where(eq(clients.id, clientId));
  await db.insert(clientNotifications).values({ clientId, message: 'Ahora tienes acceso a tu módulo de suplementación.' });
}

export async function listSupplements(clientId: string): Promise<Supplement[]> {
  return db.select().from(supplements).where(eq(supplements.clientId, clientId)).orderBy(asc(supplements.sortOrder));
}

export async function createSupplement(clientId: string, input: SupplementInput): Promise<Supplement | null> {
  const existing = await db
    .select()
    .from(supplements)
    .where(and(eq(supplements.clientId, clientId), eq(supplements.name, input.name)));
  if (existing.length > 0) return null;

  // `active` is optional now (no schema default) — only include it in the
  // insert when the caller actually sent it, otherwise let the `supplements`
  // table's own column default (true) apply.
  const { active, ...rest } = input;
  const values: Record<string, unknown> = { clientId, ...rest };
  if (active !== undefined) values.active = active;

  const [supplement] = await db.insert(supplements).values(values as typeof supplements.$inferInsert).returning();
  await unlockModule(clientId);
  return supplement;
}

export async function updateSupplement(clientId: string, suppId: string, input: SupplementInput): Promise<Supplement | null> {
  const fields: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.active === undefined) delete fields.active;

  const [supplement] = await db
    .update(supplements)
    .set(fields)
    .where(and(eq(supplements.id, suppId), eq(supplements.clientId, clientId)))
    .returning();
  return supplement ?? null;
}

export async function deleteSupplement(clientId: string, suppId: string): Promise<void> {
  await db.delete(supplements).where(and(eq(supplements.id, suppId), eq(supplements.clientId, clientId)));
}
