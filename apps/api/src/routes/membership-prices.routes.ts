import { Router } from 'express';
import { MembershipPricePatchSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import * as membershipPricesController from '../controllers/membership-prices.controller.js';

export const membershipPricesRouter = Router();

// Lectura: cualquier rol logueado (el cliente la necesita para ver montos
// antes de pagar en /configuracion/membresias; el admin, para editarlos).
membershipPricesRouter.get('/membership-prices', authMiddleware, asyncHandler(membershipPricesController.listPrices));

membershipPricesRouter.patch(
  '/membership-prices/:id',
  authMiddleware,
  adminOnly,
  validateBody(MembershipPricePatchSchema),
  asyncHandler(membershipPricesController.updatePrice)
);
