import { and, desc, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clientInvitations } from '../models/schema.js';
import { generateRawToken, hashToken } from './token-hashing.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export async function createInvitation(clientId: string): Promise<string> {
  const rawToken = generateRawToken();
  await db.insert(clientInvitations).values({
    clientId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  });
  return rawToken;
}

// Reenviar invalida explícitamente cualquier invitación anterior sin usar
// (marcándola usada, no borrándola) antes de generar una nueva — si no, el
// link viejo seguiría siendo válido en paralelo. Cubre el caso más probable
// en producción: una pestaña vieja con el link anterior abierta tras el
// reenvío (ver consumeInvitation, que distingue ese error).
export async function resendInvitation(clientId: string): Promise<string> {
  await db
    .update(clientInvitations)
    .set({ usedAt: new Date() })
    .where(and(eq(clientInvitations.clientId, clientId), isNull(clientInvitations.usedAt)));
  return createInvitation(clientId);
}

export type ConsumeInvitationResult =
  | { ok: true; clientId: string }
  | { ok: false; reason: 'not_found' | 'expired_or_used' };

export async function consumeInvitation(rawToken: string): Promise<ConsumeInvitationResult> {
  const tokenHash = hashToken(rawToken);
  const rows = await db.select().from(clientInvitations).where(eq(clientInvitations.tokenHash, tokenHash)).limit(1);
  const row = rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.usedAt || row.expiresAt < new Date()) return { ok: false, reason: 'expired_or_used' };
  await db.update(clientInvitations).set({ usedAt: new Date() }).where(eq(clientInvitations.id, row.id));
  return { ok: true, clientId: row.clientId };
}

// Señal inequívoca para el botón "Reenviar invitación" en la ficha del
// cliente: existe una invitación sin usar y sin vencer. A diferencia de
// inferir por `passwordHash === null` (que también es cierto para clientes
// SSO-only sin contraseña, que nunca deben ver este botón).
export async function hasPendingInvitation(clientId: string): Promise<boolean> {
  const rows = await db
    .select({ id: clientInvitations.id })
    .from(clientInvitations)
    .where(and(eq(clientInvitations.clientId, clientId), isNull(clientInvitations.usedAt), gt(clientInvitations.expiresAt, new Date())))
    .orderBy(desc(clientInvitations.createdAt))
    .limit(1);
  return rows.length > 0;
}
