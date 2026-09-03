import type { Request, Response } from 'express';
import * as reservationsService from '../services/community-reservations.service.js';

export async function getConfirmedReservations(_req: Request, res: Response) {
  const result = await reservationsService.getConfirmedReservations();
  return res.status(200).json({ success: true, ...result });
}