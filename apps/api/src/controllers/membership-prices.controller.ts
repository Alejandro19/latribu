import type { Request, Response } from 'express';
import type { MembershipPricePatch } from '@latribu/shared-types';
import * as membershipPricesService from '../services/membership-prices.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listPrices(_req: Request, res: Response) {
  const prices = await membershipPricesService.listPrices();
  return ok(res, { prices });
}

export async function updatePrice(req: Request, res: Response) {
  const { amount_cents } = req.body as MembershipPricePatch;
  const price = await membershipPricesService.updatePrice(req.params.id, amount_cents);
  if (!price) return err(res, 'Precio no encontrado.', 404);
  return ok(res, { price });
}
