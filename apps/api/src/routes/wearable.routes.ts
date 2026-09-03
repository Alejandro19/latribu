import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import * as wearableController from '../controllers/wearable.controller.js';

// Rutas autenticadas, ligadas a un cliente — se montan en /api/clients.
export const wearableRouter = Router();

wearableRouter.get('/:id/wearable/estado', authMiddleware, ownerOrAdmin, asyncHandler(wearableController.getEstado));
wearableRouter.get('/:id/wearable/metricas', authMiddleware, ownerOrAdmin, asyncHandler(wearableController.getMetricas));
wearableRouter.post('/:id/wearable/:dispositivo/sync', authMiddleware, ownerOrAdmin, asyncHandler(wearableController.syncNow));
wearableRouter.delete('/:id/wearable/:dispositivo', authMiddleware, ownerOrAdmin, asyncHandler(wearableController.disconnect));

// Rutas OAuth públicas (redirect-based: el navegador navega directo a estas
// URLs, no puede llevar el header Authorization) — se montan en /api/wearable.
// Fiel a BIO360routes/wearableRoutes.js: la única "autenticación" es el
// state de OAuth ida y vuelta con el proveedor, igual que en el original.
export const wearableOAuthRouter = Router();

wearableOAuthRouter.get('/:dispositivo/connect', wearableController.connect);
wearableOAuthRouter.get('/:dispositivo/callback', asyncHandler(wearableController.callback));
