import type { Request, Response, NextFunction } from 'express';

const LEAD_BLOCKED_MODULES = ['training', 'nutrition', 'supplementation'];

export function requirePermission(moduleKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === 'admin') return next();
    if (LEAD_BLOCKED_MODULES.includes(moduleKey) && req.client?.clientType === 'lead_wellness') {
      return res.status(403).json({ success: false, error: 'Este módulo no está disponible para tu tipo de cuenta.' });
    }
    const permissions = req.client?.permissions;
    if (permissions && permissions[moduleKey] === false) {
      return res.status(403).json({ success: false, error: 'No tienes acceso a este módulo.' });
    }
    next();
  };
}
