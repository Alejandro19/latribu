import type { Request, Response } from 'express';
import type { CortisolTechniqueInput } from '@latribu/shared-types';
import * as techniquesService from '../services/cortisol-techniques.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listTechniques(req: Request, res: Response) {
  const techniques = await techniquesService.listTechniques(req.params.id);
  return ok(res, { techniques });
}

export async function createTechnique(req: Request, res: Response) {
  const technique = await techniquesService.createTechnique(req.params.id, req.body as CortisolTechniqueInput);
  return ok(res, { technique }, 201);
}

export async function updateTechnique(req: Request, res: Response) {
  const technique = await techniquesService.updateTechnique(req.params.techId, req.body as CortisolTechniqueInput & { audio_url?: null });
  if (!technique) return err(res, 'Técnica no encontrada.', 404);
  return ok(res, { technique });
}

export async function deleteTechnique(req: Request, res: Response) {
  await techniquesService.deleteTechnique(req.params.techId);
  return ok(res, { message: 'Técnica eliminada.' });
}

export async function uploadVideo(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún video.');
  const technique = await techniquesService.uploadVideo(req.params.techId, req.file);
  if (!technique) return err(res, 'Técnica no encontrada.', 404);
  return ok(res, { technique });
}

export async function uploadAudio(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún audio.');
  const technique = await techniquesService.uploadAudio(req.params.techId, req.file);
  if (!technique) return err(res, 'Técnica no encontrada.', 404);
  return ok(res, { technique });
}
