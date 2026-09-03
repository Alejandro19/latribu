import { Router } from 'express';
import { DailyCheckinInputSchema, WeeklyReflectionInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { mentoringOnly } from '../middleware/blindspot-access.middleware.js';
import * as checkinsController from '../controllers/checkins.controller.js';

export const checkinsRouter = Router();

// Check-ins de baja fricción — exclusivo Mentoría, mismo gate que insights.routes.ts.
checkinsRouter.get('/:id/checkins-status', authMiddleware, ownerOrAdmin, mentoringOnly, asyncHandler(checkinsController.getStatus));

checkinsRouter.get('/:id/daily-checkin/today', authMiddleware, ownerOrAdmin, mentoringOnly, asyncHandler(checkinsController.getTodayCheckin));
checkinsRouter.post(
  '/:id/daily-checkin',
  authMiddleware, ownerOrAdmin, mentoringOnly,
  validateBody(DailyCheckinInputSchema),
  asyncHandler(checkinsController.postDailyCheckin)
);

checkinsRouter.get('/:id/weekly-reflection/current', authMiddleware, ownerOrAdmin, mentoringOnly, asyncHandler(checkinsController.getCurrentWeekReflection));
checkinsRouter.post(
  '/:id/weekly-reflection',
  authMiddleware, ownerOrAdmin, mentoringOnly,
  validateBody(WeeklyReflectionInputSchema),
  asyncHandler(checkinsController.postWeeklyReflection)
);
