import { db } from '../db/index.js';
import { mentoringBenchmarkSnapshots } from '../models/schema.js';
import { findClientById } from './clients.service.js';
import { getPersonalInfoByClientId } from './personal-info.service.js';
import { computeWearableTrend } from './insights/wearable-trend.js';
import { ALL_MARKER_IDS } from './insights/marker-ranges.js';
import type { MentoringAgeBand } from '@latribu/shared-types';

function resolveAgeBand(birthdate: string): MentoringAgeBand | null {
  const age = Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age >= 30 && age <= 39) return '30-39';
  if (age >= 40 && age <= 49) return '40-49';
  if (age >= 50 && age <= 59) return '50-59';
  if (age >= 60) return '60+';
  return null; // fuera de las bandas definidas (ej. <30) — no se captura.
}

function filterKnownMarkers(datos: Record<string, number>): Record<string, number> {
  const markers: Record<string, number> = {};
  for (const id of ALL_MARKER_IDS) {
    if (typeof datos[id] === 'number') markers[id] = datos[id];
  }
  return markers;
}

// Al cerrarse cada snapshot (semana 0/6/12) de un cliente de Mentoría, guarda
// una copia anonimizada en la tabla de benchmark agregado — para una futura
// comparación entre pares (todavía sin ninguna pantalla, ver plan). Nunca
// debe romper ni cambiar el guardado real del lab panel: cualquier condición
// faltante hace que se omita en silencio (con un log para diagnóstico), y el
// caller (lab-panels.controller.ts) además la envuelve en try/catch.
export async function captureBenchmarkSnapshot(
  clientId: string,
  panel: { semanaNumero: number; datos: Record<string, number> }
): Promise<void> {
  const client = await findClientById(clientId);
  if (!client || client.clientType !== 'mentoring') return;

  const info = await getPersonalInfoByClientId(clientId);
  if (!info?.birthdate || !info.cargoType || !info.sector) {
    console.warn('captureBenchmarkSnapshot: segmentación incompleta, se omite.', { clientId, semanaNumero: panel.semanaNumero });
    return;
  }

  const ageBand = resolveAgeBand(info.birthdate);
  if (!ageBand) {
    console.warn('captureBenchmarkSnapshot: edad fuera de las bandas definidas, se omite.', { clientId });
    return;
  }

  const wearableTrend = await computeWearableTrend(clientId);

  await db.insert(mentoringBenchmarkSnapshots).values({
    semanaNumero: panel.semanaNumero,
    ageBand,
    cargoType: info.cargoType,
    sector: info.sector,
    markers: filterKnownMarkers(panel.datos),
    wearable: {
      hrvPromedio: wearableTrend.hrvPromedio,
      fcReposoPromedio: wearableTrend.fcReposoPromedio,
      suenoScorePromedio: wearableTrend.suenoScorePromedio,
      recoveryScorePromedio: wearableTrend.recoveryScorePromedio,
      readinessScorePromedio: wearableTrend.readinessScorePromedio,
      suenoProfundoPctPromedio: wearableTrend.suenoProfundoPctPromedio,
    },
  });
}
