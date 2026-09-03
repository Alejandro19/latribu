import type { Request, Response } from 'express';
import type { CortisolCheckinInput, CortisolCompletionInput } from '@latribu/shared-types';
import * as logsService from '../services/cortisol-logs.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function listCompletions(req: Request, res: Response) {
  const completions = await logsService.listCompletions(req.params.id);
  return ok(res, { completions });
}

export async function markCompletion(req: Request, res: Response) {
  const { completion, created } = await logsService.markCompletion(req.params.id, req.body as CortisolCompletionInput);
  return ok(res, { completion }, created ? 201 : 200);
}

export async function getTodayCheckin(req: Request, res: Response) {
  const checkin = await logsService.getTodayCheckin(req.params.id);
  return ok(res, { checkin });
}

export async function listCheckins(req: Request, res: Response) {
  const checkins = await logsService.listCheckins(req.params.id);
  return ok(res, { checkins });
}

export async function upsertCheckin(req: Request, res: Response) {
  const checkin = await logsService.upsertCheckin(req.params.id, req.body as CortisolCheckinInput);
  return ok(res, { checkin });
}
