import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { therapists, type Therapist } from '../models/schema.js';
import { hashPassword } from './auth.service.js';

export async function findTherapistByEmail(email: string): Promise<Therapist | null> {
  const rows = await db.select().from(therapists).where(eq(therapists.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findTherapistById(id: string): Promise<Therapist | null> {
  const rows = await db.select().from(therapists).where(eq(therapists.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listTherapists(): Promise<Therapist[]> {
  return db.select().from(therapists).orderBy(desc(therapists.createdAt));
}

export async function countActiveTherapists(): Promise<number> {
  const rows = await db.select().from(therapists).where(eq(therapists.active, true));
  return rows.length;
}

export async function createTherapist(input: { name: string; email: string; password: string; specialty?: string | null; phone?: string | null }): Promise<Therapist> {
  const passwordHash = await hashPassword(input.password);
  const [therapist] = await db
    .insert(therapists)
    // La contraseña que asigna el admin es siempre temporal — se obliga a
    // cambiarla en el primer login (ver authController.changePassword).
    .values({ name: input.name, email: input.email, passwordHash, specialty: input.specialty, phone: input.phone, mustChangePassword: true })
    .returning();
  return therapist;
}

export async function setTherapistActive(id: string, active: boolean): Promise<void> {
  await db.update(therapists).set({ active }).where(eq(therapists.id, id));
}

export async function updateTherapist(
  id: string,
  patch: { name?: string; email?: string; specialty?: string | null; phone?: string | null; active?: boolean }
): Promise<Therapist | null> {
  const [therapist] = await db.update(therapists).set(patch).where(eq(therapists.id, id)).returning();
  return therapist ?? null;
}

export class TherapistHasCasesError extends Error {
  constructor() {
    super('No se puede eliminar: este terapeuta tiene casos de Punto Ciego asignados. Reasígnalos primero.');
  }
}

export async function deleteTherapist(id: string): Promise<boolean> {
  try {
    const deleted = await db.delete(therapists).where(eq(therapists.id, id)).returning({ id: therapists.id });
    return deleted.length > 0;
  } catch (e) {
    // Violación de FK (blindspot_cases.therapist_id) — Postgres 23503.
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23503') {
      throw new TherapistHasCasesError();
    }
    throw e;
  }
}

export async function updateTherapistPassword(id: string, passwordHash: string): Promise<void> {
  await db.update(therapists).set({ passwordHash, mustChangePassword: false }).where(eq(therapists.id, id));
}
