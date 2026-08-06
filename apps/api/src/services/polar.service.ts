// Puerto fiel de BIO360services/polarService.js — OAuth 2.0 real, pero la
// sincronización de métricas ya era un stub en el original (conecta y
// registra la sincronización sin traer datos reales todavía). Se mantiene
// así a propósito, tal como estaba en la fuente.
import * as wearableService from './wearable.service.js';

const POLAR_BASE_URL = 'https://www.polaraccesslink.com/v3';
const POLAR_AUTH_URL = 'https://flow.polar.com/oauth2/authorization';
const POLAR_TOKEN_URL = 'https://polarremote.com/v2/oauth2/token';

type PolarTokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };
type PolarPerfil = { 'polar-user-id'?: number };

export function getAuthUrl(clienteId: string): string {
  const state = Buffer.from(JSON.stringify({ clienteId, dispositivo: 'polar' })).toString('base64');
  const params = new URLSearchParams({ client_id: process.env.POLAR_CLIENT_ID!, response_type: 'code', state });
  return `${POLAR_AUTH_URL}?${params.toString()}`;
}

export async function intercambiarToken(code: string): Promise<PolarTokenResponse> {
  const token = Buffer.from(`${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(POLAR_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${token}`, Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }),
  });
  if (!res.ok) throw new Error(`Polar token exchange failed: ${res.status}`);
  return res.json();
}

async function getTokenValido(clienteId: string): Promise<string> {
  const tokenData = await wearableService.obtenerToken(clienteId, 'polar');
  if (!tokenData) throw new Error('Polar no conectado');
  return tokenData.accessToken;
}

export async function getPerfil(accessToken: string): Promise<PolarPerfil> {
  const res = await fetch(`${POLAR_BASE_URL}/users`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Polar profile fetch failed: ${res.status}`);
  return res.json();
}

// ── Sincronización (stub fiel al original) ─────────────────────────

export async function sincronizarPolar(clienteId: string): Promise<{ sincronizados: number }> {
  await getTokenValido(clienteId);
  await wearableService.actualizarUltimaSync(clienteId, 'polar');
  return { sincronizados: 0 };
}
