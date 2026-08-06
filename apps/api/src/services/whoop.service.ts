// Puerto fiel de BIO360services/whoopService.js — OAuth 2.0 + sincronización
// de métricas WHOOP. Traducido de axios a fetch nativo (convención de
// ocr.service.ts en este backend), misma lógica y mismos endpoints.
import * as wearableService from './wearable.service.js';

const WHOOP_BASE_URL = 'https://api.prod.whoop.com/developer';
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

type WhoopTokenResponse = { access_token: string; refresh_token: string; expires_in: number };
type WhoopPerfil = { user_id?: number };

export function getAuthUrl(clienteId: string): string {
  const state = Buffer.from(JSON.stringify({ clienteId, dispositivo: 'whoop' })).toString('base64');
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    response_type: 'code',
    scope: ['read:recovery', 'read:cycles', 'read:sleep', 'read:workout', 'read:profile', 'read:body_measurement'].join(' '),
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

export async function intercambiarToken(code: string): Promise<WhoopTokenResponse> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.WHOOP_REDIRECT_URI!,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`WHOOP token exchange failed: ${res.status}`);
  return res.json();
}

async function renovarToken(clienteId: string): Promise<string> {
  const tokenData = await wearableService.obtenerToken(clienteId, 'whoop');
  if (!tokenData) throw new Error('No hay token de WHOOP');

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refreshToken ?? '',
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`WHOOP token refresh failed: ${res.status}`);
  const { access_token, refresh_token, expires_in } = (await res.json()) as WhoopTokenResponse;
  await wearableService.guardarToken({ clienteId, dispositivo: 'whoop', accessToken: access_token, refreshToken: refresh_token, expiresIn: expires_in });
  return access_token;
}

async function getTokenValido(clienteId: string): Promise<string> {
  const tokenData = await wearableService.obtenerToken(clienteId, 'whoop');
  if (!tokenData) throw new Error('WHOOP no conectado');
  if (wearableService.tokenExpirado(tokenData)) return renovarToken(clienteId);
  return tokenData.accessToken;
}

export async function getPerfil(accessToken: string): Promise<WhoopPerfil> {
  const res = await fetch(`${WHOOP_BASE_URL}/v1/user/profile/basic`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`WHOOP profile fetch failed: ${res.status}`);
  return res.json();
}

// ── Sincronización ────────────────────────────────────────────────

type MetricasPorFecha = Record<string, wearableService.MetricaInput & Record<string, unknown>>;

export async function sincronizarWhoop(clienteId: string): Promise<{ sincronizados: number }> {
  const accessToken = await getTokenValido(clienteId);
  const headers = { Authorization: `Bearer ${accessToken}` };

  const start = new Date();
  start.setDate(start.getDate() - 30);
  const params = new URLSearchParams({ start: start.toISOString(), end: new Date().toISOString(), limit: '30' });

  const [recoveryRes, sleepRes, cyclesRes] = await Promise.allSettled([
    fetch(`${WHOOP_BASE_URL}/v1/recovery?${params}`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`${WHOOP_BASE_URL}/v1/activity/sleep?${params}`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`${WHOOP_BASE_URL}/v1/cycle?${params}`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ]);

  const metricasPorFecha: MetricasPorFecha = {};
  const base = (fecha: string) => {
    if (!metricasPorFecha[fecha]) metricasPorFecha[fecha] = { clientId: clienteId, dispositivo: 'whoop', fecha };
    return metricasPorFecha[fecha];
  };

  if (recoveryRes.status === 'fulfilled') {
    for (const r of recoveryRes.value.records || []) {
      const fecha = r.created_at?.split('T')[0];
      if (!fecha) continue;
      Object.assign(base(fecha), {
        recoveryScore: r.score?.recovery_score ?? null,
        hrvNocturno: r.score?.hrv_rmssd_milli ? Math.round(r.score.hrv_rmssd_milli) : null,
        fcReposo: r.score?.resting_heart_rate ?? null,
        spo2: r.score?.spo2_percentage ?? null,
        temperaturaPiel: r.score?.skin_temp_celsius ?? null,
        rawData: { ...(base(fecha).rawData as object), recovery: r },
      });
    }
  }

  if (sleepRes.status === 'fulfilled') {
    for (const s of sleepRes.value.records || []) {
      const fecha = s.start?.split('T')[0];
      if (!fecha) continue;
      const st = s.score?.stage_summary || {};
      Object.assign(base(fecha), {
        suenoTotalMinutos: Math.round((s.score?.total_in_bed_time_milli || 0) / 60000),
        suenoLigeroMinutos: Math.round((st.total_light_sleep_time_milli || 0) / 60000),
        suenoProfundoMinutos: Math.round((st.total_slow_wave_sleep_time_milli || 0) / 60000),
        suenoRemMinutos: Math.round((st.total_rem_sleep_time_milli || 0) / 60000),
        suenoPerformance: s.score?.sleep_performance_percentage ?? null,
        horaDormir: s.start ?? null,
        horaDespertar: s.end ?? null,
        tasaRespiratoria: s.score?.respiratory_rate ?? null,
        rawData: { ...(base(fecha).rawData as object), sleep: s },
      });
    }
  }

  if (cyclesRes.status === 'fulfilled') {
    for (const c of cyclesRes.value.records || []) {
      const fecha = c.start?.split('T')[0];
      if (!fecha) continue;
      Object.assign(base(fecha), {
        strainScore: c.score?.strain ?? null,
        caloriasActivas: c.score?.kilojoule ? Math.round(c.score.kilojoule * 0.239006) : null,
        rawData: { ...(base(fecha).rawData as object), cycle: c },
      });
    }
  }

  const metricas = Object.values(metricasPorFecha);
  if (metricas.length > 0) await wearableService.guardarMetricas(metricas);
  await wearableService.actualizarUltimaSync(clienteId, 'whoop');

  return { sincronizados: metricas.length };
}
