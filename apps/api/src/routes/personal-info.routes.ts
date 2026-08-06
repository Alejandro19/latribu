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
import { blockForLeadWellness } from '../middleware/block-for-lead-wellness.js';
import * as personalInfoController from '../controllers/personal-info.controller.js';
import * as anthropometricsController from '../controllers/anthropometrics.controller.js';
import * as photosController from '../controllers/photos.controller.js';
import * as inbodyController from '../controllers/inbody.controller.js';
import * as ocrController from '../controllers/ocr.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const personalInfoRouter = Router();

personalInfoRouter.get(
  '/:id/personal-info',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(personalInfoController.getPersonalInfo)
);

personalInfoRouter.put(
  '/:id/personal-info',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(PersonalInfoUpdateSchema),
  asyncHandler(personalInfoController.putPersonalInfo)
);

personalInfoRouter.post(
  '/:id/personal-info-file',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  upload.single('checkup_file'),
  asyncHandler(personalInfoController.uploadPersonalInfoFile)
);

personalInfoRouter.get(
  '/:id/anthropometrics',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(anthropometricsController.listAnthropometrics)
);

personalInfoRouter.post(
  '/:id/anthropometrics',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(AnthropometricRecordInputSchema),
  asyncHandler(anthropometricsController.createOrUpdateAnthropometric)
);

personalInfoRouter.delete(
  '/:id/anthropometrics/:recordId',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(anthropometricsController.deleteAnthropometric)
);

personalInfoRouter.post(
  '/:id/photos',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  upload.single('photo'),
  validateBody(PhotoUploadMetadataSchema),
  asyncHandler(photosController.createPhoto)
);

personalInfoRouter.get(
  '/:id/photos',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(photosController.listPhotos)
);

personalInfoRouter.get(
  '/:id/inbody-records',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  asyncHandler(inbodyController.listInbodyRecords)
);

personalInfoRouter.post(
  '/:id/inbody-records',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(InbodyRecordInputSchema),
  asyncHandler(inbodyController.createInbodyRecord)
);

personalInfoRouter.post(
  '/:id/inbody-upload',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  upload.single('file'),
  asyncHandler(inbodyController.uploadInbodyFile)
);

personalInfoRouter.post(
  '/:id/ocr-vision',
  authMiddleware,
  ownerOrAdmin,
  blockForLeadWellness,
  validateBody(OcrInputSchema),
  asyncHandler(ocrController.ocrVision)
);
