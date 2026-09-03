import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, ownerOrAdmin } from '../middleware/auth.middleware.js';
import { mentoringOnly } from '../middleware/blindspot-access.middleware.js';
import * as insightsController from '../controllers/insights.controller.js';

export const insightsRouter = Router();

// Motor de insights cruzados — exclusivo Mentoría (ver Matriz_Reglas_Mentoria_BIO360.md).
// Un cliente Presencial/Online recibe 403 de mentoringOnly, igual que en Punto Ciego.
insightsRouter.get('/:id/insights', authMiddleware, ownerOrAdmin, mentoringOnly, asyncHandler(insightsController.getInsights));
