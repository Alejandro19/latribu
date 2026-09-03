import type { Request, Response } from 'express';
import * as wearableService from '../services/wearable.service.js';
import * as whoopService from '../services/whoop.service.js';
import * as ouraService from '../services/oura.service.js';
import * as polarService from '../services/polar.service.js';
import type { Dispositivo } from '../services/wearable.service.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DISPOSITIVOS_OAUTH: Dispositivo[] = ['whoop', 'oura', 'polar'];

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

function envVarFor(dispositivo: Dispositivo): string {
  return `${dispositivo.toUpperCase()}_CLIENT_ID`;
}

// ── Estado / métricas / sync / desconexión (autenticadas, /api/clients/:id/wearable) ──

export async function getEstado(req: Request, res: Response) {
  const tokens = await wearableService.listarEstado(req.params.id);
  const wearables = tokens.map((t) => ({
    dispositivo: t.dispositivo,
    conectado: true,
    conectadoEn: t.connectedAt,
    ultimaSync: t.lastSyncAt,
    tokenExpirado: wearableService.tokenExpirado(t),
  }));
  return ok(res, { wearables });
}

export async function getMetricas(req: Request, res: Response) {
  const dias = req.query.dias ? Number(req.query.dias) : 7;
  const dispositivo = (req.query.dispositivo as Dispositivo | undefined) || null;
  const metricas = await wearableService.obtenerMetricas({ clienteId: req.params.id, dispositivo, dias });
  const promedios = wearableService.calcularPromedios(metricas);
  return ok(res, { total: metricas.length, promedios, data: metricas });
}

export async function syncNow(req: Request, res: Response) {
  const dispositivo = req.params.dispositivo as Dispositivo;
  try {
    if (dispositivo === 'whoop') return ok(res, await whoopService.sincronizarWhoop(req.params.id));
    if (dispositivo === 'oura') return ok(res, await ouraService.sincronizarOura(req.params.id));
    if (dispositivo === 'polar') return ok(res, await polarService.sincronizarPolar(req.params.id));
    return err(res, 'Garmin no está configurado aún.', 503);
  } catch (e) {
    return err(res, e instanceof Error ? e.message : 'Error al sincronizar.', 500);
  }
}

export async function disconnect(req: Request, res: Response) {
  const dispositivo = req.params.dispositivo as Dispositivo;
  await wearableService.desconectar(req.params.id, dispositivo);
  return ok(res, { mensaje: `${dispositivo} desconectado` });
}

// ── OAuth connect/callback (públicas, redirect-based, /api/wearable) ──

export function connect(req: Request, res: Response) {
  const dispositivo = req.params.dispositivo as Dispositivo;
  const clienteId = req.query.clienteId as string | undefined;
  if (!clienteId) return err(res, 'clienteId requerido', 400);

  if (!DISPOSITIVOS_OAUTH.includes(dispositivo) || !process.env[envVarFor(dispositivo)]) {
    return err(res, `${dispositivo} no está configurado en el servidor.`, 503);
  }

  const service = { whoop: whoopService, oura: ouraService, polar: polarService }[dispositivo as 'whoop' | 'oura' | 'polar'];
  res.redirect(service.getAuthUrl(clienteId));
}

export async function callback(req: Request, res: Response) {
  const dispositivo = req.params.dispositivo as Dispositivo;
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

  if (error) {
    return res.redirect(`${FRONTEND_URL}/onboarding?sync=error&dispositivo=${dispositivo}`);
  }

  try {
    const { clienteId } = JSON.parse(Buffer.from(state ?? '', 'base64').toString()) as { clienteId: string };

    if (dispositivo === 'whoop') {
      const tokenData = await whoopService.intercambiarToken(code!);
      const perfil = await whoopService.getPerfil(tokenData.access_token);
      await wearableService.guardarToken({
        clienteId, dispositivo: 'whoop', accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token, expiresIn: tokenData.expires_in, userId: perfil?.user_id?.toString(),
      });
      await whoopService.sincronizarWhoop(clienteId);
    } else if (dispositivo === 'oura') {
      const tokenData = await ouraService.intercambiarToken(code!);
      await wearableService.guardarToken({
        clienteId, dispositivo: 'oura', accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token, expiresIn: tokenData.expires_in,
      });
      await ouraService.sincronizarOura(clienteId);
    } else if (dispositivo === 'polar') {
      const tokenData = await polarService.intercambiarToken(code!);
      await wearableService.guardarToken({
        clienteId, dispositivo: 'polar', accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token, expiresIn: tokenData.expires_in,
      });
      await polarService.sincronizarPolar(clienteId);
    }

    return res.redirect(`${FRONTEND_URL}/onboarding?sync=success&dispositivo=${dispositivo}`);
  } catch (e) {
    console.error(`Error callback ${dispositivo}:`, e instanceof Error ? e.message : e);
    return res.redirect(`${FRONTEND_URL}/onboarding?sync=error&dispositivo=${dispositivo}`);
  }
}
