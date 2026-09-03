import type { Request, Response } from 'express';
import type { CommunityTherapyInput } from '@latribu/shared-types';
import * as therapiesService from '../services/therapies.service.js';
import { uploadFile } from '../storage/index.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listTherapies(_req: Request, res: Response) {
  const therapies = await therapiesService.listActiveTherapiesWithCounts();
  return ok(res, { therapies: therapies.map((t) => ({ ...t, confirmed_count: t.confirmedCount })) });
}

export async function createTherapy(req: Request, res: Response) {
  const therapy = await therapiesService.createTherapy(req.body as CommunityTherapyInput);
  return ok(res, { therapy }, 201);
}

export async function updateTherapy(req: Request, res: Response) {
  const therapy = await therapiesService.updateTherapy(req.params.therapyId, req.body as Partial<CommunityTherapyInput>);
  if (!therapy) return err(res, 'Terapia no encontrada.', 404);
  return ok(res, { therapy });
}

export async function deleteTherapy(req: Request, res: Response) {
  await therapiesService.deleteTherapy(req.params.therapyId);
  return ok(res, { message: 'Terapia eliminada.' });
}

export async function uploadTherapyImage(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ninguna imagen.');
  if (req.file.mimetype !== 'image/jpeg' && req.file.mimetype !== 'image/png') return err(res, 'Formato inválido. Usa JPG o PNG.');
  const imageUrl = await uploadFile('therapies', req.file.buffer, req.file.mimetype, req.file.originalname);
  const therapy = await therapiesService.setTherapyImage(req.params.therapyId, imageUrl);
  if (!therapy) return err(res, 'Terapia no encontrada.', 404);
  return ok(res, { therapy });
}

export async function reserveTherapy(req: Request, res: Response) {
  if (req.user?.role !== 'cliente') return err(res, 'Solo los clientes pueden reservar.', 403);
  const { reservation, conflict } = await therapiesService.reserveTherapy(req.params.therapyId, req.user.id);
  if (conflict) return err(res, 'Ya tienes una reserva para esta terapia.', 409);
  return ok(res, { reservation }, 201);
}

export async function cancelTherapyReservation(req: Request, res: Response) {
  const cancelled = await therapiesService.cancelTherapyReservation(req.params.therapyId, req.user!.id);
  if (!cancelled) return err(res, 'No tienes una reserva para esta terapia.', 404);
  return ok(res, { message: 'Reserva cancelada.' });
}

export async function listClientTherapyReservations(req: Request, res: Response) {
  const reservations = await therapiesService.listClientTherapyReservations(req.params.id);
  return ok(res, { reservations });
}