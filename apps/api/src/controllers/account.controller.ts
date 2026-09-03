import type { Request, Response } from 'express';
import type { LegalAcceptanceInput, NotificationPreferencesPatch, LanguagePatch, MembershipCheckoutInput } from '@latribu/shared-types';
import * as accountService from '../services/account.service.js';
import { TrmUnavailableError } from '../services/trm.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function getLegalAcceptance(req: Request, res: Response) {
  const acceptance = await accountService.getLatestLegalAcceptance(req.user!.id);
  return ok(res, { acceptance });
}

export async function postLegalAcceptance(req: Request, res: Response) {
  const input = req.body as LegalAcceptanceInput;
  await accountService.submitLegalAcceptance(req.user!.id, input);
  return ok(res, { message: 'Autorización actualizada.' }, 201);
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) return err(res, 'No se recibió ninguna imagen.');
  if (req.file.mimetype !== 'image/jpeg' && req.file.mimetype !== 'image/png') {
    return err(res, 'Formato inválido. Usa JPG o PNG.');
  }
  const client = await accountService.uploadAvatar(req.user!.id, req.file);
  return ok(res, { client });
}

export async function patchNotificationPreferences(req: Request, res: Response) {
  const patch = req.body as NotificationPreferencesPatch;
  const client = await accountService.updateNotificationPreferences(req.user!.id, patch);
  return ok(res, { client });
}

export async function patchLanguage(req: Request, res: Response) {
  const { language } = req.body as LanguagePatch;
  const client = await accountService.updateLanguage(req.user!.id, language);
  return ok(res, { client });
}

export async function postDeletionRequest(req: Request, res: Response) {
  const client = await accountService.requestDeletion(req.user!.id);
  return ok(res, { client, message: 'Solicitud enviada. Un asesor te contactará antes de los 15 días hábiles.' });
}

export async function getExport(req: Request, res: Response) {
  const data = await accountService.exportAccountData(req.user!.id);
  if (!data) return err(res, 'No encontrado.', 404);
  return ok(res, { data });
}

export async function postMembershipCheckout(req: Request, res: Response) {
  const { client_type, duration_months, package_size } = req.body as MembershipCheckoutInput;
  try {
    const checkout = await accountService.createMembershipCheckout(req.user!.id, {
      clientType: client_type,
      durationMonths: duration_months,
      packageSize: package_size,
    });
    return ok(res, checkout, 201);
  } catch (e) {
    if (e instanceof accountService.PriceNotConfiguredError) return err(res, e.message, 409);
    if (e instanceof accountService.ProviderUnavailableError) return err(res, e.message, 503);
    // Nunca un valor de TRM inventado — error claro en el botón de pago.
    if (e instanceof TrmUnavailableError) return err(res, e.message, 503);
    throw e;
  }
}

export async function getMembershipPaymentStatus(req: Request, res: Response) {
  const status = await accountService.getMembershipPaymentStatus(req.user!.id, req.params.id);
  if (!status) return err(res, 'Pago no encontrado.', 404);
  return ok(res, status);
}

export async function getMembershipProviders(_req: Request, res: Response) {
  const providers = accountService.getAvailableProviders();
  return ok(res, { providers });
}
