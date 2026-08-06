import type { Request, Response } from 'express';
import type { PhotoUploadMetadata } from '@latribu/shared-types';
import * as photosService from '../services/photos.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listPhotos(req: Request, res: Response) {
  const photos = await photosService.listPhotos(req.params.id);
  return ok(res, { photos });
}

export async function createPhoto(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ninguna foto.');
  const metadata = req.body as PhotoUploadMetadata;
  const photo = await photosService.createPhoto(req.params.id, req.file, metadata);
  return ok(res, { photo }, 201);
}
