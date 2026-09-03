import type { Request, Response } from 'express';
import { CommunityRetreatInput } from '@latribu/shared-types';
import * as retreatsService from '../services/retreats.service.js';
import { uploadFile } from '../storage/index.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listRetreats(_req: Request, res: Response) {
  const retreats = await retreatsService.listActiveRetreatsWithCounts();
  return ok(res, { retreats: retreats.map((r) => ({ ...r, confirmed_count: r.confirmedCount })) });
}

export async function createRetreat(req: Request, res: Response) {
  const retreat = await retreatsService.createRetreat(req.body as CommunityRetreatInput);
  return ok(res, { retreat }, 201);
}

export async function updateRetreat(req: Request, res: Response) {
  const retreat = await retreatsService.updateRetreat(req.params.retreatId, req.body as Partial<CommunityRetreatInput>);
  if (!retreat) return err(res, 'Retiro no encontrado.', 404);
  return ok(res, { retreat });
}

export async function deleteRetreat(req: Request, res: Response) {
  await retreatsService.deleteRetreat(req.params.retreatId);
  return ok(res, { message: 'Retiro eliminado.' });
}

export async function uploadRetreatImage(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ninguna imagen.');
  if (req.file.mimetype !== 'image/jpeg' && req.file.mimetype !== 'image/png') return err(res, 'Formato inválido. Usa JPG o PNG.');
  const imageUrl = await uploadFile('retreats', req.file.buffer, req.file.mimetype, req.file.originalname);
  const retreat = await retreatsService.setRetreatImage(req.params.retreatId, imageUrl);
  if (!retreat) return err(res, 'Retiro no encontrado.', 404);
  return ok(res, { retreat });
}

export async function reserveRetreat(req: Request, res: Response) {
  if (req.user?.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
  const { reservation, conflict } = await retreatsService.reserveRetreat(req.params.retreatId, req.user.id);
  if (conflict) return err(res, 'Ya tienes una reserva para este retiro.', 409);
  return ok(res, { reservation }, 201);
}

export async function cancelRetreatReservation(req: Request, res: Response) {
  const cancelled = await retreatsService.cancelRetreatReservation(req.params.retreatId, req.user!.id);
  if (!cancelled) return err(res, 'No tienes una reserva para este retiro.', 404);
  return ok(res, { message: 'Reserva cancelada.' });
}

export async function listClientRetreatReservations(req: Request, res: Response) {
  const reservations = await retreatsService.listClientRetreatReservations(req.params.id);
  return ok(res, { reservations });
}
