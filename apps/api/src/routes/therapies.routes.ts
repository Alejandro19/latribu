import { Router } from 'express';
import multer from 'multer';
import { CommunityTherapyInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireEventsAccess, requireCommunityAccess } from '../middleware/community-access.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as therapiesController from '../controllers/therapies.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const therapiesRouter = Router();

therapiesRouter.get('/community/therapies', authMiddleware, requireEventsAccess, requirePermission('community'), asyncHandler(therapiesController.listTherapies));

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
  '/community/therapies/:therapyId/upload-image',
  authMiddleware,
  adminOnly,
  upload.single('image'),
  asyncHandler(therapiesController.uploadTherapyImage)
);

therapiesRouter.post(
  '/community/therapies/:therapyId/reserve',
  authMiddleware,
  requireCommunityAccess,
  requirePermission('community'),
  asyncHandler(therapiesController.reserveTherapy)
);

therapiesRouter.delete(
  '/community/therapies/:therapyId/reserve',
  authMiddleware,
  requireCommunityAccess,
  requirePermission('community'),
  asyncHandler(therapiesController.cancelTherapyReservation)
);

therapiesRouter.get(
  '/clients/:id/therapy-reservations',
  authMiddleware,
  ownerOrAdmin,
  requireCommunityAccess,
  requirePermission('community'),
  asyncHandler(therapiesController.listClientTherapyReservations)
);