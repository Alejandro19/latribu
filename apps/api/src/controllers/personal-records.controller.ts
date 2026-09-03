import type { Request, Response } from 'express';
import type { PersonalRecordInput } from '@latribu/shared-types';
import * as recordsService from '../services/personal-records.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listRecords(req: Request, res: Response) {
  const records = await recordsService.listRecords(req.params.id);
  return ok(res, { records });
}

export async function createRecord(req: Request, res: Response) {
  const record = await recordsService.createRecord(req.params.id, req.body as PersonalRecordInput);
  return ok(res, { record }, 201);
}

export async function updateRecord(req: Request, res: Response) {
  const record = await recordsService.updateRecord(req.params.recordId, req.body as Partial<PersonalRecordInput>);
  if (!record) return err(res, 'Récord no encontrado.', 404);
  return ok(res, { record });
}

export async function deleteRecord(req: Request, res: Response) {
  await recordsService.deleteRecord(req.params.recordId);
  return ok(res, { message: 'Récord eliminado.' });
}
