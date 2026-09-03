import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wearableMetricas } from '../models/schema.js';
import { findClientById, updateClient } from './clients.service.js';

const PRELIMINARY_DAYS = 7;
const STABLE_DAYS = 28;

// Baseline en dos etapas — sin tabla ni cálculo persistido del valor en sí:
// se computa al vuelo a partir de wearable_metricas en el momento de
// comparar (ver wearable-trend.ts, que ya hace ventanas rolling similares).
// Acá solo se marcan DOS timestamps una sola vez, la primera vez que se
// cruzan los umbrales — evita recalcular el conteo de días en cada carga de
// la lista de admin (ver ClientSummary). Se llama tras cada sync exitoso
// (manual, por webhook, o por el cron de respaldo).
export async function updateBaselineTimestampsIfNeeded(clientId: string): Promise<void> {
  const [{ dias }] = await db
    .select({ dias: sql<number>`count(distinct ${wearableMetricas.fecha})` })
    .from(wearableMetricas)
    .where(sql`${wearableMetricas.clientId} = ${clientId}`);

  const diasConDatos = Number(dias) || 0;
  if (diasConDatos < PRELIMINARY_DAYS) return;

  const client = await findClientById(clientId);
  if (!client) return;

  const update: Record<string, unknown> = {};
  if (!client.wearableBaselineReadyAt) update.wearableBaselineReadyAt = new Date();
  if (diasConDatos >= STABLE_DAYS && !client.wearableBaselineStableAt) update.wearableBaselineStableAt = new Date();
  if (Object.keys(update).length > 0) await updateClient(clientId, update);
}
