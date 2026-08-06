import type { Request, Response } from 'express';
import type { NutritionPlanUpdate, MealInput, MealUpdateInput } from '@latribu/shared-types';
import * as nutritionService from '../services/nutrition.service.js';
import { uploadFile } from '../storage/index.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function getNutrition(req: Request, res: Response) {
  const result = await nutritionService.getPlanAndMeals(req.params.id);
  return ok(res, result);
}

export async function putNutrition(req: Request, res: Response) {
  const plan = await nutritionService.upsertPlan(req.params.id, req.body as NutritionPlanUpdate);
  return ok(res, { plan });
}

export async function uploadNutritionPdf(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  if (req.file.mimetype !== 'application/pdf') return err(res, 'Formato inválido. Usa PDF.');
  const pdfUrl = await uploadFile(`${req.params.id}/nutrition`, req.file.buffer, req.file.mimetype, req.file.originalname);
  const plan = await nutritionService.attachPdf(req.params.id, pdfUrl, req.file.originalname);
  return ok(res, { plan });
}

export async function createMeal(req: Request, res: Response) {
  const meal = await nutritionService.createMeal(req.params.id, req.body as MealInput);
  return ok(res, { meal }, 201);
}

export async function updateMeal(req: Request, res: Response) {
  const meal = await nutritionService.updateMeal(req.params.id, req.params.mealId, req.body as MealUpdateInput);
  if (!meal) return err(res, 'Comida no encontrada.', 404);
  return ok(res, { meal });
}

export async function deleteMeal(req: Request, res: Response) {
  await nutritionService.deleteMeal(req.params.id, req.params.mealId);
  return ok(res, { message: 'Comida eliminada.' });
}
