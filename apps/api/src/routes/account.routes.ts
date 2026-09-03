import { Router } from 'express';
import multer from 'multer';
import { LegalAcceptanceInputSchema, NotificationPreferencesPatchSchema, LanguagePatchSchema, MembershipCheckoutInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, clientOnly } from '../middleware/auth.middleware.js';
import * as accountController from '../controllers/account.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Módulo de "mi cuenta" — siempre req.user.id, nunca :id en la URL. Es
// self-service (ver PanelConfiguracion.jsx), no un recurso administrable
// por un admin sobre un cliente ajeno (eso sigue viviendo en clients.routes.ts).
export const accountRouter = Router();

accountRouter.use(authMiddleware, clientOnly);

accountRouter.get('/legal-acceptance', asyncHandler(accountController.getLegalAcceptance));
accountRouter.post(
  '/legal-acceptance',
  validateBody(LegalAcceptanceInputSchema),
  asyncHandler(accountController.postLegalAcceptance)
);
accountRouter.post('/avatar', upload.single('avatar'), asyncHandler(accountController.uploadAvatar));
accountRouter.patch(
  '/notification-preferences',
  validateBody(NotificationPreferencesPatchSchema),
  asyncHandler(accountController.patchNotificationPreferences)
);
accountRouter.patch(
  '/language',
  validateBody(LanguagePatchSchema),
  asyncHandler(accountController.patchLanguage)
);
accountRouter.post('/deletion-request', asyncHandler(accountController.postDeletionRequest));
accountRouter.get('/export', asyncHandler(accountController.getExport));
accountRouter.post(
  '/membership/checkout',
  validateBody(MembershipCheckoutInputSchema),
  asyncHandler(accountController.postMembershipCheckout)
);
accountRouter.get('/membership/payments/:id', asyncHandler(accountController.getMembershipPaymentStatus));
accountRouter.get('/membership/providers', asyncHandler(accountController.getMembershipProviders));
