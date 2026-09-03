import { createWebhookHandler } from './payment-webhook.controller.js';

export const handleWompiWebhook = createWebhookHandler('wompi');
