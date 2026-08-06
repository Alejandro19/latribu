import { Router } from 'express';
import multer from 'multer';
import { CortisolTechniqueInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as techniquesController from '../controllers/cortisol-techniques.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

export const cortisolTechniquesRouter = Router();

cortisolTechniquesRouter.get(
  '/:id/cortisol-techniques',
  authMiddleware,
  ownerOrAdmin,
  requirePermission('cortisol'),
  asyncHandler(techniquesController.listTechniques)
);

cortisolTechniquesRouter.post(
  '/:id/cortisol-techniques',
  authMiddleware,
  adminOnly,
  validateBody(CortisolTechniqueInputSchema),
  asyncHandler(techniquesController.createTechnique)
);

// Note: intentionally NOT running validateBody(CortisolTechniqueInputSchema) here.
// This route must also accept `audio_url: null` (a field the create schema doesn't
// declare) as a signal to clear the stored audio, matching legacy's schema-less
// req.body pass-through for this one route (server.js:1598-1610). Do not add
// validation here without also extending the schema — see task-3-brief.md.
cortisolTechniquesRouter.put(
  '/:id/cortisol-techniques/:techId',
  authMiddleware,
  adminOnly,
  asyncHandler(techniquesController.updateTechnique)
);

cortisolTechniquesRouter.delete(
  '/:id/cortisol-techniques/:techId',
  authMiddleware,
  adminOnly,
  asyncHandler(techniquesController.deleteTechnique)
);

cortisolTechniquesRouter.post(
  '/:id/cortisol-techniques/:techId/upload',
  authMiddleware,
  adminOnly,
  upload.single('video'),
  asyncHandler(techniquesController.uploadVideo)
);

cortisolTechniquesRouter.post(
  '/:id/cortisol-techniques/:techId/upload-audio',
  authMiddleware,
  adminOnly,
  upload.single('audio'),
  asyncHandler(techniquesController.uploadAudio)
);
