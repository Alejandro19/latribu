import type { Request, Response } from 'express';
import type { InbodyRecordInput } from '@latribu/shared-types';
import * as inbodyService from '../services/inbody.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listInbodyRecords(req: Request, res: Response) {
  const records = await inbodyService.listInbodyRecords(req.params.id);
  return ok(res, { records });
}

export async function createInbodyRecord(req: Request, res: Response) {
  const input = req.body as InbodyRecordInput;
  const record = await inbodyService.createInbodyRecord(req.params.id, input);
  return ok(res, { record }, 201);
}

export async function uploadInbodyFile(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  const result = await inbodyService.uploadInbodyFile(req.params.id, req.file);
  return ok(res, result);
}
