import { Router } from 'express';

export const configRouter = Router();

configRouter.get('/config', (_req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || null;
  const appleClientId = process.env.APPLE_CLIENT_ID || null;
  const wearables = {
    garmin: false, // sin servicio implementado todavía (ver docs/errors-resueltos.md)
    whoop: !!process.env.WHOOP_CLIENT_ID,
    oura: !!process.env.OURA_CLIENT_ID,
    polar: !!process.env.POLAR_CLIENT_ID,
  };
  res.json({ success: true, googleClientId, appleClientId, wearables });
});
