import type { Request, Response } from 'express';
import { CLIENT_TYPES, type ModuleCreateInput, type PermissionsPatch } from '@latribu/shared-types';
import * as rolesService from '../services/roles.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listModules(_req: Request, res: Response) {
  const modules = await rolesService.listModules();
  return ok(res, { modules });
}

export async function createModule(req: Request, res: Response) {
  const { label } = req.body as ModuleCreateInput;
  const module = await rolesService.createModule(label);
  return ok(res, { module }, 201);
}

export async function deleteModule(req: Request, res: Response) {
  const { key } = req.params;
  const result = await rolesService.deleteModule(key);
  if (!result.deleted) return err(res, result.reason || 'No se pudo borrar el módulo.', 400);
  return ok(res, { message: 'Módulo eliminado.' });
}

export async function getMatrix(_req: Request, res: Response) {
  const { modules, matrix } = await rolesService.getMatrix();
  return ok(res, { modules, matrix });
}

export async function saveMatrixColumn(req: Request, res: Response) {
  const { clientType } = req.params;
  if (!(CLIENT_TYPES as readonly string[]).includes(clientType)) {
    return err(res, 'Tipo de cliente inválido.', 400);
  }
  const { permissions } = req.body as PermissionsPatch;
  await rolesService.saveMatrixColumn(clientType, permissions);
  return ok(res, { message: 'Cambios guardados.' });
}

export async function getCounts(_req: Request, res: Response) {
  const counts = await rolesService.getCounts();
  return ok(res, { counts });
}
