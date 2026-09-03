// Puerto fiel de BIO360services/ouraService.js — OAuth 2.0 + sincronización
// de métricas Oura Ring. Traducido de axios a fetch nativo, misma lógica.
import * as wearableService from './wearable.service.js';
import { updateBaselineTimestampsIfNeeded } from './wearable-baseline.service.js';

const OURA_BASE_URL = 'https://api.ouraring.com/v2';
const OURA_AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';

type OuraTokenResponse = { access_token: string; refresh_token: string; expires_in: number };

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${process.env.OURA_CLIENT_ID}:${process.env.OURA_CLIENT_SECRET}`).toString('base64')}`;
}

export function getAuthUrl(clienteId: string): string {
  const state = Buffer.from(JSON.stringify({ clienteId, dispositivo: 'oura' })).toString('base64');
  const params = new URLSearchParams({
    client_id: process.env.OURA_CLIENT_ID!,
    redirect_uri: process.env.OURA_REDIRECT_URI!,
    response_type: 'code',
    scope: ['daily', 'heartrate', 'workout', 'session', 'personal'].join(' '),
    state,
  });
  return `${OURA_AUTH_URL}?${params.toString()}`;
}

export async function intercambiarToken(code: string): Promise<OuraTokenResponse> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.OURA_REDIRECT_URI! }),
  });
  if (!res.ok) throw new Error(`Oura token exchange failed: ${res.status}`);
  return res.json();
}

async function renovarToken(clienteId: string): Promise<string> {
  const tokenData = await wearableService.obtenerToken(clienteId, 'oura');
  if (!tokenData) throw new Error('No hay token de Oura');

  const res = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokenData.refreshToken ?? '' }),
  });
  if (!res.ok) throw new Error(`Oura token refresh failed: ${res.status}`);
  const { access_token, refresh_token, expires_in } = (await res.json()) as OuraTokenResponse;
  await wearableService.guardarToken({ clienteId, dispositivo: 'oura', accessToken: access_token, refreshToken: refresh_token, expiresIn: expires_in });
  return access_token;
}

async function getTokenValido(clienteId: string): Promise<string> {
  const tokenData = await wearableService.obtenerToken(clienteId, 'oura');
  if (!tokenData) throw new Error('Oura no conectado');
  if (wearableService.tokenExpirado(tokenData)) return renovarToken(clienteId);
  return tokenData.accessToken;
}

// ── Sincronización ────────────────────────────────────────────────

type MetricasPorFecha = Record<string, wearableService.MetricaInput & Record<string, unknown>>;

export async function sincronizarOura(clienteId: string): Promise<{ sincronizados: number }> {
  const accessToken = await getTokenValido(clienteId);
  const headers = { Authorization: `Bearer ${accessToken}` };

  const start = new Date();
  start.setDate(start.getDate() - 30);
  const startStr = start.toISOString().split('T')[0];
  const endStr = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({ start_date: startStr, end_date: endStr });

  const [readinessRes, sleepRes, activityRes] = await Promise.allSettled([
    fetch(`${OURA_BASE_URL}/usercollection/daily_readiness?${params}`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`${OURA_BASE_URL}/usercollection/sleep?${params}`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`${OURA_BASE_URL}/usercollection/daily_activity?${params}`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ]);

  const metricasPorFecha: MetricasPorFecha = {};
  const base = (fecha: string) => {
    if (!metricasPorFecha[fecha]) metricasPorFecha[fecha] = { clientId: clienteId, dispositivo: 'oura', fecha };
    return metricasPorFecha[fecha];
  };

  if (readinessRes.status === 'fulfilled') {
    for (const r of readinessRes.value.data || []) {
      const fecha = r.day;
      if (!fecha) continue;
      Object.assign(base(fecha), {
        readinessScore: r.score ?? null,
        temperaturaPiel: r.temperature_deviation ?? null,
        rawData: { ...(base(fecha).rawData as object), readiness: r },
      });
    }
  }

  // Oura puede devolver varias sesiones por día (sueño nocturno + siestas).
  // Se agrupa por día y se toma la sesión principal ('long_sleep' o la más larga).
  if (sleepRes.status === 'fulfilled') {
    const sesionesPorFecha: Record<string, Array<Record<string, unknown>>> = {};
    for (const s of sleepRes.value.data || []) {
      const fecha = s.day;
      if (!fecha) continue;
      (sesionesPorFecha[fecha] ??= []).push(s);
    }
    for (const [fecha, sesiones] of Object.entries(sesionesPorFecha)) {
      const principal =
        (sesiones.find((s) => s.type === 'long_sleep') as Record<string, number> | undefined) ??
        (sesiones.reduce((a, b) =>
          ((b.total_sleep_duration as number) || 0) > ((a.total_sleep_duration as number) || 0) ? b : a
        ) as Record<string, number>);

      const secsToMins = (s: number | null | undefined) => (s != null ? Math.round(s / 60) : null);

      Object.assign(base(fecha), {
        suenoScore: principal.score ?? null,
        hrvNocturno: principal.average_hrv ?? null,
        fcReposo: principal.lowest_heart_rate ?? null,
        tasaRespiratoria: principal.average_breath ?? null,
        suenoTotalMinutos: secsToMins(principal.total_sleep_duration),
        suenoProfundoMinutos: secsToMins(principal.deep_sleep_duration),
        suenoRemMinutos: secsToMins(principal.rem_sleep_duration),
        suenoLigeroMinutos: secsToMins(principal.light_sleep_duration),
        suenoDespiertoMinutos: secsToMins(principal.awake_time),
        rawData: { ...(base(fecha).rawData as object), sleep: principal },
      });
    }
  }

  if (activityRes.status === 'fulfilled') {
    for (const a of activityRes.value.data || []) {
      const fecha = a.day;
      if (!fecha) continue;
      Object.assign(base(fecha), {
        pasos: a.steps ?? null,
        caloriasActivas: a.active_calories ?? null,
        rawData: { ...(base(fecha).rawData as object), activity: a },
      });
    }
  }

  const metricas = Object.values(metricasPorFecha);
  if (metricas.length > 0) await wearableService.guardarMetricas(metricas);
  await wearableService.actualizarUltimaSync(clienteId, 'oura');
  await updateBaselineTimestampsIfNeeded(clienteId);

  return { sincronizados: metricas.length };
}
