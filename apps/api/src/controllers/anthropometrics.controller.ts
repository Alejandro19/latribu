import type { Request, Response } from 'express';
import type { AnthropometricRecordInput } from '@latribu/shared-types';
import * as anthropometricsService from '../services/anthropometrics.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export async function listAnthropometrics(req: Request, res: Response) {
  const records = await anthropometricsService.listAnthropometrics(req.params.id);
  return ok(res, { records });
}

export async function createOrUpdateAnthropometric(req: Request, res: Response) {
  const input = req.body as AnthropometricRecordInput;
  const { record, status } = await anthropometricsService.createOrUpdateAnthropometric(req.params.id, input);
  return ok(res, { record }, status);
}

export async function deleteAnthropometric(req: Request, res: Response) {
  await anthropometricsService.deleteAnthropometric(req.params.id, req.params.recordId);
  return ok(res, { message: 'Registro eliminado.' });
}
