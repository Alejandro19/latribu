import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { legalAcceptances, type LegalAcceptance } from '../models/schema.js';

export type LegalAcceptanceInput = {
  dataPolicyVersion: string;
  termsVersion: string;
  sensitiveDataConsent: boolean;
  acceptedAt: string;
};

// Acepta `db` o el `tx` de una transacción en curso — createActiveExplorerClient
// y createInactiveClient (clients.service.ts) insertan la fila del cliente y
// esta fila de consentimiento en la MISMA transacción, para que nunca exista
// un cliente sin su evidencia de aceptación (ni al revés).
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Este módulo expone deliberadamente SOLO esta función de inserción — nunca
// un update ni un delete: es evidencia legal, no debe poder pisarse ni
// borrarse; una re-aceptación de una versión más nueva de los documentos
// agrega una fila nueva, nunca reemplaza la anterior.
export async function recordLegalAcceptance(executor: Executor, clientId: string, input: LegalAcceptanceInput): Promise<void> {
  await executor.insert(legalAcceptances).values({
    clientId,
    dataPolicyVersion: input.dataPolicyVersion,
    termsVersion: input.termsVersion,
    sensitiveDataConsent: input.sensitiveDataConsent,
    acceptedAt: new Date(input.acceptedAt),
  });
}

// Lectura — sección "Privacidad y datos" del panel de cuenta: muestra al
// cliente lo mismo que ya persistió su último paso de aceptación. Ordena por
// `createdAt` (asignado por el servidor, monótono), no por `acceptedAt`
// (viene del cliente — dos envíos pueden traer el mismo valor y dejarían el
// orden indefinido).
export async function findLatestAcceptanceByClientId(clientId: string): Promise<LegalAcceptance | null> {
  const rows = await db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.clientId, clientId))
    .orderBy(desc(legalAcceptances.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// Historial completo — usado por el export mínimo de "Descargar mis datos".
export async function findAllAcceptancesByClientId(clientId: string): Promise<LegalAcceptance[]> {
  return db
    .select()
    .from(legalAcceptances)
    .where(eq(legalAcceptances.clientId, clientId))
    .orderBy(desc(legalAcceptances.createdAt));
}
