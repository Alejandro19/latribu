import { Router } from 'express';
import { MorningCheckinInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as cognitiveLoadController from '../controllers/cognitive-load.controller.js';

export const cognitiveLoadRouter = Router();

cognitiveLoadRouter.get(
  '/:id/morning-checkin/today',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  asyncHandler(cognitiveLoadController.getTodayMorningCheckin)
);

cognitiveLoadRouter.post(
  '/:id/morning-checkin',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  validateBody(MorningCheckinInputSchema),
  asyncHandler(cognitiveLoadController.postMorningCheckin)
);

cognitiveLoadRouter.get(
  '/:id/cognitive-load',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  asyncHandler(cognitiveLoadController.getCognitiveLoadOverview)
);
