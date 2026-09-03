import express, { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { handleWhoopWebhook, handleOuraWebhook, handlePolarWebhook } from '../controllers/wearable-webhook.controller.js';

// Montar en app.ts ANTES de app.use(express.json(...)) — igual que
// stripe-webhook.routes.ts: se necesita el body crudo, sin parsear, para
// verificar la firma HMAC de cada proveedor.
export const wearableWebhookRouter = Router();

wearableWebhookRouter.post('/whoop', express.raw({ type: 'application/json' }), asyncHandler(handleWhoopWebhook));
wearableWebhookRouter.post('/oura', express.raw({ type: 'application/json' }), asyncHandler(handleOuraWebhook));
wearableWebhookRouter.post('/polar', express.raw({ type: 'application/json' }), asyncHandler(handlePolarWebhook));
