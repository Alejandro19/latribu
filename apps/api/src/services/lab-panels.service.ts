import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { labPanels, type LabPanel } from '../models/schema.js';

export async function listLabPanels(clientId: string): Promise<LabPanel[]> {
  return db.select().from(labPanels).where(eq(labPanels.clientId, clientId)).orderBy(asc(labPanels.semanaNumero));
}

export type UpsertLabPanelInput = {
  semana: number;
  fecha: string;
  datos: Record<string, number>;
  diaCicloPanel?: number | null;
  fileUrl?: string;
  fileName?: string;
  sourceFileHash?: string;
};

// Guardado del lado del cliente (tras revisar el grid de OCR+IA) — siempre
// pasa a 'en_revision', tenga o no huecos: ambos casos requieren aprobación
// del admin de todos modos, la diferencia es solo de copy para el cliente.
export async function upsertLabPanel(clientId: string, input: UpsertLabPanelInput): Promise<LabPanel> {
  const values = {
    fecha: input.fecha,
    datos: input.datos,
    diaCicloPanel: input.diaCicloPanel ?? null,
    status: 'en_revision',
    ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl } : {}),
    ...(input.fileName !== undefined ? { fileName: input.fileName } : {}),
    ...(input.sourceFileHash !== undefined ? { sourceFileHash: input.sourceFileHash } : {}),
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(labPanels)
    .values({ clientId, semanaNumero: input.semana, ...values })
    .onConflictDoUpdate({ target: [labPanels.clientId, labPanels.semanaNumero], set: values })
    .returning();
  return row;
}

export async function findLabPanel(clientId: string, semana: number): Promise<LabPanel | null> {
  const rows = await db.select().from(labPanels).where(and(eq(labPanels.clientId, clientId), eq(labPanels.semanaNumero, semana))).limit(1);
  return rows[0] ?? null;
}

// Aprobación del admin — el único punto que dispara captureBenchmarkSnapshot
// (ver lab-panels.controller.ts). Antes se disparaba en cada upsertLabPanel,
// lo que insertaba una fila anonimizada por cada corrección del admin en una
// tabla insert-only e imposible de corregir después (ver comentario en
// mentoringBenchmarkSnapshots, schema.ts).
export async function approveLabPanel(clientId: string, semana: number, datosOverride?: Record<string, number>): Promise<LabPanel | null> {
  const patch: Record<string, unknown> = { status: 'aprobado', approvedAt: new Date(), updatedAt: new Date() };
  if (datosOverride !== undefined) patch.datos = datosOverride;
  const [row] = await db
    .update(labPanels)
    .set(patch)
    .where(and(eq(labPanels.clientId, clientId), eq(labPanels.semanaNumero, semana)))
    .returning();
  return row ?? null;
}

export async function deleteLabPanel(clientId: string, semana: number): Promise<void> {
  await db.delete(labPanels).where(and(eq(labPanels.clientId, clientId), eq(labPanels.semanaNumero, semana)));
}
