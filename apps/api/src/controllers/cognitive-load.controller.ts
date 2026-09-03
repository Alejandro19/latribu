import type { Request, Response } from 'express';
import type { MorningCheckinInput } from '@latribu/shared-types';
import * as morningCheckinService from '../services/morning-checkin.service.js';
import * as cognitiveLoadService from '../services/cognitive-load.service.js';

function ok(res: Response, data: Record<string, unknown>) {
  return res.status(200).json({ success: true, ...data });
}

export async function getTodayMorningCheckin(req: Request, res: Response) {
  const checkin = await morningCheckinService.getTodayMorningCheckin(req.params.id);
  return ok(res, { checkin });
}

export async function postMorningCheckin(req: Request, res: Response) {
  const checkin = await morningCheckinService.upsertTodayMorningCheckin(req.params.id, req.body as MorningCheckinInput);
  return ok(res, { checkin });
}

export async function getCognitiveLoadOverview(req: Request, res: Response) {
  const overview = await cognitiveLoadService.getCognitiveLoadOverview(req.params.id);
  return ok(res, overview);
}
