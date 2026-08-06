import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { personalRecords } from '../models/schema.js';
import type { PersonalRecord } from '../models/schema.js';
import type { PersonalRecordInput } from '@latribu/shared-types';

export async function listRecords(clientId: string): Promise<PersonalRecord[]> {
  return db.select().from(personalRecords).where(eq(personalRecords.clientId, clientId)).orderBy(asc(personalRecords.sortOrder));
}

export async function createRecord(clientId: string, input: PersonalRecordInput): Promise<PersonalRecord> {
  const [record] = await db.insert(personalRecords).values({
    clientId,
    exerciseName: input.exercise_name,
    initialValue: input.initial_value ?? null,
    currentValue: input.current_value ?? null,
    sortOrder: input.sort_order,
  }).returning();
  return record;
}

export async function updateRecord(recordId: string, patch: Partial<PersonalRecordInput>): Promise<PersonalRecord | null> {
  const fields: Record<string, unknown> = {};
  if (patch.exercise_name !== undefined) fields.exerciseName = patch.exercise_name;
  if (patch.initial_value !== undefined) fields.initialValue = patch.initial_value;
  if (patch.current_value !== undefined) fields.currentValue = patch.current_value;
  if (patch.sort_order !== undefined) fields.sortOrder = patch.sort_order;

  const [record] = await db.update(personalRecords).set(fields).where(eq(personalRecords.id, recordId)).returning();
  return record ?? null;
}

export async function deleteRecord(recordId: string): Promise<void> {
  await db.delete(personalRecords).where(eq(personalRecords.id, recordId));
}
