import { Router } from 'express';
import { TrainingDaysPatchSchema, ConfirmSessionInputSchema, AssignedQuotePatchSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as trainingController from '../controllers/training.controller.js';
import * as quotesController from '../controllers/quotes.controller.js';

export const trainingRouter = Router();

trainingRouter.patch(
  '/:id/training-days',
  authMiddleware,
  adminOnly,
  validateBody(TrainingDaysPatchSchema),
  asyncHandler(trainingController.updateTrainingDays)
);

trainingRouter.get(
  '/:id/training-completions',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  asyncHandler(trainingController.listTrainingCompletions)
);

trainingRouter.post(
  '/:id/training/confirm-session',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  validateBody(ConfirmSessionInputSchema),
  asyncHandler(trainingController.confirmSession)
);

trainingRouter.get(
  '/:id/training/streak',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  asyncHandler(trainingController.getStreak)
);

trainingRouter.post(
  '/:id/training/use-protector',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  validateBody(ConfirmSessionInputSchema),
  asyncHandler(trainingController.useProtector)
);

trainingRouter.get(
  '/:id/training/achievements',
  authMiddleware,
  adminOnly,
  asyncHandler(trainingController.listAchievements)
);

trainingRouter.get(
  '/:id/training/phrase',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  asyncHandler(trainingController.getPhraseByContext)
);

trainingRouter.get(
  '/:id/quote-of-the-day',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  asyncHandler(quotesController.getQuoteOfTheDay)
);

trainingRouter.patch(
  '/:id/assigned-quote',
  authMiddleware,
  adminOnly,
  validateBody(AssignedQuotePatchSchema),
  asyncHandler(quotesController.assignQuote)
);
