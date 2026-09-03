import type { Request, Response } from 'express';
import type { DailyCheckinInput, WeeklyReflectionInput } from '@latribu/shared-types';
import * as checkinsService from '../services/checkins.service.js';

function ok(res: Response, data: Record<string, unknown>) {
  return res.status(200).json({ success: true, ...data });
}

export async function getStatus(req: Request, res: Response) {
  const status = await checkinsService.getCheckinsStatus(req.params.id);
  return ok(res, status);
}

export async function getTodayCheckin(req: Request, res: Response) {
  const checkin = await checkinsService.getTodayCheckin(req.params.id);
  return ok(res, { checkin });
}

export async function postDailyCheckin(req: Request, res: Response) {
  const { pulsoAnimo } = req.body as DailyCheckinInput;
  const checkin = await checkinsService.upsertDailyCheckin(req.params.id, pulsoAnimo);
  return ok(res, { checkin });
}

export async function getCurrentWeekReflection(req: Request, res: Response) {
  const reflection = await checkinsService.getCurrentWeekReflection(req.params.id);
  return ok(res, { reflection });
}

export async function postWeeklyReflection(req: Request, res: Response) {
  const input = req.body as WeeklyReflectionInput;
  const reflection = await checkinsService.upsertWeeklyReflection(req.params.id, input);
  return ok(res, { reflection });
}
