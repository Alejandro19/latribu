import { Router } from 'express';
import { SupplementInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as supplementsController from '../controllers/supplements.controller.js';

export const supplementsRouter = Router();

supplementsRouter.get(
  '/:id/supplements',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('supplementation'),
  asyncHandler(supplementsController.listSupplements)
);

supplementsRouter.post(
  '/:id/supplements',
  authMiddleware,
  adminOnly,
  validateBody(SupplementInputSchema),
  asyncHandler(supplementsController.createSupplement)
);

supplementsRouter.put(
  '/:id/supplements/:suppId',
  authMiddleware,
  adminOnly,
  validateBody(SupplementInputSchema),
  asyncHandler(supplementsController.updateSupplement)
);

supplementsRouter.delete(
  '/:id/supplements/:suppId',
  authMiddleware,
  adminOnly,
  asyncHandler(supplementsController.deleteSupplement)
);
