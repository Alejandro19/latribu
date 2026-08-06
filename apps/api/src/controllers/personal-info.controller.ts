import type { Request, Response } from 'express';
import type { PersonalInfoUpdateInput } from '@latribu/shared-types';
import * as personalInfoService from '../services/personal-info.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function getPersonalInfo(req: Request, res: Response) {
  const info = await personalInfoService.getPersonalInfoByClientId(req.params.id);
  return ok(res, { personalInfo: info || {} });
}

export async function putPersonalInfo(req: Request, res: Response) {
  const input = req.body as PersonalInfoUpdateInput;
  const info = await personalInfoService.upsertPersonalInfo(req.params.id, input);
  return ok(res, { personalInfo: info });
}

export async function uploadPersonalInfoFile(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  try {
    const result = await personalInfoService.uploadCheckupFile(req.params.id, req.file, req.body.onboarding_report);
    return ok(res, result);
  } catch (e) {
    if (e instanceof personalInfoService.InvalidFileTypeError) return err(res, e.message, 400);
    throw e;
  }
}
