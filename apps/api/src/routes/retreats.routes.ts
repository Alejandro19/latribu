import { Router } from 'express';
import multer from 'multer';
import { CommunityRetreatInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireEventsAccess, requireCommunityAccess } from '../middleware/community-access.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as retreatsController from '../controllers/retreats.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const retreatsRouter = Router();

// El listado queda abierto (igual que Terapias) — el bloqueo real para Lead
// Wellness (experiencia premium/paga) es en reservar/cancelar/mis-reservas.
retreatsRouter.get('/community/retreats', authMiddleware, requireEventsAccess, requirePermission('community'), asyncHandler(retreatsController.listRetreats));

retreatsRouter.post(
  '/community/retreats',
  authMiddleware,
  adminOnly,
  validateBody(CommunityRetreatInputSchema),
  asyncHandler(retreatsController.createRetreat)
);

retreatsRouter.put('/community/retreats/:retreatId', authMiddleware, adminOnly, asyncHandler(retreatsController.updateRetreat));

retreatsRouter.delete('/community/retreats/:retreatId', authMiddleware, adminOnly, asyncHandler(retreatsController.deleteRetreat));

retreatsRouter.post(
  '/community/retreats/:retreatId/upload-image',
  authMiddleware,
  adminOnly,
  upload.single('image'),
  asyncHandler(retreatsController.uploadRetreatImage)
);

retreatsRouter.post(
  '/community/retreats/:retreatId/reserve',
  authMiddleware,
  requireCommunityAccess,
  requirePermission('community'),
  asyncHandler(retreatsController.reserveRetreat)
);

retreatsRouter.delete(
  '/community/retreats/:retreatId/reserve',
  authMiddleware,
  requireCommunityAccess,
  requirePermission('community'),
  asyncHandler(retreatsController.cancelRetreatReservation)
);

retreatsRouter.get(
  '/clients/:id/retreat-reservations',
  authMiddleware,
  ownerOrAdmin,
  requireCommunityAccess,
  requirePermission('community'),
  asyncHandler(retreatsController.listClientRetreatReservations)
);
