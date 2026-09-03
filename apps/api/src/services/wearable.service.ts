// Puerto fiel de BIO360services/wearableService.js — funciones base de
// tokens/métricas compartidas por whoop/oura/polar.service.ts. Traducido de
// Supabase-js a Drizzle (convención del proyecto nuevo), misma lógica.
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wearableTokens, wearableMetricas, type WearableToken, type WearableMetrica } from '../models/schema.js';

export type Dispositivo = 'garmin' | 'whoop' | 'oura' | 'polar';

const USER_ID_FIELD: Record<Dispositivo, 'garminUserId' | 'whoopUserId' | 'ouraUserId' | 'polarUserId'> = {
  garmin: 'garminUserId',
  whoop: 'whoopUserId',
  oura: 'ouraUserId',
  polar: 'polarUserId',
};

export type GuardarTokenInput = {
  clienteId: string;
  dispositivo: Dispositivo;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  userId?: string | null;
};

export async function guardarToken({ clienteId, dispositivo, accessToken, refreshToken, expiresIn, userId }: GuardarTokenInput): Promise<WearableToken> {
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  const payload: Record<string, unknown> = {
    clientId: clienteId,
    dispositivo,
    accessToken,
    refreshToken: refreshToken ?? null,
    tokenExpiresAt,
    connectedAt: new Date(),
    updatedAt: new Date(),
  };
  if (userId) payload[USER_ID_FIELD[dispositivo]] = userId;

  const [row] = await db
    .insert(wearableTokens)
    .values(payload as typeof wearableTokens.$inferInsert)
    .onConflictDoUpdate({
      target: [wearableTokens.clientId, wearableTokens.dispositivo],
      set: payload,
    })
    .returning();
  return row;
}

export async function obtenerToken(clienteId: string, dispositivo: Dispositivo): Promise<WearableToken | null> {
  const [row] = await db
    .select()
    .from(wearableTokens)
    .where(and(eq(wearableTokens.clientId, clienteId), eq(wearableTokens.dispositivo, dispositivo)));
  return row ?? null;
}

export function tokenExpirado(token: WearableToken | null): boolean {
  if (!token || !token.tokenExpiresAt) return false;
  return new Date(token.tokenExpiresAt) < new Date();
}

export async function actualizarUltimaSync(clienteId: string, dispositivo: Dispositivo): Promise<void> {
  await db
    .update(wearableTokens)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(and(eq(wearableTokens.clientId, clienteId), eq(wearableTokens.dispositivo, dispositivo)));
}

export async function desconectar(clienteId: string, dispositivo: Dispositivo): Promise<void> {
  await db.delete(wearableTokens).where(and(eq(wearableTokens.clientId, clienteId), eq(wearableTokens.dispositivo, dispositivo)));
}

export async function listarEstado(clienteId: string): Promise<WearableToken[]> {
  return db.select().from(wearableTokens).where(eq(wearableTokens.clientId, clienteId));
}

// ── Métricas ──────────────────────────────────────────────────────

export type MetricaInput = Partial<typeof wearableMetricas.$inferInsert> & {
  clientId: string;
  dispositivo: Dispositivo;
  fecha: string;
};

export async function guardarMetricas(metricas: MetricaInput[]): Promise<WearableMetrica[]> {
  if (metricas.length === 0) return [];
  // Upsert fila por fila (volumen bajo — una sincronización trae ~30 días máx)
  // para poder pasarle a `set` los mismos campos que trae cada fila.
  const results: WearableMetrica[] = [];
  for (const m of metricas) {
    const [row] = await db
      .insert(wearableMetricas)
      .values(m as typeof wearableMetricas.$inferInsert)
      .onConflictDoUpdate({ target: [wearableMetricas.clientId, wearableMetricas.dispositivo, wearableMetricas.fecha], set: m })
      .returning();
    results.push(row);
  }
  return results;
}

export type ObtenerMetricasInput = {
  clienteId: string;
  dispositivo?: Dispositivo | null;
  dias?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
};

export async function obtenerMetricas({ clienteId, dispositivo = null, dias = 7, fechaInicio = null, fechaFin = null }: ObtenerMetricasInput): Promise<WearableMetrica[]> {
  const conditions = [eq(wearableMetricas.clientId, clienteId)];
  if (dispositivo) conditions.push(eq(wearableMetricas.dispositivo, dispositivo));

  if (fechaInicio) {
    conditions.push(gte(wearableMetricas.fecha, fechaInicio));
  } else {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    conditions.push(gte(wearableMetricas.fecha, desde.toISOString().split('T')[0]));
  }
  if (fechaFin) conditions.push(lte(wearableMetricas.fecha, fechaFin));

  return db.select().from(wearableMetricas).where(and(...conditions)).orderBy(desc(wearableMetricas.fecha));
}

// ── Análisis ──────────────────────────────────────────────────────

const CAMPOS_PROMEDIO = [
  'fcReposo', 'hrvNocturno', 'suenoTotalMinutos', 'suenoProfundoMinutos', 'suenoRemMinutos',
  'suenoScore', 'suenoPerformance', 'recoveryScore', 'readinessScore', 'bodyBatteryMax',
  'estresPromedio', 'spo2', 'vo2max', 'tasaRespiratoria', 'pasos', 'caloriasActivas',
  'strainScore', 'temperaturaPiel',
] as const;

export function calcularPromedios(metricas: WearableMetrica[]): Record<string, number | null> {
  if (!metricas || metricas.length === 0) return {};
  const result: Record<string, number | null> = {};
  for (const campo of CAMPOS_PROMEDIO) {
    const valores = metricas
      .map((m) => (m as unknown as Record<string, unknown>)[campo])
      .filter((v): v is number => v != null && !Number.isNaN(Number(v)))
      .map(Number);
    result[campo] = valores.length > 0 ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10 : null;
  }
  return result;
}

type Rango = { optimo: [number, number]; limitrofe: [number, number] };
type RangoGenero = Rango | { M: Rango; F: Rango };

const RANGOS: Record<string, RangoGenero> = {
  hrvNocturno: { M: { optimo: [60, 999], limitrofe: [40, 59] }, F: { optimo: [55, 999], limitrofe: [35, 54] } },
  fcReposo: { optimo: [0, 60], limitrofe: [61, 70] },
  spo2: { optimo: [95, 100], limitrofe: [93, 94] },
  vo2max: { M: { optimo: [45, 999], limitrofe: [35, 44] }, F: { optimo: [38, 999], limitrofe: [28, 37] } },
  bodyBatteryMax: { optimo: [50, 100], limitrofe: [30, 49] },
  recoveryScore: { optimo: [66, 100], limitrofe: [34, 65] },
  readinessScore: { optimo: [70, 100], limitrofe: [50, 69] },
  suenoScore: { optimo: [80, 100], limitrofe: [60, 79] },
  suenoPerformance: { optimo: [85, 100], limitrofe: [70, 84] },
  estresPromedio: { optimo: [0, 25], limitrofe: [26, 50] },
  tasaRespiratoria: { optimo: [12, 20], limitrofe: [21, 24] },
  strainScore: { optimo: [0, 18], limitrofe: [18.1, 21] },
};

export function clasificarMetrica(metrica: string, valor: number | null | undefined, genero: 'M' | 'F' = 'M'): 'sin_dato' | 'neutro' | 'optimo' | 'limitrofe' | 'bajo' {
  if (valor === null || valor === undefined) return 'sin_dato';
  const rango = RANGOS[metrica];
  if (!rango) return 'neutro';
  const r: Rango = 'M' in rango ? rango[genero] : rango;
  if (valor >= r.optimo[0] && valor <= r.optimo[1]) return 'optimo';
  if (valor >= r.limitrofe[0] && valor <= r.limitrofe[1]) return 'limitrofe';
  return 'bajo';
}
