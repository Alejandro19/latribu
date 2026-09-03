import express, { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { handleStripeWebhook } from '../controllers/stripe-webhook.controller.js';

// Montar en app.ts ANTES de app.use(express.json(...)) — Stripe necesita el
// body crudo, sin parsear, para verificar la firma del webhook.
export const stripeWebhookRouter = Router();

stripeWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(handleStripeWebhook)
);
