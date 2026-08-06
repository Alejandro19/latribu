import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import * as geoController from '../controllers/geo.controller.js';

export const geoRouter = Router();

geoRouter.get('/countries', asyncHandler(geoController.getCountries));
geoRouter.get('/cities/:isoCode', asyncHandler(geoController.getCities));
