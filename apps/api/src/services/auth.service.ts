import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Client } from '../models/schema.js';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET no está configurada. Define esta variable de entorno antes ' +
      'de arrancar el servidor — nunca debe operar con un secreto por defecto.'
    );
  }
  return secret;
}

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];

export type TokenPayload = {
  id: string;
  role: 'admin' | 'cliente' | 'terapeuta';
  name: string;
  email: string;
  plan?: string;
  clientType?: string;
  mustChangePassword?: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, requireJwtSecret()) as TokenPayload;
}

// mentoring también vence a los 3 meses desde que se sumó el pago digital
// por Stripe — antes nunca bloqueaba, porque nadie renovaba su
// plan_end_date en la práctica (ver renewPlan, huérfano hasta el webhook).
const ACTIVE_PLAN_TYPES = ['coaching_1_1', 'mentoring'];

export function isPlanExpired(client: Pick<Client, 'clientType' | 'planEndDate'> | null): boolean {
  if (!client) return false;
  if (!ACTIVE_PLAN_TYPES.includes(client.clientType)) return false;
  if (!client.planEndDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today > client.planEndDate;
}
