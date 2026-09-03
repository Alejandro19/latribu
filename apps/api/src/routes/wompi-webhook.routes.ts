import express, { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { handleWompiWebhook } from '../controllers/wompi-webhook.controller.js';

// Montar en app.ts ANTES de app.use(express.json(...)) — Wompi necesita el
// body crudo, sin parsear, para recalcular el checksum del evento.
export const wompiWebhookRouter = Router();

wompiWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(handleWompiWebhook)
);
