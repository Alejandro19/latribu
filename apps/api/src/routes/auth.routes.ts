import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginInputSchema, ChangePasswordInputSchema, GoogleAuthInputSchema, AppleAuthInputSchema, ForgotPasswordInputSchema, ResetPasswordInputSchema, AcceptInvitationInputSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validateBody(LoginInputSchema), asyncHandler(authController.login));
authRouter.post('/therapist/login', loginLimiter, validateBody(LoginInputSchema), asyncHandler(authController.therapistLogin));
authRouter.get('/me', authMiddleware, asyncHandler(authController.me));
authRouter.post('/change-password', authMiddleware, validateBody(ChangePasswordInputSchema), asyncHandler(authController.changePassword));
authRouter.post('/google', validateBody(GoogleAuthInputSchema), asyncHandler(authController.googleLogin));
authRouter.post('/apple', validateBody(AppleAuthInputSchema), asyncHandler(authController.appleLogin));
authRouter.post('/forgot-password', loginLimiter, validateBody(ForgotPasswordInputSchema), asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', loginLimiter, validateBody(ResetPasswordInputSchema), asyncHandler(authController.resetPassword));
authRouter.post('/accept-invitation', loginLimiter, validateBody(AcceptInvitationInputSchema), asyncHandler(authController.acceptInvitation));
