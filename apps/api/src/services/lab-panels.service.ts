import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { labPanels, type LabPanel } from '../models/schema.js';

export async function listLabPanels(clientId: string): Promise<LabPanel[]> {
  return db.select().from(labPanels).where(eq(labPanels.clientId, clientId)).orderBy(asc(labPanels.semanaNumero));
}

export type UpsertLabPanelInput = { semana: number; fecha: string; datos: Record<string, number> };

export async function upsertLabPanel(clientId: string, input: UpsertLabPanelInput): Promise<LabPanel> {
  const [row] = await db
    .insert(labPanels)
    .values({ clientId, semanaNumero: input.semana, fecha: input.fecha, datos: input.datos })
    .onConflictDoUpdate({
      target: [labPanels.clientId, labPanels.semanaNumero],
      set: { fecha: input.fecha, datos: input.datos, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function deleteLabPanel(clientId: string, semana: number): Promise<void> {
  await db.delete(labPanels).where(and(eq(labPanels.clientId, clientId), eq(labPanels.semanaNumero, semana)));
}
