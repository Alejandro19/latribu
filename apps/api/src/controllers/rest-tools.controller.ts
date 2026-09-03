import type { Request, Response } from 'express';
import * as restToolsService from '../services/rest-tools.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listActiveForClient(_req: Request, res: Response) {
  const tools = await restToolsService.listActiveForClient();
  return ok(res, { tools });
}

export async function listAllForAdmin(_req: Request, res: Response) {
  const tools = await restToolsService.listAllForAdmin();
  return ok(res, { tools });
}

export async function createTool(req: Request, res: Response) {
  const { name, meta, action, minutes, seconds } = req.body as {
    name?: string;
    meta?: string | null;
    action?: string;
    minutes?: number | null;
    seconds?: number | null;
  };
  if (!name || !name.trim()) return err(res, 'Escribe un nombre.');
  if (action !== 'play' && action !== 'write') return err(res, 'Tipo inválido.');
  const tool = await restToolsService.createTool({ name: name.trim(), meta: meta ?? null, action, minutes: minutes ?? null, seconds: seconds ?? null });
  return ok(res, { tool }, 201);
}

export async function updateTool(req: Request, res: Response) {
  const { name, meta, action, minutes, seconds, active, audioUrl, audioName } = req.body as {
    name?: string;
    meta?: string | null;
    action?: string;
    minutes?: number | null;
    seconds?: number | null;
    active?: boolean;
    audioUrl?: string | null;
    audioName?: string | null;
  };
  if (action !== undefined && action !== 'play' && action !== 'write') return err(res, 'Tipo inválido.');
  const patch: Parameters<typeof restToolsService.updateTool>[1] = {};
  if (name !== undefined) patch.name = name.trim();
  if (meta !== undefined) patch.meta = meta;
  if (action !== undefined) patch.action = action;
  if (minutes !== undefined) patch.minutes = minutes;
  if (seconds !== undefined) patch.seconds = seconds;
  if (active !== undefined) patch.active = active;
  if (audioUrl !== undefined) patch.audioUrl = audioUrl;
  if (audioName !== undefined) patch.audioName = audioName;
  const tool = await restToolsService.updateTool(req.params.id, patch);
  if (!tool) return err(res, 'Herramienta no encontrada.', 404);
  return ok(res, { tool });
}

export async function deleteTool(req: Request, res: Response) {
  await restToolsService.deleteTool(req.params.id);
  return ok(res, { message: 'Herramienta eliminada.' });
}

export async function uploadAudio(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún audio.');
  const tool = await restToolsService.uploadAudio(req.params.id, req.file);
  if (!tool) return err(res, 'Herramienta no encontrada.', 404);
  return ok(res, { tool });
}
