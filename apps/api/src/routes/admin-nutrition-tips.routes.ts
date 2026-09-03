import { Router } from 'express';
import { NutritionTipInputSchema, NutritionTipUpdateSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import { revalidateCache } from '../middleware/cache-control.middleware.js';
import * as tipsController from '../controllers/nutrition-tips.controller.js';

export const adminNutritionTipsRouter = Router();

adminNutritionTipsRouter.get('/admin/nutrition-tips', authMiddleware, adminOnly, revalidateCache, asyncHandler(tipsController.listTips));
adminNutritionTipsRouter.post(
  '/admin/nutrition-tips',
  authMiddleware,
  adminOnly,
  validateBody(NutritionTipInputSchema),
  asyncHandler(tipsController.createTip)
);
adminNutritionTipsRouter.patch(
  '/admin/nutrition-tips/:tipId',
  authMiddleware,
  adminOnly,
  validateBody(NutritionTipUpdateSchema),
  asyncHandler(tipsController.updateTip)
);
adminNutritionTipsRouter.delete('/admin/nutrition-tips/:tipId', authMiddleware, adminOnly, asyncHandler(tipsController.deleteTip));

// Lectura para el cliente — biblioteca global de tips activos del módulo de Nutrición.
adminNutritionTipsRouter.get(
  '/clients/:id/nutrition-tips',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('nutrition'),
  revalidateCache,
  asyncHandler(tipsController.listActiveTips)
);
