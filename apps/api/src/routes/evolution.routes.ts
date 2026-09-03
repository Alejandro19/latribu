import { Router } from 'express';
import { EvolutionCheckinInputSchema, PersonalRecordInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requireOnboardingComplete } from '../middleware/community-access.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as evolutionController from '../controllers/evolution.controller.js';
import * as personalRecordsController from '../controllers/personal-records.controller.js';
import * as clientsService from '../services/clients.service.js';

export const evolutionRouter = Router();

// GET /api/clients/:id/evolution — dashboard completo
evolutionRouter.get(
  '/clients/:id/evolution',
  authMiddleware, ownerOrAdmin, requireOnboardingComplete, requirePermission('evolution'),
  asyncHandler(evolutionController.getEvolution)
);

// POST /api/clients/:id/evolution — crear check-in
evolutionRouter.post(
  '/clients/:id/evolution',
  authMiddleware, ownerOrAdmin, requireOnboardingComplete, requirePermission('evolution'),
  validateBody(EvolutionCheckinInputSchema),
  asyncHandler(evolutionController.createCheckin)
);

// GET /api/clients/:id/personal-records
evolutionRouter.get(
  '/clients/:id/personal-records',
  authMiddleware, ownerOrAdmin, requireOnboardingComplete, requirePermission('evolution'),
  asyncHandler(personalRecordsController.listRecords)
);

// POST /api/clients/:id/personal-records (admin only)
evolutionRouter.post(
  '/clients/:id/personal-records',
  authMiddleware, adminOnly,
  validateBody(PersonalRecordInputSchema),
  asyncHandler(personalRecordsController.createRecord)
);

// PUT /api/clients/:id/personal-records/:recordId (admin only)
evolutionRouter.put(
  '/clients/:id/personal-records/:recordId',
  authMiddleware, adminOnly,
  asyncHandler(personalRecordsController.updateRecord)
);

// DELETE /api/clients/:id/personal-records/:recordId (admin only)
evolutionRouter.delete(
  '/clients/:id/personal-records/:recordId',
  authMiddleware, adminOnly,
  asyncHandler(personalRecordsController.deleteRecord)
);

// PATCH /api/clients/:id/next-checkin-date (admin only)
evolutionRouter.patch(
  '/clients/:id/next-checkin-date',
  authMiddleware, adminOnly,
  asyncHandler(async (req, res) => {
    await clientsService.updateClient(req.params.id, { nextCheckinDate: req.body.next_checkin_date || null });
    return res.status(200).json({ success: true, message: 'Fecha actualizada.' });
  })
);
