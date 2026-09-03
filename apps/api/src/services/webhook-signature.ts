import crypto from 'crypto';

// Genérico (hex) — usado por proveedores que firman con un secret dedicado
// generado aparte de las credenciales OAuth (ver Polar más abajo).
export function verifyHmacSignatureHex(rawBody: Buffer, signatureHex: string | undefined | null, secret: string): boolean {
  if (!signatureHex) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf-8');
  const givenBuf = Buffer.from(signatureHex, 'utf-8');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

// WHOOP (developer.whoop.com/docs/developing/webhooks/): firma en base64,
// HMAC-SHA256 del timestamp + body crudo concatenados, usando el
// client_secret de la app (no un secret aparte).
export function verifyWhoopSignature(rawBody: Buffer, timestampHeader: string | undefined | null, signatureBase64: string | undefined | null, clientSecret: string): boolean {
  if (!timestampHeader || !signatureBase64) return false;
  const payload = Buffer.concat([Buffer.from(timestampHeader, 'utf-8'), rawBody]);
  const expected = crypto.createHmac('sha256', clientSecret).update(payload).digest('base64');
  const expectedBuf = Buffer.from(expected, 'utf-8');
  const givenBuf = Buffer.from(signatureBase64, 'utf-8');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

// Oura (cloud.ouraring.com/v2/docs — Webhook Subscription API): x-oura-signature
// validado con el client_secret de la app. La documentación pública no deja
// tan explícito el formato exacto del payload firmado (podría incluir el
// verification_token elegido al crear la suscripción) — confirmar contra la
// respuesta real del primer webhook recibido antes de depender de esto en
// producción; por ahora asume HMAC-SHA256 hex del body crudo, mismo patrón
// que la mayoría de proveedores con esquema "client_secret + hex".
export function verifyOuraSignature(rawBody: Buffer, signatureHex: string | undefined | null, clientSecret: string): boolean {
  return verifyHmacSignatureHex(rawBody, signatureHex, clientSecret);
}
