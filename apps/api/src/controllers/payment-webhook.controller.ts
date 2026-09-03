import type { Request, RequestHandler, Response } from 'express';
import { PAYABLE_CLIENT_TYPES } from '@latribu/shared-types';
import { db } from '../db/index.js';
import { adminNotifications } from '../models/schema.js';
import { getProvider } from '../services/payment-providers/index.js';
import type { SupportedProvider } from '../services/payment-providers/index.js';
import * as membershipPaymentsService from '../services/membership-payments.service.js';
import * as clientsService from '../services/clients.service.js';

// Fábrica compartida por todos los proveedores — la MISMA función interna de
// activar membresía (clientsService.activatePaidPlan) se dispara sin
// importar de qué proveedor vino el webhook, una vez verificada su firma
// propia (provider.verifyWebhook). req.body acá siempre es el buffer crudo
// (ver stripe-webhook.routes.ts / wompi-webhook.routes.ts, montados con
// express.raw() antes del express.json() global de app.ts) — cada proveedor
// exige el body sin parsear para poder verificar su firma/checksum.
export function createWebhookHandler(providerName: SupportedProvider): RequestHandler {
  return async (req: Request, res: Response) => {
    const provider = getProvider(providerName);
    const result = provider.verifyWebhook(req.body, req.headers as Record<string, string | string[] | undefined>);

    if (!result.valid) {
      return res.status(400).json({ success: false, error: 'Firma inválida.' });
    }
    if (!result.actionable) {
      return res.status(200).json({ received: true });
    }

    if (result.approved) {
      const payment = await membershipPaymentsService.findByProviderReference(providerName, result.providerReference);
      // Idempotente: si ya estaba 'succeeded' (cualquier proveedor puede
      // reenviar el mismo evento más de una vez), no se vuelve a procesar.
      if (payment && payment.status !== 'succeeded') {
        await membershipPaymentsService.markSucceeded(payment.id);

        const client = await clientsService.findClientById(payment.clientId);
        // "Veterano" = ya tenía una membresía activa en un tier pagable al
        // momento del pago (upgrade/renovación) → activa directo. Si nunca
        // tuvo una membresía paga activa (Explorador, o pendiente de
        // aprobación) — su primer pago — pasa por la misma cola de
        // aprobación manual que ya existe para efectivo, aunque el pago ya
        // esté confirmado por el proveedor.
        const isVeteran =
          client != null &&
          client.status === 'active' &&
          (PAYABLE_CLIENT_TYPES as readonly string[]).includes(client.clientType);

        if (isVeteran) {
          const isTypeChange = client!.clientType !== payment.clientType;
          const durationDays = payment.durationMonths === 1 ? 30 : 90;
          await clientsService.activatePaidPlan(payment.clientId, {
            clientType: payment.clientType,
            durationDays,
            packageSize: payment.packageSize ?? undefined,
          });
          await membershipPaymentsService.markApplied(payment.id);
          // Renovación del mismo tier no es noticia — solo se avisa al admin
          // cuando el pago cambió el tipo de membresía (upgrade), ya
          // aplicado automáticamente sin que el admin tuviera que aprobarlo.
          if (isTypeChange) {
            await db.insert(adminNotifications).values({
              clientId: payment.clientId,
              type: 'membership_upgrade_applied',
              message: `${client!.name} cambió su membresía de ${client!.clientType} a ${payment.clientType} (upgrade automático, ya activo).`,
            });
          }
        } else {
          await membershipPaymentsService.markRequiresApproval(payment.id);
          await db.insert(adminNotifications).values({
            clientId: payment.clientId,
            type: 'membership_payment_pending_approval',
            message: `${client?.name ?? 'Un cliente'} pagó su primera membresía (${payment.clientType}) — pendiente de aprobación.`,
          });
        }
      }
    }

    return res.status(200).json({ received: true });
  };
}
