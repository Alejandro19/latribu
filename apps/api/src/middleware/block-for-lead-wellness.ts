import type { Request, Response, NextFunction } from 'express';

// Información Personal (el onboarding de 9 módulos, incluida la composición
// corporal) requiere ser cliente de coaching — lead_wellness no tiene acceso.
export function blockForLeadWellness(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  if (req.client && req.client.clientType === 'lead_wellness') {
    return res.status(403).json({ success: false, error: 'Este módulo no está disponible para tu tipo de cuenta.' });
  }
  next();
}
