import type { Request, Response, NextFunction } from 'express';
import { verifyToken, isPlanExpired, type TokenPayload } from '../services/auth.service.js';
import { findClientAuthRowById, type ClientAuthRow } from '../services/clients.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      client?: ClientAuthRow;
      planExpired?: boolean;
    }
  }
}

function unauthorized(res: Response, message: string, status = 401) {
  return res.status(status).json({ success: false, error: message });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return unauthorized(res, 'Token requerido.');

  let payload: TokenPayload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    return unauthorized(res, 'Token inválido o expirado.');
  }

  if (payload.role === 'cliente') {
    let client: ClientAuthRow | null;
    try {
      client = await findClientAuthRowById(payload.id);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '22P02') {
        // El id del JWT no tiene forma de UUID válido — tratar igual que
        // "cliente no encontrado", nunca dejar la petición colgada.
        return unauthorized(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
      }
      return next(error);
    }
    if (!client || client.status === 'inactive') {
      return unauthorized(res, 'Tu cuenta está inactiva. Contacta al administrador.', 403);
    }
    req.client = client;
    req.planExpired = isPlanExpired(client);
  }

  req.user = payload;
  next();
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return unauthorized(res, 'Acceso restringido a administradores.', 403);
  next();
}

export function ownerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (req.user?.id === req.params.id) {
    if (req.planExpired) return unauthorized(res, 'Tu plan ha vencido. Contacta a tu coach para renovarlo.', 402);
    return next();
  }
  return unauthorized(res, 'No tienes permiso para acceder a estos datos.', 403);
}