import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wearableTokens } from '../models/schema.js';
import { verifyWhoopSignature, verifyOuraSignature, verifyHmacSignatureHex } from '../services/webhook-signature.js';
import * as whoopService from '../services/whoop.service.js';
import * as ouraService from '../services/oura.service.js';
import * as polarService from '../services/polar.service.js';

const DEBOUNCE_MS = 60_000;

type Dispositivo = 'whoop' | 'oura' | 'polar';

const SYNC_FN: Record<Dispositivo, (clientId: string) => Promise<unknown>> = {
  whoop: whoopService.sincronizarWhoop,
  oura: ouraService.sincronizarOura,
  polar: polarService.sincronizarPolar,
};

const USER_ID_COLUMN = {
  whoop: wearableTokens.whoopUserId,
  oura: wearableTokens.ouraUserId,
  polar: wearableTokens.polarUserId,
} as const;

// El webhook nunca parsea el payload para extraer datos — solo lo usa como
// señal de "algo cambió, re-sincronizá" y reutiliza sincronizarX(clientId)
// (pull real ya existente). Debounce de 60s contra lastSyncAt para no
// disparar syncs redundantes si el proveedor manda varios eventos casi
// simultáneos (ej. el cliente sincroniza manualmente su app del wearable).
async function triggerResync(dispositivo: Dispositivo, providerUserId: string): Promise<void> {
  const [row] = await db
    .select({ clientId: wearableTokens.clientId, lastSyncAt: wearableTokens.lastSyncAt })
    .from(wearableTokens)
    .where(eq(USER_ID_COLUMN[dispositivo], providerUserId))
    .limit(1);
  if (!row) return; // ningún cliente vinculado a este id externo — se ignora en silencio.

  if (row.lastSyncAt && Date.now() - new Date(row.lastSyncAt).getTime() < DEBOUNCE_MS) return;

  try {
    await SYNC_FN[dispositivo](row.clientId);
  } catch (e) {
    console.error(`wearable webhook: re-sync de ${dispositivo} falló para cliente ${row.clientId}`, e);
  }
}

// Extrae el id de usuario del proveedor del payload — WHOOP confirmado como
// `user_id` (developer.whoop.com/docs/developing/webhooks/); Oura/Polar
// quedan con candidatos best-effort hasta confirmar contra el primer webhook
// real recibido de cada uno.
function extractProviderUserId(payload: Record<string, unknown>): string | null {
  const candidates = ['user_id', 'userId', 'id', 'member_id', 'polar-user-id'];
  for (const key of candidates) {
    const v = payload[key];
    if (v != null) return String(v);
  }
  return null;
}

async function afterVerified(dispositivo: Dispositivo, rawBody: Buffer, res: Response): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    res.status(400).json({ success: false, error: 'Payload inválido.' });
    return;
  }
  const providerUserId = extractProviderUserId(payload);
  if (providerUserId) await triggerResync(dispositivo, providerUserId);
  res.status(200).json({ success: true });
}

// WHOOP: secreto = WHOOP_CLIENT_SECRET (mismo de la app, no uno aparte).
// Firma en base64 sobre timestamp+body, ver webhook-signature.ts.
export async function handleWhoopWebhook(req: Request, res: Response) {
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientSecret) return void res.status(503).json({ success: false, error: 'Webhook de whoop no configurado.' });

  const rawBody = req.body as Buffer;
  const timestamp = req.header('X-WHOOP-Signature-Timestamp');
  const signature = req.header('X-WHOOP-Signature');
  if (!verifyWhoopSignature(rawBody, timestamp, signature, clientSecret)) {
    return void res.status(401).json({ success: false, error: 'Firma inválida.' });
  }
  return afterVerified('whoop', rawBody, res);
}

// Oura: secreto = OURA_CLIENT_SECRET (mismo de la app). Firma en
// x-oura-signature — ver nota de incertidumbre en webhook-signature.ts.
export async function handleOuraWebhook(req: Request, res: Response) {
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  if (!clientSecret) return void res.status(503).json({ success: false, error: 'Webhook de oura no configurado.' });

  const rawBody = req.body as Buffer;
  const signature = req.header('x-oura-signature');
  if (!verifyOuraSignature(rawBody, signature, clientSecret)) {
    return void res.status(401).json({ success: false, error: 'Firma inválida.' });
  }
  return afterVerified('oura', rawBody, res);
}

// Polar: secreto = POLAR_WEBHOOK_SECRET, el `signature_secret_key` devuelto
// (una sola vez) por POST /v3/webhooks de AccessLink al crear el webhook —
// distinto de POLAR_CLIENT_SECRET.
export async function handlePolarWebhook(req: Request, res: Response) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return void res.status(503).json({ success: false, error: 'Webhook de polar no configurado.' });

  const rawBody = req.body as Buffer;
  const signature = req.header('Polar-Webhook-Signature') || req.header('X-Polar-Signature');
  if (!verifyHmacSignatureHex(rawBody, signature, secret)) {
    return void res.status(401).json({ success: false, error: 'Firma inválida.' });
  }
  return afterVerified('polar', rawBody, res);
}
