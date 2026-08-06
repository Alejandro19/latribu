import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bioInbodyRecords, type BioInbodyRecord } from '../models/schema.js';
import { findClientById, updateClient } from './clients.service.js';
import { uploadFile } from '../storage/index.js';
import type { InbodyRecordInput } from '@latribu/shared-types';

export async function listInbodyRecords(clientId: string): Promise<BioInbodyRecord[]> {
  return db.select().from(bioInbodyRecords).where(eq(bioInbodyRecords.clientId, clientId)).orderBy(asc(bioInbodyRecords.fecha));
}

export async function createInbodyRecord(clientId: string, input: InbodyRecordInput): Promise<BioInbodyRecord> {
  const fecha = input.fecha || new Date().toISOString().slice(0, 10);

  // Zod (packages/shared-types) usa el mismo wire format snake_case que el
  // legacy (peso_total, grasa_pct, ecw_tbw...); Drizzle espera las
  // propiedades camelCase declaradas en schema.ts. El mapeo debe ser
  // explícito — spreadear `input` directamente insertaría columnas nulas.
  const [record] = await db
    .insert(bioInbodyRecords)
    .values({
      clientId,
      fecha,
      version: input.version,
      pesoTotal: input.peso_total,
      smm: input.smm,
      grasaPct: input.grasa_pct,
      imc: input.imc,
      pesoObjetivo: input.peso_objetivo,
      grasaVisceral: input.grasa_visceral,
      bmr: input.bmr,
      anguloFase: input.angulo_fase,
      ecwTbw: input.ecw_tbw,
      masaOsea: input.masa_osea,
      altura: input.altura,
      mesNum: input.mes_num,
      fileUrl: input.file_url,
      fileName: input.file_name,
    })
    .returning();

  // Recalcula la próxima fecha esperada y reinicia el aviso de recordatorio
  // solo para cadencias regulares — "personalizado" no tiene un intervalo
  // fijo, así que el admin la ajusta a mano en la ficha del cliente.
  // No fatal: si esto falla, el registro InBody ya insertado no debe perderse.
  try {
    const client = await findClientById(clientId);
    if (client && (client.inbodyCadenceType === 'mensual' || client.inbodyCadenceType === 'bimestral')) {
      const monthsToAdd = client.inbodyCadenceType === 'bimestral' ? 2 : 1;
      const nextDate = new Date(`${fecha}T00:00:00`);
      nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
      await updateClient(clientId, {
        inbodyNextExpectedDate: nextDate.toISOString().slice(0, 10),
        inbodyReminderSentThisCycle: false,
      });
    }
  } catch (e) {
    console.error('No se pudo recalcular inbody_next_expected_date (no fatal):', e);
  }

  return record;
}

export async function uploadInbodyFile(
  clientId: string,
  file: { buffer: Buffer; mimetype: string; originalname: string }
): Promise<{ file_url: string; file_name: string }> {
  const fileUrl = await uploadFile(`${clientId}/inbody`, file.buffer, file.mimetype, file.originalname);
  return { file_url: fileUrl, file_name: file.originalname };
}
