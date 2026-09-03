import type { Request, Response } from 'express';
import type { SleepProtocolUpdate, SleepLogInput } from '@latribu/shared-types';
import * as sleepService from '../services/sleep.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function getProtocol(req: Request, res: Response) {
  const protocol = await sleepService.getProtocol(req.params.id);
  return ok(res, { protocol });
}

export async function putProtocol(req: Request, res: Response) {
  const protocol = await sleepService.upsertProtocol(req.params.id, req.body as SleepProtocolUpdate);
  return ok(res, { protocol });
}

export async function getTodayLog(req: Request, res: Response) {
  const log = await sleepService.getTodayLog(req.params.id);
  return ok(res, { log });
}

export async function listLogs(req: Request, res: Response) {
  const logs = await sleepService.listLogs(req.params.id);
  return ok(res, { logs });
}

export async function logSleep(req: Request, res: Response) {
  const log = await sleepService.logSleep(req.params.id, req.body as SleepLogInput);
  return ok(res, { log });
}
