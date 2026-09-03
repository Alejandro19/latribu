import { Router } from 'express';
import multer from 'multer';
import { NutritionPlanUpdateSchema, MealInputSchema, MealUpdateInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as nutritionController from '../controllers/nutrition.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const nutritionRouter = Router();

nutritionRouter.get(
  '/:id/nutrition',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('nutrition'),
  asyncHandler(nutritionController.getNutrition)
);

nutritionRouter.put(
  '/:id/nutrition',
  authMiddleware,
  adminOnly,
  validateBody(NutritionPlanUpdateSchema),
  asyncHandler(nutritionController.putNutrition)
);

nutritionRouter.post(
  '/:id/nutrition/upload-pdf',
  authMiddleware,
  adminOnly,
  upload.single('pdf'),
  asyncHandler(nutritionController.uploadNutritionPdf)
);

nutritionRouter.post(
  '/:id/meals',
  authMiddleware,
  adminOnly,
  validateBody(MealInputSchema),
  asyncHandler(nutritionController.createMeal)
);

nutritionRouter.put(
  '/:id/meals/:mealId',
  authMiddleware,
  adminOnly,
  validateBody(MealUpdateInputSchema),
  asyncHandler(nutritionController.updateMeal)
);

nutritionRouter.delete(
  '/:id/meals/:mealId',
  authMiddleware,
  adminOnly,
  asyncHandler(nutritionController.deleteMeal)
);
