import type { Request, Response } from 'express';
import * as recipesService from '../services/recipes.service.js';
import { uploadFile } from '../storage/index.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listRecipes(_req: Request, res: Response) {
  const recipes = await recipesService.listAllRecipes();
  return ok(res, { recipes });
}

export async function listActiveRecipes(_req: Request, res: Response) {
  const recipes = await recipesService.listActiveRecipes();
  return ok(res, { recipes });
}

export async function createRecipe(req: Request, res: Response) {
  const name = (req.body?.name as string | undefined)?.trim();
  if (!name) return err(res, 'El nombre de la receta es obligatorio.');
  if (!req.file) return err(res, 'No se recibió ningún archivo.');
  if (req.file.mimetype !== 'application/pdf') return err(res, 'Formato inválido. Usa PDF.');
  const category = (req.body?.category as string | undefined)?.trim() || null;
  const pdfUrl = await uploadFile('recipes', req.file.buffer, req.file.mimetype, req.file.originalname);
  const recipe = await recipesService.createRecipe(name, category, pdfUrl, req.file.originalname);
  return ok(res, { recipe }, 201);
}

export async function deleteRecipe(req: Request, res: Response) {
  await recipesService.deleteRecipe(req.params.recipeId);
  return ok(res, { message: 'Receta eliminada.' });
}
