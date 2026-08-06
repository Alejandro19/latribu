import type { Request, Response } from 'express';
import type { LabPanelInput } from '@latribu/shared-types';
import * as labPanelsService from '../services/lab-panels.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function listLabPanels(req: Request, res: Response) {
  const panels = await labPanelsService.listLabPanels(req.params.id);
  return ok(res, { panels });
}

export async function upsertLabPanel(req: Request, res: Response) {
  const { semana, fecha, datos } = req.body as LabPanelInput;
  const panel = await labPanelsService.upsertLabPanel(req.params.id, { semana, fecha, datos });
  return ok(res, { panel });
}
