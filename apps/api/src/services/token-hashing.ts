import crypto from 'crypto';

// Mecanismo compartido por password-reset.service.ts y
// client-invitations.service.ts — mismo esquema (token random de 32 bytes,
// se persiste solo el hash SHA-256) para no divergir en dos implementaciones
// del mismo "canjear secreto por sesión/permiso".
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
