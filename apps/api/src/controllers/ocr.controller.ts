import type { Request, Response } from 'express';
import type { OcrInput } from '@latribu/shared-types';
import * as ocrService from '../services/ocr.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function ocrVision(req: Request, res: Response) {
  const { base64 } = req.body as OcrInput;
  try {
    const result = await ocrService.extractText(base64);
    return ok(res, result);
  } catch (e) {
    if (e instanceof ocrService.FileTooLargeError) return err(res, e.message, 413);
    if (e instanceof ocrService.ApiKeyError) return err(res, e.message, 401);
    if (e instanceof ocrService.VisionNotConfiguredError) return err(res, e.message, 501);
    if (e instanceof ocrService.VisionApiError) return err(res, e.message, 500);
    throw e;
  }
}
