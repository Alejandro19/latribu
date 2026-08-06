import { Router } from 'express';
import { CommunityTherapyInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireEventsAccess, requireCommunityAccess } from '../middleware/community-access.middleware.js';
import * as therapiesController from '../controllers/therapies.controller.js';

export const therapiesRouter = Router();

therapiesRouter.get('/community/therapies', authMiddleware, requireEventsAccess, asyncHandler(therapiesController.listTherapies));

therapiesRouter.post(
  '/community/therapies',
  authMiddleware,
  adminOnly,
  validateBody(CommunityTherapyInputSchema),
  asyncHandler(therapiesController.createTherapy)
);

therapiesRouter.put('/community/therapies/:therapyId', authMiddleware, adminOnly, asyncHandler(therapiesController.updateTherapy));

therapiesRouter.delete('/community/therapies/:therapyId', authMiddleware, adminOnly, asyncHandler(therapiesController.deleteTherapy));

therapiesRouter.post(
  '/community/therapies/:therapyId/reserve',
  authMiddleware,
  requireCommunityAccess,
  asyncHandler(therapiesController.reserveTherapy)
);

therapiesRouter.delete(
  '/community/therapies/:therapyId/reserve',
  authMiddleware,
  requireCommunityAccess,
  asyncHandler(therapiesController.cancelTherapyReservation)
);

therapiesRouter.get(
  '/clients/:id/therapy-reservations',
  authMiddleware,
  ownerOrAdmin,
  requireCommunityAccess,
  asyncHandler(therapiesController.listClientTherapyReservations)
);