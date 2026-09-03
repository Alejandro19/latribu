import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { admins, type Admin } from '../models/schema.js';

export async function findAdminByEmail(email: string): Promise<Admin | null> {
  const rows = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findAdminById(id: string): Promise<Admin | null> {
  const rows = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateAdminPassword(id: string, passwordHash: string): Promise<void> {
  await db.update(admins).set({ passwordHash }).where(eq(admins.id, id));
}

export async function updateAdminGoogleId(id: string, googleId: string): Promise<void> {
  await db.update(admins).set({ googleId }).where(eq(admins.id, id));
}

export async function updateAdminAppleId(id: string, appleId: string): Promise<void> {
  await db.update(admins).set({ appleId }).where(eq(admins.id, id));
}
