import type { Request, Response } from 'express';
import type { TrainingDaysPatch, ConfirmSessionInput } from '@latribu/shared-types';
import * as trainingService from '../services/training.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function updateTrainingDays(req: Request, res: Response) {
  const { training_days } = req.body as TrainingDaysPatch;
  const client = await trainingService.updateTrainingDays(req.params.id, training_days);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function listTrainingCompletions(req: Request, res: Response) {
  const completions = await trainingService.listTrainingCompletions(req.params.id);
  return ok(res, { completions });
}

export async function confirmSession(req: Request, res: Response) {
  const { tz, source } = req.body as ConfirmSessionInput;
  try {
    const result = await trainingService.confirmSession(req.params.id, tz, source === 'nfc' ? 'nfc' : 'manual');
    return ok(res, result);
  } catch (e) {
    if (e instanceof trainingService.NoTrainingDaysError) return err(res, e.message, 400);
    throw e;
  }
}

export async function getStreak(req: Request, res: Response) {
  const tz = typeof req.query.tz === 'string' ? req.query.tz : '';
  const streak = await trainingService.getStreak(req.params.id, tz);
  return ok(res, { streak });
}

export async function useProtector(req: Request, res: Response) {
  const { tz } = req.body as ConfirmSessionInput;
  const streak = await trainingService.useProtector(req.params.id, tz);
  return ok(res, { streak });
}

export async function listAchievements(req: Request, res: Response) {
  const achievements = await trainingService.listAchievements(req.params.id);
  return ok(res, { achievements });
}

export async function getPhraseByContext(req: Request, res: Response) {
  const context = typeof req.query.context === 'string' ? req.query.context : '';
  if (context !== 'confirmacion' && context !== 'instagram') {
    return err(res, 'Contexto inválido.', 400);
  }
  const phrase = await trainingService.getPhraseByContext(context);
  return ok(res, { phrase });
}
