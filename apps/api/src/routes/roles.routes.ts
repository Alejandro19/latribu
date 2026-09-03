import { Router } from 'express';
import { ModuleCreateInputSchema, PermissionsPatchSchema } from '@latribu/shared-types';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import * as rolesController from '../controllers/roles.controller.js';

export const rolesRouter = Router();

rolesRouter.get('/admin/roles/modules', authMiddleware, adminOnly, asyncHandler(rolesController.listModules));
rolesRouter.post(
  '/admin/roles/modules',
  authMiddleware,
  adminOnly,
  validateBody(ModuleCreateInputSchema),
  asyncHandler(rolesController.createModule)
);
rolesRouter.delete(
  '/admin/roles/modules/:key',
  authMiddleware,
  adminOnly,
  asyncHandler(rolesController.deleteModule)
);
rolesRouter.get('/admin/roles/matrix', authMiddleware, adminOnly, asyncHandler(rolesController.getMatrix));
rolesRouter.put(
  '/admin/roles/matrix/:clientType',
  authMiddleware,
  adminOnly,
  validateBody(PermissionsPatchSchema),
  asyncHandler(rolesController.saveMatrixColumn)
);
rolesRouter.get('/admin/roles/counts', authMiddleware, adminOnly, asyncHandler(rolesController.getCounts));
