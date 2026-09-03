import type { Request, Response } from 'express';
import type {
  ClientCreateInput,
  ClientUpdateInput,
  PermissionsPatch,
  StatusPatch,
  ClientTypePatch,
  RenewPlanPatch,
} from '@latribu/shared-types';
import * as clientsService from '../services/clients.service.js';
import * as membershipPaymentsService from '../services/membership-payments.service.js';
import * as clientInvitationsService from '../services/client-invitations.service.js';
import { sendClientInvitationEmail } from '../services/password-reset.service.js';
import * as onboardingApprovalsService from '../services/onboarding-approvals.service.js';

function ok(res: Response, data: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, ...data });
}
function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

export async function listClients(_req: Request, res: Response) {
  const clients = await clientsService.listClients();
  return ok(res, { clients });
}

export async function createClient(req: Request, res: Response) {
  const input = req.body as ClientCreateInput;
  try {
    const client = await clientsService.createClient(input);
    return ok(res, { client }, 201);
  } catch (e) {
    if (e instanceof clientsService.ClientEmailTakenError) return err(res, e.message, 409);
    throw e;
  }
}

export async function getClient(req: Request, res: Response) {
  const client = await clientsService.findClientById(req.params.id);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  // Señal explícita para el botón "Reenviar invitación" — no se infiere de
  // passwordHash === null en el frontend porque esa condición también es
  // cierta para clientes SSO-only, que nunca deben ver ese botón.
  const hasPendingInvitation = await clientInvitationsService.hasPendingInvitation(client.id);
  return ok(res, { client: { ...client, hasPendingInvitation } });
}

export async function updateClient(req: Request, res: Response) {
  const patch = req.body as ClientUpdateInput;
  try {
    const client = await clientsService.updateClient(req.params.id, patch);
    if (!client) return err(res, 'Cliente no encontrado.', 404);
    return ok(res, { client });
  } catch (e) {
    if (e instanceof clientsService.ClientEmailTakenError) return err(res, e.message, 409);
    throw e;
  }
}

export async function updatePermissions(req: Request, res: Response) {
  const { permissions } = req.body as PermissionsPatch;
  const client = await clientsService.updatePermissions(req.params.id, permissions);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = req.body as StatusPatch;
  const client = await clientsService.updateStatus(req.params.id, status);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function updateClientType(req: Request, res: Response) {
  const { client_type } = req.body as ClientTypePatch;
  const client = await clientsService.updateClientType(req.params.id, client_type);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

// Invalida cualquier invitación anterior sin usar y manda una nueva —
// visible en la ficha del cliente solo mientras nunca haya creado su
// contraseña (ver hasPendingInvitation, distingue de clientes SSO-only).
export async function resendInvitation(req: Request, res: Response) {
  const client = await clientsService.findClientById(req.params.id);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  if (client.passwordHash) return err(res, 'Este cliente ya creó su contraseña.', 409);

  const webBaseUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
  const rawToken = await clientInvitationsService.resendInvitation(client.id);
  await sendClientInvitationEmail(client.email, client.name, `${webBaseUrl}/invitacion?token=${rawToken}`);
  return ok(res, { message: 'Invitación reenviada.' });
}

export async function approveBaseline(req: Request, res: Response) {
  const client = await onboardingApprovalsService.approveBaseline(req.params.id);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

export async function approveWearable(req: Request, res: Response) {
  try {
    const client = await onboardingApprovalsService.approveWearable(req.params.id);
    if (!client) return err(res, 'Cliente no encontrado.', 404);
    return ok(res, { client });
  } catch (e) {
    if (e instanceof onboardingApprovalsService.WearableNotReadyError) return err(res, e.message, 409);
    throw e;
  }
}

export async function resolveDeletionRequest(req: Request, res: Response) {
  const client = await clientsService.resolveDeletionRequest(req.params.id);
  if (!client) return err(res, 'Cliente no encontrado.', 404);
  return ok(res, { client });
}

// Historial de pagos del cliente — auditoría, sin ningún control de
// override de fecha/sesiones (decisión explícita de Alejandro).
export async function getMembershipPayments(req: Request, res: Response) {
  const payments = await membershipPaymentsService.findAllByClientId(req.params.id);
  return ok(res, { payments });
}

// Única forma de activar una membresía cuyo pago quedó pendiente de
// aprobación (cliente sin membresía paga previa) — reusa la MISMA
// activatePaidPlan que ya dispara el webhook para un cliente veterano.
export async function approveMembershipPayment(req: Request, res: Response) {
  const payment = await membershipPaymentsService.findById(req.params.paymentId);
  if (!payment || payment.clientId !== req.params.id) return err(res, 'Pago no encontrado.', 404);
  if (!payment.requiresApproval || payment.appliedAt) return err(res, 'Este pago no está pendiente de aprobación.', 409);

  const durationDays = payment.durationMonths === 1 ? 30 : 90;
  const client = await clientsService.activatePaidPlan(payment.clientId, {
    clientType: payment.clientType,
    durationDays,
    packageSize: payment.packageSize ?? undefined,
  });
  await membershipPaymentsService.markApplied(payment.id);
  return ok(res, { client });
}

export async function renewPlan(req: Request, res: Response) {
  const input = req.body as RenewPlanPatch;
  try {
    const client = await clientsService.renewPlan(req.params.id, input);
    if (!client) return err(res, 'Cliente no encontrado.', 404);
    return ok(res, { client });
  } catch (e) {
    if (e instanceof clientsService.InvalidPlanDatesError) return err(res, e.message, 400);
    throw e;
  }
}
