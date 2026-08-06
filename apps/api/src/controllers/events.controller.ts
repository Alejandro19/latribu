import type { Request, Response } from 'express';
import { CommunityEventInput } from '@latribu/shared-types';
import * as eventsService from '../services/events.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listEvents(_req: Request, res: Response) {
  const events = await eventsService.listActiveEventsWithCounts();
  return ok(res, { events: events.map((e) => ({ ...e, confirmed_count: e.confirmedCount })) });
}

export async function createEvent(req: Request, res: Response) {
  const event = await eventsService.createEvent(req.body as CommunityEventInput);
  return ok(res, { event }, 201);
}

export async function updateEvent(req: Request, res: Response) {
  const event = await eventsService.updateEvent(req.params.eventId, req.body as Partial<CommunityEventInput>);
  if (!event) return err(res, 'Evento no encontrado.', 404);
  return ok(res, { event });
}

export async function deleteEvent(req: Request, res: Response) {
  await eventsService.deleteEvent(req.params.eventId);
  return ok(res, { message: 'Evento eliminado.' });
}

export async function reserveEvent(req: Request, res: Response) {
  if (req.user?.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
  const { reservation, conflict } = await eventsService.reserveEvent(req.params.eventId, req.user.id);
  if (conflict) return err(res, 'Ya tienes una reserva para este evento.', 409);
  return ok(res, { reservation }, 201);
}

export async function cancelEventReservation(req: Request, res: Response) {
  const cancelled = await eventsService.cancelEventReservation(req.params.eventId, req.user!.id);
  if (!cancelled) return err(res, 'No tienes una reserva para este evento.', 404);
  return ok(res, { message: 'Reserva cancelada.' });
}

export async function listClientEventReservations(req: Request, res: Response) {
  const reservations = await eventsService.listClientEventReservations(req.params.id);
  return ok(res, { reservations });
}