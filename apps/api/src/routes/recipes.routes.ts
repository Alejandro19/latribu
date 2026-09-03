import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import { revalidateCache } from '../middleware/cache-control.middleware.js';
import * as recipesController from '../controllers/recipes.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const recipesRouter = Router();

recipesRouter.get('/admin/recipes', authMiddleware, adminOnly, revalidateCache, asyncHandler(recipesController.listRecipes));
recipesRouter.post(
  '/admin/recipes',
  authMiddleware,
  adminOnly,
  upload.single('pdf'),
  asyncHandler(recipesController.createRecipe)
);
recipesRouter.delete('/admin/recipes/:recipeId', authMiddleware, adminOnly, asyncHandler(recipesController.deleteRecipe));

// Lectura para el cliente — biblioteca global de recetas activas del módulo de Nutrición.
recipesRouter.get(
  '/clients/:id/recipes',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('nutrition'),
  revalidateCache,
  asyncHandler(recipesController.listActiveRecipes)
);
