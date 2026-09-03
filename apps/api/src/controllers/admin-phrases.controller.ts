import type { Request, Response } from 'express';
import * as trainingService from '../services/training.service.js';

const VALID_CONTEXTS = ['confirmacion', 'instagram', 'ambas'];

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listAllPhrases(_req: Request, res: Response) {
  const phrases = await trainingService.listAllPhrases();
  return ok(res, { phrases });
}

export async function createPhrase(req: Request, res: Response) {
  const { text, context } = req.body as { text?: string; context?: string };
  if (!text || !text.trim()) return err(res, 'La frase no puede estar vacía.');
  if (!context || !VALID_CONTEXTS.includes(context)) return err(res, 'Contexto inválido.');
  const phrase = await trainingService.createPhrase(text.trim(), context);
  return ok(res, { phrase }, 201);
}

export async function updatePhrase(req: Request, res: Response) {
  const { text, context, active } = req.body as { text?: string; context?: string; active?: boolean };
  if (context !== undefined && !VALID_CONTEXTS.includes(context)) return err(res, 'Contexto inválido.');
  if (text !== undefined && !text.trim()) return err(res, 'La frase no puede estar vacía.');
  const patch: { text?: string; context?: string; active?: boolean } = {};
  if (text !== undefined) patch.text = text.trim();
  if (context !== undefined) patch.context = context;
  if (active !== undefined) patch.active = active;
  const phrase = await trainingService.updatePhrase(req.params.id, patch);
  if (!phrase) return err(res, 'Frase no encontrada.', 404);
  return ok(res, { phrase });
}

export async function deletePhrase(req: Request, res: Response) {
  await trainingService.deletePhrase(req.params.id);
  return ok(res, { message: 'Frase eliminada.' });
}

export async function drawPreviewPhrase(req: Request, res: Response) {
  const context = typeof req.query.context === 'string' ? req.query.context : '';
  if (!VALID_CONTEXTS.includes(context)) return err(res, 'Contexto inválido.');
  const excludeId = typeof req.query.exclude === 'string' ? req.query.exclude : undefined;
  const phrase = await trainingService.drawPreviewPhrase(context, excludeId);
  return ok(res, { phrase });
}
