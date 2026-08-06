import type { Request, Response } from 'express';
import type { ExerciseInput, ExerciseOrderPatch } from '@latribu/shared-types';
import * as exercisesService from '../services/exercises.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 404) {
  return res.status(status).json({ success: false, error: message });
}

export async function listExercises(req: Request, res: Response) {
  const exercises = await exercisesService.listExercisesByClient(req.params.id);
  return ok(res, { exercises });
}

export async function createExercise(req: Request, res: Response) {
  const input = req.body as ExerciseInput;
  const exercise = await exercisesService.createExercise(req.params.id, input);
  return ok(res, { exercise }, 201);
}

export async function updateExercise(req: Request, res: Response) {
  const input = req.body as ExerciseInput;
  const exercise = await exercisesService.updateExercise(req.params.exerciseId, input);
  if (!exercise) return err(res, 'Ejercicio no encontrado.');
  return ok(res, { exercise });
}

export async function deleteExercise(req: Request, res: Response) {
  await exercisesService.deleteExercise(req.params.exerciseId);
  return ok(res, { message: 'Ejercicio eliminado.' });
}

export async function reorderExercise(req: Request, res: Response) {
  const { direction } = req.body as ExerciseOrderPatch;
  const exercises = await exercisesService.reorderExercise(req.params.exerciseId, direction);
  return ok(res, { exercises });
}
