import type { Request, Response } from 'express';
import type { EvolutionCheckinInput } from '@latribu/shared-types';
import * as evolutionService from '../services/evolution.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function getEvolution(req: Request, res: Response) {
  const data = await evolutionService.getEvolutionData(req.params.id);
  return ok(res, data);
}

export async function createCheckin(req: Request, res: Response) {
  const checkin = await evolutionService.createCheckin(req.params.id, req.body as EvolutionCheckinInput);
  return ok(res, { checkin }, 201);
}
