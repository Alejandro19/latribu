import { Router } from 'express';
import { CommunityEventInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireEventsAccess } from '../middleware/community-access.middleware.js';
import * as eventsController from '../controllers/events.controller.js';
import * as communityReservationsController from '../controllers/community-reservations.controller.js';

export const eventsRouter = Router();

eventsRouter.get('/community/events', authMiddleware, requireEventsAccess, asyncHandler(eventsController.listEvents));

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
  '/community/events/:eventId/reserve',
  authMiddleware,
  requireEventsAccess,
  asyncHandler(eventsController.reserveEvent)
);

eventsRouter.delete(
  '/community/events/:eventId/reserve',
  authMiddleware,
  requireEventsAccess,
  asyncHandler(eventsController.cancelEventReservation)
);

eventsRouter.get(
  '/clients/:id/event-reservations',
  authMiddleware,
  ownerOrAdmin,
  requireEventsAccess,
  asyncHandler(eventsController.listClientEventReservations)
);

eventsRouter.get(
  '/community/reservations',
  authMiddleware,
  adminOnly,
  asyncHandler(communityReservationsController.getConfirmedReservations)
);