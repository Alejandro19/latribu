import { Router } from 'express';
import { LabPanelInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import * as labPanelsController from '../controllers/lab-panels.controller.js';

export const labPanelsRouter = Router();

labPanelsRouter.get('/:id/lab-panels', authMiddleware, ownerOrAdmin, asyncHandler(labPanelsController.listLabPanels));

labPanelsRouter.put(
  '/:id/lab-panels',
  authMiddleware,
  ownerOrAdmin,
  validateBody(LabPanelInputSchema),
  asyncHandler(labPanelsController.upsertLabPanel)
);
