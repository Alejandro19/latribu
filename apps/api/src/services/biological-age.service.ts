import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { labPanels, type LabPanel } from '../models/schema.js';
import { getPersonalInfoByClientId } from './personal-info.service.js';
import { computeAge } from './insights/rango-optimo.js';
import { extractPhenoAgeMarkers, computePhenoAge } from './phenoage.js';

// Único punto que calcula y guarda Edad Biológica — se llama solo al
// aprobar un panel (ver lab-panels.controller.ts::approveLabPanel), nunca
// sobre un panel 'pendiente' o 'en_revision'. Si al cliente le falta el
// birthdate o al panel le faltan uno o más de los 9 marcadores de PhenoAge,
// no calcula nada (nunca aproxima) y el panel queda sin edad_biologica —
// efecto secundario silencioso, igual que captureBenchmarkSnapshot.
export async function computeAndStoreBiologicalAge(clientId: string, panel: LabPanel): Promise<void> {
  const markers = extractPhenoAgeMarkers(panel.datos as Record<string, unknown>);
  if (!markers) return;

  const info = await getPersonalInfoByClientId(clientId);
  if (!info?.birthdate) return;

  const checkpointDate = panel.fecha ? new Date(panel.fecha) : new Date();
  const edadCronologica = computeAge(info.birthdate, checkpointDate);
  if (edadCronologica == null) return;

  const edadBiologica = computePhenoAge(markers, edadCronologica);

  await db
    .update(labPanels)
    .set({ edadBiologica, edadCronologicaCalculo: edadCronologica, edadBiologicaCalculadaEn: new Date() })
    .where(eq(labPanels.id, panel.id));
}
