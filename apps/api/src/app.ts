import express from 'express';
import cors from 'cors';
import compression from 'compression';
import type { Request, Response, NextFunction } from 'express';
import { authRouter } from './routes/auth.routes.js';
import { clientsRouter } from './routes/clients.routes.js';
import { personalInfoRouter } from './routes/personal-info.routes.js';
import { configRouter } from './routes/config.routes.js';
import { geoRouter } from './routes/geo.routes.js';
import { exercisesRouter } from './routes/exercises.routes.js';
import { trainingRouter } from './routes/training.routes.js';
import { nutritionRouter } from './routes/nutrition.routes.js';
import { supplementsRouter } from './routes/supplements.routes.js';
import { adminPhrasesRouter } from './routes/admin-phrases.routes.js';
import { adminQuotesRouter } from './routes/admin-quotes.routes.js';
import { restToolsRouter } from './routes/rest-tools.routes.js';
import { adminCortisolTipsRouter } from './routes/admin-cortisol-tips.routes.js';
import { adminNutritionTipsRouter } from './routes/admin-nutrition-tips.routes.js';
import { recipesRouter } from './routes/recipes.routes.js';
import { cortisolTechniquesRouter } from './routes/cortisol-techniques.routes.js';
import { cortisolLogsRouter } from './routes/cortisol-logs.routes.js';
import { cognitiveLoadRouter } from './routes/cognitive-load.routes.js';
import { sleepRouter } from './routes/sleep.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { therapiesRouter } from './routes/therapies.routes.js';
import { retreatsRouter } from './routes/retreats.routes.js';
import { evolutionRouter } from './routes/evolution.routes.js';
import { wellnessIndexRouter } from './routes/wellness-index.routes.js';
import { labPanelsRouter } from './routes/lab-panels.routes.js';
import { insightsRouter } from './routes/insights.routes.js';
import { checkinsRouter } from './routes/checkins.routes.js';
import { wearableRouter, wearableOAuthRouter } from './routes/wearable.routes.js';
import { blindspotRouter } from './routes/blindspot.routes.js';
import { rolesRouter } from './routes/roles.routes.js';
import { adminNotificationsRouter, clientNotificationsRouter } from './routes/notifications.routes.js';
import { accountRouter } from './routes/account.routes.js';
import { membershipPricesRouter } from './routes/membership-prices.routes.js';
import { stripeWebhookRouter } from './routes/stripe-webhook.routes.js';
import { wompiWebhookRouter } from './routes/wompi-webhook.routes.js';
import { wearableWebhookRouter } from './routes/wearable-webhook.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // FASE 0: CORS universal para desarrollo
  app.use(cors({ origin: '*', credentials: true }));

  // gzip/brotli en todas las respuestas — las de listados (evolution,
  // achievements, etc.) son JSON repetitivo, comprimen muy bien.
  app.use(compression());

  // Webhooks de proveedores de pago — DEBEN montarse antes del express.json()
  // global de abajo: cada proveedor exige el body crudo (sin parsear) para
  // verificar su firma/checksum (ver *-webhook.routes.ts, que traen su
  // propio express.raw()).
  app.use('/api/stripe', stripeWebhookRouter);
  app.use('/api/wompi', wompiWebhookRouter);
  app.use('/api/webhooks/wearable', wearableWebhookRouter);

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ success: true, status: 'ok' });
  });

  app.use('/api', configRouter);
  app.use('/api', geoRouter);
  app.use('/api', adminPhrasesRouter);
  app.use('/api', adminQuotesRouter);
  app.use('/api', restToolsRouter);
  app.use('/api', adminCortisolTipsRouter);
  app.use('/api', adminNutritionTipsRouter);
  app.use('/api', recipesRouter);
  app.use('/api', eventsRouter);
  app.use('/api', therapiesRouter);
  app.use('/api', retreatsRouter);
  app.use('/api', evolutionRouter);
  app.use('/api', wellnessIndexRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/clients', personalInfoRouter);
  app.use('/api/clients', exercisesRouter);
  app.use('/api/clients', trainingRouter);
  app.use('/api/clients', nutritionRouter);
  app.use('/api/clients', supplementsRouter);
  app.use('/api/clients', cortisolTechniquesRouter);
  app.use('/api/clients', cortisolLogsRouter);
  app.use('/api/clients', cognitiveLoadRouter);
  app.use('/api/clients', sleepRouter);
  app.use('/api/clients', labPanelsRouter);
  app.use('/api/clients', insightsRouter);
  app.use('/api/clients', checkinsRouter);
  app.use('/api/clients', wearableRouter);
  app.use('/api/wearable', wearableOAuthRouter);
  app.use('/api/blindspot', blindspotRouter);
  app.use('/api', rolesRouter);
  app.use('/api', adminNotificationsRouter);
  app.use('/api/clients', clientNotificationsRouter);
  app.use('/api/account', accountRouter);
  app.use('/api', membershipPricesRouter);

  // Error handler
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  });

  // 404 catch-all
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
  });

  return app;
}