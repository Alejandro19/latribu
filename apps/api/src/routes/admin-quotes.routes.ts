import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import * as quotesController from '../controllers/quotes.controller.js';

export const adminQuotesRouter = Router();

adminQuotesRouter.get('/admin/quotes', authMiddleware, adminOnly, asyncHandler(quotesController.listQuotes));
adminQuotesRouter.post('/admin/quotes', authMiddleware, adminOnly, asyncHandler(quotesController.createQuote));
adminQuotesRouter.patch('/admin/quotes/:id', authMiddleware, adminOnly, asyncHandler(quotesController.updateQuote));
adminQuotesRouter.delete('/admin/quotes/:id', authMiddleware, adminOnly, asyncHandler(quotesController.deleteQuote));
