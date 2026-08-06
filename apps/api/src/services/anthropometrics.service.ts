import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { anthropometricRecords, type AnthropometricRecord } from '../models/schema.js';
import type { AnthropometricRecordInput } from '@latribu/shared-types';

export async function listAnthropometrics(clientId: string): Promise<AnthropometricRecord[]> {
  return db
    .select()
    .from(anthropometricRecords)
    .where(eq(anthropometricRecords.clientId, clientId))
    .orderBy(asc(anthropometricRecords.fecha));
}

export async function createOrUpdateAnthropometric(
  clientId: string,
  input: AnthropometricRecordInput
): Promise<{ record: AnthropometricRecord; status: 200 | 201 }> {
  const fecha = input.fecha || new Date().toISOString().slice(0, 10);
  const fields = {
    fecha,
    semana: input.semana,
    peso: input.peso,
    cintura: input.cintura,
    brazos: input.brazos,
    hombros: input.hombros,
    piernas: input.piernas,
    gluteo: input.gluteo,
    notas: input.notas,
  };

  if (input.mes_num !== undefined) {
    const existingRows = await db
      .select()
      .from(anthropometricRecords)
      .where(and(eq(anthropometricRecords.clientId, clientId), eq(anthropometricRecords.mesNum, input.mes_num)))
      .limit(1);
    const existing = existingRows[0];
    if (existing) {
      const [updated] = await db
        .update(anthropometricRecords)
        .set(fields)
        .where(eq(anthropometricRecords.id, existing.id))
        .returning();
      return { record: updated, status: 200 };
    }
  }

  const [inserted] = await db
    .insert(anthropometricRecords)
    .values({ clientId, mesNum: input.mes_num, ...fields })
    .returning();
  return { record: inserted, status: 201 };
}

export async function deleteAnthropometric(clientId: string, recordId: string): Promise<void> {
  await db
    .delete(anthropometricRecords)
    .where(and(eq(anthropometricRecords.id, recordId), eq(anthropometricRecords.clientId, clientId)));
}

export async function findAnthropometricById(recordId: string): Promise<AnthropometricRecord | undefined> {
  const rows = await db.select().from(anthropometricRecords).where(eq(anthropometricRecords.id, recordId)).limit(1);
  return rows[0];
}
