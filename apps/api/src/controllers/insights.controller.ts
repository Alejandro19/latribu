import type { Request, Response } from 'express';
import { evaluateInsights, NotMentoringClientError } from '../services/insights/engine.js';

export async function getInsights(req: Request, res: Response) {
  try {
    const result = await evaluateInsights(req.params.id);
    return res.status(200).json({ success: true, applicable: true, ...result });
  } catch (error) {
    // Un admin puede pedir insights de cualquier cliente (mentoringOnly no lo
    // bloquea a él) — para un cliente no-Mentoría esto es el caso normal, no
    // un error: los 5 paneles admin compartidos montan esta sección siempre,
    // sin saber de antemano el tier del cliente seleccionado.
    if (error instanceof NotMentoringClientError) {
      return res.status(200).json({ success: true, applicable: false });
    }
    throw error;
  }
}
