import { Router } from 'express';
import {
  ClientCreateInputSchema,
  ClientUpdateInputSchema,
  PermissionsPatchSchema,
  StatusPatchSchema,
  ClientTypePatchSchema,
  RenewPlanPatchSchema,
} from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import * as clientsController from '../controllers/clients.controller.js';

export const clientsRouter = Router();

clientsRouter.get('/', authMiddleware, adminOnly, asyncHandler(clientsController.listClients));
clientsRouter.post('/', authMiddleware, adminOnly, validateBody(ClientCreateInputSchema), asyncHandler(clientsController.createClient));
clientsRouter.get('/:id', authMiddleware, ownerOrAdmin, asyncHandler(clientsController.getClient));
clientsRouter.put('/:id', authMiddleware, ownerOrAdmin, validateBody(ClientUpdateInputSchema), asyncHandler(clientsController.updateClient));
// No hay endpoint de borrado: un cliente con evidencia legal de aceptación
// (legal_acceptances, sin ON DELETE CASCADE) no se puede borrar — usar
// "Desactivar cliente" (PATCH /:id/status) en su lugar.

clientsRouter.patch('/:id/permissions', authMiddleware, adminOnly, validateBody(PermissionsPatchSchema), asyncHandler(clientsController.updatePermissions));
clientsRouter.patch('/:id/status', authMiddleware, adminOnly, validateBody(StatusPatchSchema), asyncHandler(clientsController.updateStatus));
clientsRouter.patch('/:id/client-type', authMiddleware, adminOnly, validateBody(ClientTypePatchSchema), asyncHandler(clientsController.updateClientType));
clientsRouter.patch('/:id/renew-plan', authMiddleware, adminOnly, validateBody(RenewPlanPatchSchema), asyncHandler(clientsController.renewPlan));
clientsRouter.patch('/:id/deletion-request/resolve', authMiddleware, adminOnly, asyncHandler(clientsController.resolveDeletionRequest));
clientsRouter.post('/:id/resend-invitation', authMiddleware, adminOnly, asyncHandler(clientsController.resendInvitation));
clientsRouter.post('/:id/onboarding/approve-baseline', authMiddleware, adminOnly, asyncHandler(clientsController.approveBaseline));
clientsRouter.post('/:id/onboarding/approve-wearable', authMiddleware, adminOnly, asyncHandler(clientsController.approveWearable));
clientsRouter.get('/:id/membership-payments', authMiddleware, adminOnly, asyncHandler(clientsController.getMembershipPayments));
clientsRouter.post('/:id/membership-payments/:paymentId/approve', authMiddleware, adminOnly, asyncHandler(clientsController.approveMembershipPayment));
