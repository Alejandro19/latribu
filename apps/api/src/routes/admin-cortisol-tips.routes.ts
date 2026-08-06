import { Router } from 'express';
import { CortisolTipInputSchema, CortisolTipUpdateSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import * as tipsController from '../controllers/cortisol-tips.controller.js';

export const adminCortisolTipsRouter = Router();

adminCortisolTipsRouter.get('/admin/cortisol-tips', authMiddleware, adminOnly, asyncHandler(tipsController.listTips));
adminCortisolTipsRouter.post(
  '/admin/cortisol-tips',
  authMiddleware,
  adminOnly,
  validateBody(CortisolTipInputSchema),
  asyncHandler(tipsController.createTip)
);
adminCortisolTipsRouter.patch(
  '/admin/cortisol-tips/:tipId',
  authMiddleware,
  adminOnly,
  validateBody(CortisolTipUpdateSchema),
  asyncHandler(tipsController.updateTip)
);
adminCortisolTipsRouter.delete('/admin/cortisol-tips/:tipId', authMiddleware, adminOnly, asyncHandler(tipsController.deleteTip));
