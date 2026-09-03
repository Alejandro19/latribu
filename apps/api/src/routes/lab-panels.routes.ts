import { Router } from 'express';
import multer from 'multer';
import { LabPanelInputSchema, LabPanelApproveInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin, adminOnly } from '../middleware/auth.middleware.js';
import * as labPanelsController from '../controllers/lab-panels.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const labPanelsRouter = Router();

labPanelsRouter.get('/:id/lab-panels', authMiddleware, ownerOrAdmin, asyncHandler(labPanelsController.listLabPanels));

labPanelsRouter.put(
  '/:id/lab-panels',
  authMiddleware,
  ownerOrAdmin,
  validateBody(LabPanelInputSchema),
  asyncHandler(labPanelsController.upsertLabPanel)
);

labPanelsRouter.post(
  '/:id/lab-panels/extract',
  authMiddleware,
  ownerOrAdmin,
  upload.single('file'),
  asyncHandler(labPanelsController.extractLabPanel)
);

labPanelsRouter.post(
  '/:id/lab-panels/:semana/approve',
  authMiddleware,
  adminOnly,
  validateBody(LabPanelApproveInputSchema),
  asyncHandler(labPanelsController.approveLabPanel)
);
