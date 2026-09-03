import { Router } from 'express';
import {
  BlindspotCaseCreateSchema,
  BlindspotCaseUpdateSchema,
  BlindspotTaskInputSchema,
  BlindspotTaskUpdateSchema,
  BlindspotSessionLogInputSchema,
  TherapistCreateSchema,
  TherapistUpdateSchema,
} from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, therapistOnly } from '../middleware/auth.middleware.js';
import { caseAccessOnly, mentoringOnly } from '../middleware/blindspot-access.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as blindspotController from '../controllers/blindspot.controller.js';

export const blindspotRouter = Router();

// ==== ADMIN ====
blindspotRouter.get('/cases', authMiddleware, adminOnly, asyncHandler(blindspotController.adminListCases));
blindspotRouter.post('/cases', authMiddleware, adminOnly, validateBody(BlindspotCaseCreateSchema), asyncHandler(blindspotController.adminCreateCase));
blindspotRouter.get('/cases/:id', authMiddleware, adminOnly, asyncHandler(blindspotController.adminGetCase));
blindspotRouter.patch('/cases/:id', authMiddleware, adminOnly, validateBody(BlindspotCaseUpdateSchema), asyncHandler(blindspotController.adminUpdateCase));
blindspotRouter.patch('/cases/:id/crisis/acknowledge', authMiddleware, adminOnly, asyncHandler(blindspotController.adminAcknowledgeCrisis));

blindspotRouter.get('/therapists', authMiddleware, adminOnly, asyncHandler(blindspotController.adminListTherapists));
blindspotRouter.post('/therapists', authMiddleware, adminOnly, validateBody(TherapistCreateSchema), asyncHandler(blindspotController.adminCreateTherapist));
blindspotRouter.patch('/therapists/:id', authMiddleware, adminOnly, validateBody(TherapistUpdateSchema), asyncHandler(blindspotController.adminUpdateTherapist));
blindspotRouter.delete('/therapists/:id', authMiddleware, adminOnly, asyncHandler(blindspotController.adminDeleteTherapist));

// ==== TERAPEUTA ====
blindspotRouter.get('/therapist/cases', authMiddleware, therapistOnly, asyncHandler(blindspotController.therapistListCases));
blindspotRouter.get('/therapist/cases/:id', authMiddleware, caseAccessOnly, asyncHandler(blindspotController.therapistGetCase));
blindspotRouter.post(
  '/therapist/cases/:id/tasks',
  authMiddleware,
  caseAccessOnly,
  validateBody(BlindspotTaskInputSchema),
  asyncHandler(blindspotController.therapistCreateTask)
);
blindspotRouter.patch(
  '/therapist/cases/:id/tasks/:taskId',
  authMiddleware,
  caseAccessOnly,
  validateBody(BlindspotTaskUpdateSchema),
  asyncHandler(blindspotController.therapistUpdateTask)
);
blindspotRouter.post(
  '/therapist/cases/:id/sessions',
  authMiddleware,
  caseAccessOnly,
  validateBody(BlindspotSessionLogInputSchema),
  asyncHandler(blindspotController.therapistCreateSession)
);
blindspotRouter.post('/therapist/cases/:id/crisis', authMiddleware, caseAccessOnly, asyncHandler(blindspotController.therapistRaiseCrisis));

// ==== CLIENTE ====
blindspotRouter.get('/my-case', authMiddleware, mentoringOnly, requirePermission('blindspot'), asyncHandler(blindspotController.clientGetMyCase));
blindspotRouter.patch('/my-case/tasks/:taskId', authMiddleware, mentoringOnly, requirePermission('blindspot'), asyncHandler(blindspotController.clientUpdateMyTask));
blindspotRouter.post('/my-case/help', authMiddleware, mentoringOnly, requirePermission('blindspot'), asyncHandler(blindspotController.clientRequestHelp));
