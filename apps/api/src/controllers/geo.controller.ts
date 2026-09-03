import type { Request, Response } from 'express';
import * as geoService from '../services/geo.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export function getCountries(_req: Request, res: Response) {
  return ok(res, { data: geoService.getCountries() });
}

export function getCities(req: Request, res: Response) {
  return ok(res, { data: geoService.getCitiesOfCountry(req.params.isoCode) });
}
