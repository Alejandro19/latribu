import { Router } from 'express';
import multer from 'multer';
import { CommunityEventInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireEventsAccess } from '../middleware/community-access.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as eventsController from '../controllers/events.controller.js';
import * as communityReservationsController from '../controllers/community-reservations.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const eventsRouter = Router();

eventsRouter.get('/community/events', authMiddleware, requireEventsAccess, requirePermission('community'), asyncHandler(eventsController.listEvents));

eventsRouter.post(
  '/community/events',
  authMiddleware,
  adminOnly,
  validateBody(CommunityEventInputSchema),
  asyncHandler(eventsController.createEvent)
);

eventsRouter.put('/community/events/:eventId', authMiddleware, adminOnly, asyncHandler(eventsController.updateEvent));

eventsRouter.delete('/community/events/:eventId', authMiddleware, adminOnly, asyncHandler(eventsController.deleteEvent));

eventsRouter.post(
  '/community/events/:eventId/upload-image',
  authMiddleware,
  adminOnly,
  upload.single('image'),
  asyncHandler(eventsController.uploadEventImage)
);

eventsRouter.post(
  '/community/events/:eventId/reserve',
  authMiddleware,
  requireEventsAccess,
  requirePermission('community'),
  asyncHandler(eventsController.reserveEvent)
);

eventsRouter.delete(
  '/community/events/:eventId/reserve',
  authMiddleware,
  requireEventsAccess,
  requirePermission('community'),
  asyncHandler(eventsController.cancelEventReservation)
);

eventsRouter.get(
  '/clients/:id/event-reservations',
  authMiddleware,
  ownerOrAdmin,
  requireEventsAccess,
  requirePermission('community'),
  asyncHandler(eventsController.listClientEventReservations)
);

eventsRouter.get(
  '/community/reservations',
  authMiddleware,
  adminOnly,
  asyncHandler(communityReservationsController.getConfirmedReservations)
);