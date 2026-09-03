import type { Request, Response } from 'express';
import type { CortisolTipInput, CortisolTipUpdate } from '@latribu/shared-types';
import * as tipsService from '../services/cortisol-tips.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 404) {
  return res.status(status).json({ success: false, error: message });
}

export async function listTips(_req: Request, res: Response) {
  const tips = await tipsService.listTips();
  return ok(res, { tips });
}

export async function createTip(req: Request, res: Response) {
  const { content } = req.body as CortisolTipInput;
  const tip = await tipsService.createTip(content);
  return ok(res, { tip }, 201);
}

export async function updateTip(req: Request, res: Response) {
  const tip = await tipsService.updateTip(req.params.tipId, req.body as CortisolTipUpdate);
  if (!tip) return err(res, 'Tip no encontrado.');
  return ok(res, { tip });
}

export async function deleteTip(req: Request, res: Response) {
  await tipsService.deleteTip(req.params.tipId);
  return ok(res, { message: 'Tip eliminado.' });
}

export async function getTipOfTheDay(_req: Request, res: Response) {
  const tip = await tipsService.getTipOfTheDay();
  return ok(res, { tip });
}
