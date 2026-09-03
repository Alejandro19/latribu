import type { Request, Response, NextFunction } from 'express';
import { isModuleAllowedForType } from '../services/type-module-access.service.js';
import { asyncHandler } from './async-handler.js';

// 'supplementation' no tiene fila propia en la matriz de "Roles y Perfiles"
// — el spec de la pantalla solo lista una fila "Nutrición" para todo ese
// módulo. La capa de tipo se resuelve bajo la clave 'nutrition'; el permiso
// INDIVIDUAL más abajo sigue usando 'supplementation' tal cual, sin alias
// (ese es el que se auto-activa al asignarle un suplemento a un cliente).
const MATRIX_KEY_ALIASES: Record<string, string> = {
  supplementation: 'nutrition',
};

// La matriz de "Roles y Perfiles" (client_type_module_permissions) es el
// interruptor general por tipo de cliente — reemplaza lo que antes era un
// array hardcodeado (LEAD_BLOCKED_MODULES). El permiso individual por
// cliente (req.client.permissions) sigue siendo la capa fina que se
// auto-activa al asignarle contenido a ESE cliente — ambas capas se
// combinan, ninguna reemplaza a la otra (ver plan "Roles y Perfiles").
export function requirePermission(moduleKey: string) {
  const matrixKey = MATRIX_KEY_ALIASES[moduleKey] ?? moduleKey;
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Esta matriz es por TIPO DE CLIENTE — a un terapeuta no le aplica en
    // absoluto (sus rutas ya tienen sus propios guards: therapistOnly,
    // caseAccessOnly, mentoringOnly). Sin este bypass, req.client sería
    // undefined para un terapeuta y caería directo al 403.
    if (req.user?.role === 'admin' || req.user?.role === 'terapeuta') return next();
    const clientType = req.client?.clientType;
    if (!clientType || !(await isModuleAllowedForType(clientType, matrixKey))) {
      return res.status(403).json({ success: false, error: 'Este módulo no está disponible para tu tipo de cuenta.' });
    }
    const permissions = req.client?.permissions;
    if (permissions && permissions[moduleKey] === false) {
      return res.status(403).json({ success: false, error: 'No tienes acceso a este módulo.' });
    }
    next();
  });
}
