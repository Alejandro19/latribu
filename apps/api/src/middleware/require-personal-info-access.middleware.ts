import type { Request, Response, NextFunction } from 'express';
import { isModuleAllowedForType } from '../services/type-module-access.service.js';
import { asyncHandler } from './async-handler.js';

// Se permite el paso si CUALQUIERA de las dos variantes (estándar o
// Mentoring) está habilitada para el tipo de ese cliente en la matriz de
// "Roles y Perfiles" — cuál de las dos ve dentro del formulario (con o sin
// módulo 10) lo resuelve resolvePersonalInfoVariant.
export const requirePersonalInfoAccess = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === 'admin') return next();
  const clientType = req.client?.clientType;
  if (!clientType) {
    return res.status(403).json({ success: false, error: 'Este módulo no está disponible para tu tipo de cuenta.' });
  }
  const [standard, mentoring] = await Promise.all([
    isModuleAllowedForType(clientType, 'personal_info'),
    isModuleAllowedForType(clientType, 'personal_info_mentoring'),
  ]);
  if (!standard && !mentoring) {
    return res.status(403).json({ success: false, error: 'Este módulo no está disponible para tu tipo de cuenta.' });
  }
  next();
});
