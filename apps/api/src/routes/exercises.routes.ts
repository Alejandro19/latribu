import { Router } from 'express';
import { ExerciseInputSchema, ExerciseOrderPatchSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import { revalidateCache } from '../middleware/cache-control.middleware.js';
import * as exercisesController from '../controllers/exercises.controller.js';

export const exercisesRouter = Router();

exercisesRouter.get(
  '/:id/exercises',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('training'),
  revalidateCache,
  asyncHandler(exercisesController.listExercises)
);

exercisesRouter.post(
  '/:id/exercises',
  authMiddleware,
  adminOnly,
  validateBody(ExerciseInputSchema),
  asyncHandler(exercisesController.createExercise)
);

exercisesRouter.put(
  '/:id/exercises/:exerciseId',
  authMiddleware,
  adminOnly,
  validateBody(ExerciseInputSchema),
  asyncHandler(exercisesController.updateExercise)
);

exercisesRouter.delete(
  '/:id/exercises/:exerciseId',
  authMiddleware,
  adminOnly,
  asyncHandler(exercisesController.deleteExercise)
);

exercisesRouter.patch(
  '/:id/exercises/:exerciseId/order',
  authMiddleware,
  adminOnly,
  validateBody(ExerciseOrderPatchSchema),
  asyncHandler(exercisesController.reorderExercise)
);
