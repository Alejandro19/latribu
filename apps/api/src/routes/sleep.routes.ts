import { Router } from 'express';
import { SleepProtocolUpdateSchema, SleepLogInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as sleepController from '../controllers/sleep.controller.js';

export const sleepRouter = Router();

sleepRouter.get('/:id/sleep-protocol', authMiddleware, ownerOrAdmin, requirePermission('rest'), asyncHandler(sleepController.getProtocol));

sleepRouter.put(
  '/:id/sleep-protocol',
  authMiddleware,
  adminOnly,
  validateBody(SleepProtocolUpdateSchema),
  asyncHandler(sleepController.putProtocol)
);

sleepRouter.get('/:id/sleep-log-today', authMiddleware, ownerOrAdmin, requirePermission('rest'), asyncHandler(sleepController.getTodayLog));

sleepRouter.get('/:id/sleep-logs', authMiddleware, ownerOrAdmin, requirePermission('rest'), asyncHandler(sleepController.listLogs));

sleepRouter.post(
  '/:id/sleep-log',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('rest'),
  validateBody(SleepLogInputSchema),
  asyncHandler(sleepController.logSleep)
);
