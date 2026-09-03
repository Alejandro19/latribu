import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { blindspotCases } from '../models/schema.js';

function unauthorized(res: Response, message: string, status = 403) {
  return res.status(status).json({ success: false, error: message });
}

/**
 * Un terapeuta solo puede acceder a un caso que le fue asignado. Admins pasan
 * siempre. Espera el id del caso en req.params.id.
 */
export async function caseAccessOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (req.user?.role !== 'terapeuta') return unauthorized(res, 'No tienes permiso para acceder a este caso.');
  try {
    const rows = await db.select().from(blindspotCases).where(eq(blindspotCases.id, req.params.id)).limit(1);
    const blindspotCase = rows[0];
    if (!blindspotCase || blindspotCase.therapistId !== req.user.id) {
      return unauthorized(res, 'No tienes permiso para acceder a este caso.');
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Punto Ciego es exclusivo del tier Mentoría. Admins y terapeutas pasan
 * siempre (su acceso ya está acotado por otros middlewares); un cliente solo
 * pasa si su clientType es 'mentoring'.
 */
export function mentoringOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin' || req.user?.role === 'terapeuta') return next();
  if (req.client?.clientType !== 'mentoring') {
    return unauthorized(res, 'Este módulo es exclusivo para clientes Premium.');
  }
  next();
}
