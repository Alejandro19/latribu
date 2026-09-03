import cron from 'node-cron';
import { lt, or, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wearableTokens } from '../models/schema.js';
import * as whoopService from '../services/whoop.service.js';
import * as ouraService from '../services/oura.service.js';
import * as polarService from '../services/polar.service.js';

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type Dispositivo = 'whoop' | 'oura' | 'polar' | 'garmin';

const SYNC_FN: Partial<Record<Dispositivo, (clientId: string) => Promise<unknown>>> = {
  whoop: whoopService.sincronizarWhoop,
  oura: ouraService.sincronizarOura,
  polar: polarService.sincronizarPolar,
};

// Red de seguridad si un webhook se pierde — re-sincroniza cualquier cliente
// conectado sin sync exitoso en las últimas 24h. El sync manual y los
// webhooks siguen siendo el camino primario; esto solo cubre el hueco.
export async function runWearableSyncSweep(): Promise<void> {
  const staleThreshold = new Date(Date.now() - STALE_AFTER_MS);
  const stale = await db
    .select({ clientId: wearableTokens.clientId, dispositivo: wearableTokens.dispositivo })
    .from(wearableTokens)
    .where(or(isNull(wearableTokens.lastSyncAt), lt(wearableTokens.lastSyncAt, staleThreshold)));

  for (const row of stale) {
    const syncFn = SYNC_FN[row.dispositivo as Dispositivo];
    if (!syncFn) continue; // garmin u otro dispositivo sin sync implementado.
    try {
      await syncFn(row.clientId);
    } catch (e) {
      console.error(`wearable-sync-cron: falló re-sync de ${row.dispositivo} para cliente ${row.clientId}`, e);
    }
  }
}

// Se llama una vez al arrancar el servidor (ver index.ts) — corre todos los
// días a las 03:00, horario de menor uso.
export function scheduleWearableSyncCron(): void {
  cron.schedule('0 3 * * *', () => {
    runWearableSyncSweep().catch((e) => console.error('wearable-sync-cron falló', e));
  });
}
