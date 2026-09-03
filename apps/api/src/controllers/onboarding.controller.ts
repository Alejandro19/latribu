import type { Request, Response } from 'express';
import * as onboardingService from '../services/onboarding.service.js';

export async function finalizeOnboarding(req: Request, res: Response) {
  const result = await onboardingService.finalizeOnboarding(req.params.id);
  if (!result.ok) {
    return res.status(400).json({ success: false, error: 'Faltan elementos obligatorios para completar el onboarding.', missing: result.missing });
  }
  return res.status(200).json({ success: true });
}
