
import { Router } from 'express';
import multer from 'multer';
import {
  PersonalInfoUpdateSchema,
  AnthropometricRecordInputSchema,
  PhotoUploadMetadataSchema,
  InbodyRecordInputSchema,
  OcrInputSchema,
} from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { requirePersonalInfoAccess } from '../middleware/require-personal-info-access.middleware.js';
import * as personalInfoController from '../controllers/personal-info.controller.js';
import * as anthropometricsController from '../controllers/anthropometrics.controller.js';
import * as photosController from '../controllers/photos.controller.js';
import * as inbodyController from '../controllers/inbody.controller.js';
import * as ocrController from '../controllers/ocr.controller.js';
import * as onboardingController from '../controllers/onboarding.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const personalInfoRouter = Router();

// Sin requirePersonalInfoAccess a propósito — esta ruta existe justamente
// para que el frontend sepa si debe mostrar el formulario, la variante
// Mentoring, o un estado bloqueado (variant: 'none').
personalInfoRouter.get(
  '/:id/personal-info-access',
  authMiddleware,
  ownerOrAdmin,
  asyncHandler(personalInfoController.getPersonalInfoAccess)
);

personalInfoRouter.get(
  '/:id/personal-info',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  asyncHandler(personalInfoController.getPersonalInfo)
);

personalInfoRouter.put(
  '/:id/personal-info',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  validateBody(PersonalInfoUpdateSchema),
  asyncHandler(personalInfoController.putPersonalInfo)
);

personalInfoRouter.post(
  '/:id/personal-info-file',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  upload.single('checkup_file'),
  asyncHandler(personalInfoController.uploadPersonalInfoFile)
);

personalInfoRouter.get(
  '/:id/anthropometrics',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  asyncHandler(anthropometricsController.listAnthropometrics)
);

personalInfoRouter.post(
  '/:id/anthropometrics',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  validateBody(AnthropometricRecordInputSchema),
  asyncHandler(anthropometricsController.createOrUpdateAnthropometric)
);

personalInfoRouter.delete(
  '/:id/anthropometrics/:recordId',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  asyncHandler(anthropometricsController.deleteAnthropometric)
);

personalInfoRouter.post(
  '/:id/photos',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  upload.single('photo'),
  validateBody(PhotoUploadMetadataSchema),
  asyncHandler(photosController.createPhoto)
);

personalInfoRouter.get(
  '/:id/photos',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  asyncHandler(photosController.listPhotos)
);

personalInfoRouter.get(
  '/:id/inbody-records',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  asyncHandler(inbodyController.listInbodyRecords)
);

personalInfoRouter.post(
  '/:id/inbody-records',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  validateBody(InbodyRecordInputSchema),
  asyncHandler(inbodyController.createInbodyRecord)
);

personalInfoRouter.post(
  '/:id/inbody-upload',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  upload.single('file'),
  asyncHandler(inbodyController.uploadInbodyFile)
);

personalInfoRouter.post(
  '/:id/onboarding/finalize',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  asyncHandler(onboardingController.finalizeOnboarding)
);

personalInfoRouter.post(
  '/:id/ocr-vision',
  authMiddleware,
  ownerOrAdmin,
  requirePersonalInfoAccess,
  validateBody(OcrInputSchema),
  asyncHandler(ocrController.ocrVision)
);

