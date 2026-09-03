import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import { revalidateCache } from '../middleware/cache-control.middleware.js';
import * as adminPhrasesController from '../controllers/admin-phrases.controller.js';

export const adminPhrasesRouter = Router();

adminPhrasesRouter.get('/admin/phrases', authMiddleware, adminOnly, revalidateCache, asyncHandler(adminPhrasesController.listAllPhrases));
adminPhrasesRouter.post('/admin/phrases', authMiddleware, adminOnly, asyncHandler(adminPhrasesController.createPhrase));
adminPhrasesRouter.get(
  '/admin/phrases/random',
  authMiddleware,
  adminOnly,
  asyncHandler(adminPhrasesController.drawPreviewPhrase)
);
adminPhrasesRouter.patch(
  '/admin/phrases/:id',
  authMiddleware,
  adminOnly,
  asyncHandler(adminPhrasesController.updatePhrase)
);
adminPhrasesRouter.delete(
  '/admin/phrases/:id',
  authMiddleware,
  adminOnly,
  asyncHandler(adminPhrasesController.deletePhrase)
);
