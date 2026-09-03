import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import * as notificationsController from '../controllers/notifications.controller.js';

export const adminNotificationsRouter = Router();

adminNotificationsRouter.get(
  '/admin/notifications',
  authMiddleware,
  adminOnly,
  asyncHandler(notificationsController.listAdminNotifications)
);
adminNotificationsRouter.patch(
  '/admin/notifications/:id/read',
  authMiddleware,
  adminOnly,
  asyncHandler(notificationsController.markAdminNotificationRead)
);

export const clientNotificationsRouter = Router();

clientNotificationsRouter.get(
  '/:id/notifications',
  authMiddleware,
  ownerOrAdmin,
  asyncHandler(notificationsController.listClientNotifications)
);
clientNotificationsRouter.patch(
  '/:id/notifications/:notificationId/read',
  authMiddleware,
  ownerOrAdmin,
  asyncHandler(notificationsController.markClientNotificationRead)
);
