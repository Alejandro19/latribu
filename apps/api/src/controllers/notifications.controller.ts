import type { Request, Response } from 'express';
import * as notificationsService from '../services/notifications.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listAdminNotifications(_req: Request, res: Response) {
  const notifications = await notificationsService.listAdminNotifications();
  return ok(res, { notifications });
}

export async function markAdminNotificationRead(req: Request, res: Response) {
  const notification = await notificationsService.markAdminNotificationRead(req.params.id);
  if (!notification) return err(res, 'Notificación no encontrada.', 404);
  return ok(res, { notification });
}

export async function listClientNotifications(req: Request, res: Response) {
  const notifications = await notificationsService.listClientNotifications(req.params.id);
  return ok(res, { notifications });
}

export async function markClientNotificationRead(req: Request, res: Response) {
  const notification = await notificationsService.markClientNotificationRead(req.params.id, req.params.notificationId);
  if (!notification) return err(res, 'Notificación no encontrada.', 404);
  return ok(res, { notification });
}
