import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/require-permission.middleware.js';
import * as restToolsController from '../controllers/rest-tools.controller.js';

export const restToolsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function handleAudioUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('audio')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, error: 'El archivo de audio es demasiado grande (máximo 100MB).' });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error) return next(error);
    next();
  });
}

restToolsRouter.get('/rest-tools', authMiddleware, requirePermission('rest'), asyncHandler(restToolsController.listActiveForClient));
restToolsRouter.get('/admin/rest-tools', authMiddleware, adminOnly, asyncHandler(restToolsController.listAllForAdmin));
restToolsRouter.post('/admin/rest-tools', authMiddleware, adminOnly, asyncHandler(restToolsController.createTool));
restToolsRouter.put('/admin/rest-tools/:id', authMiddleware, adminOnly, asyncHandler(restToolsController.updateTool));
restToolsRouter.delete('/admin/rest-tools/:id', authMiddleware, adminOnly, asyncHandler(restToolsController.deleteTool));
restToolsRouter.post(
  '/admin/rest-tools/:id/upload-audio',
  authMiddleware,
  adminOnly,
  handleAudioUpload,
  asyncHandler(restToolsController.uploadAudio)
);
