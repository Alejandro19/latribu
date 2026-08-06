import { Router } from 'express';
import { CortisolCheckinInputSchema, CortisolCompletionInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as logsController from '../controllers/cortisol-logs.controller.js';
import * as tipsController from '../controllers/cortisol-tips.controller.js';

export const cortisolLogsRouter = Router();

cortisolLogsRouter.get(
  '/:id/cortisol-completions',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  asyncHandler(logsController.listCompletions)
);

cortisolLogsRouter.post(
  '/:id/cortisol-completions',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  validateBody(CortisolCompletionInputSchema),
  asyncHandler(logsController.markCompletion)
);

cortisolLogsRouter.get(
  '/:id/cortisol-checkin',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  asyncHandler(logsController.getTodayCheckin)
);

cortisolLogsRouter.get(
  '/:id/cortisol-checkins',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  asyncHandler(logsController.listCheckins)
);

cortisolLogsRouter.post(
  '/:id/cortisol-checkin',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  validateBody(CortisolCheckinInputSchema),
  asyncHandler(logsController.upsertCheckin)
);

cortisolLogsRouter.get(
  '/:id/cortisol-tip-of-the-day',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  asyncHandler(tipsController.getTipOfTheDay)
);
