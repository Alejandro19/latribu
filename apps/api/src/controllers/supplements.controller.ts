import type { Request, Response } from 'express';
import type { SupplementInput } from '@latribu/shared-types';
import * as supplementsService from '../services/supplements.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 404) {
  return res.status(status).json({ success: false, error: message });
}

export async function listSupplements(req: Request, res: Response) {
  const supplementsList = await supplementsService.listSupplements(req.params.id);
  return ok(res, { supplements: supplementsList });
}

export async function createSupplement(req: Request, res: Response) {
  const supplement = await supplementsService.createSupplement(req.params.id, req.body as SupplementInput);
  if (!supplement) return err(res, 'Ya existe un suplemento con ese nombre para este cliente.', 409);
  return ok(res, { supplement }, 201);
}

export async function updateSupplement(req: Request, res: Response) {
  const supplement = await supplementsService.updateSupplement(req.params.id, req.params.suppId, req.body as SupplementInput);
  if (!supplement) return err(res, 'Suplemento no encontrado.');
  return ok(res, { supplement });
}

export async function deleteSupplement(req: Request, res: Response) {
  await supplementsService.deleteSupplement(req.params.id, req.params.suppId);
  return ok(res, { message: 'Suplemento eliminado.' });
}
