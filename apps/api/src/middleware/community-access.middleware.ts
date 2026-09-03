import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { personalInfo } from '../models/schema.js';

function unauthorized(res: Response, message: string, status = 403) {
  return res.status(status).json({ success: false, error: message });
}

/**
 * Middleware to check if user has completed onboarding (personal info).
 * Admins pass automatically.
 * Everyone else must have a personal_info row with non-null completed_at, else 403.
 */
export async function requireOnboardingComplete(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  try {
    const rows = await db.select().from(personalInfo).where(eq(personalInfo.clientId, req.user!.id)).limit(1);
    const info = rows[0];
    if (!info || !info.completedAt) {
      return unauthorized(res, 'Completa tu información personal para acceder a este módulo.');
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware for events access - open funnel, no conditions.
 * Admins pass; any client with req.client set passes (authenticated, active, non-inactive client).
 * Missing req.client → 403.
 */
export function requireEventsAccess(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (!req.client) return unauthorized(res, 'No tienes permiso para acceder a estos datos.');
  next();
}

/**
 * Middleware for therapies reserve/cancel only (NOT events routes).
 * Admins pass; expired-plan clients blocked with 402; otherwise delegates to
 * requireOnboardingComplete.
 */
export async function requireCommunityAccess(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (req.planExpired) return unauthorized(res, 'Tu plan ha vencido. Contacta a tu coach para renovarlo.', 402);
  return requireOnboardingComplete(req, res, next);
}