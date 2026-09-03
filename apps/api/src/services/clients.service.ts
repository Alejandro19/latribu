import { eq, desc, sql, inArray, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, personalInfo, bioInbodyRecords, labPanels, wearableMetricas, type Client } from '../models/schema.js';
import { hashPassword } from './auth.service.js';
import { findAdminByEmail } from './admins.service.js';
import { createInvitation } from './client-invitations.service.js';
import { sendClientInvitationEmail } from './password-reset.service.js';

export async function findClientByEmail(email: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findClientById(id: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0] ?? null;
}

// Respaldo de findClientByEmail para el login por Google/Apple — si el
// cliente cambió su correo desde el panel de cuenta, el email real que
// entrega el proveedor SSO ya no coincide con el guardado, pero el
// googleId/appleId vinculado sigue siendo el mismo (ver googleLogin/
// appleLogin en auth.controller.ts).
export async function findClientByGoogleId(googleId: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.googleId, googleId)).limit(1);
  return rows[0] ?? null;
}

export async function findClientByAppleId(appleId: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.appleId, appleId)).limit(1);
  return rows[0] ?? null;
}

export type ClientAuthRow = {
  id: string;
  status: string;
  clientType: string;
  permissions: Record<string, boolean>;
  planEndDate: string | null;
};

export async function findClientAuthRowById(id: string): Promise<ClientAuthRow | null> {
  const rows = await db
    .select({
      id: clients.id,
      status: clients.status,
      clientType: clients.clientType,
      permissions: clients.permissions,
      planEndDate: clients.planEndDate,
    })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return (rows[0] as ClientAuthRow | undefined) ?? null;
}

export async function updateClientPassword(id: string, passwordHash: string): Promise<void> {
  // Cualquier cambio de contraseña (change-password normal o reset por token)
  // satisface la obligación de la temporal — se limpia acá para no duplicar
  // esta lógica en cada endpoint que termina llamando esta función.
  await db.update(clients).set({ passwordHash, mustChangePassword: false }).where(eq(clients.id, id));
}

export async function updateClientGoogleId(id: string, googleId: string): Promise<void> {
  await db.update(clients).set({ googleId }).where(eq(clients.id, id));
}

export async function updateClientAppleId(id: string, appleId: string): Promise<void> {
  await db.update(clients).set({ appleId }).where(eq(clients.id, id));
}

export class ClientEmailTakenError extends Error {
  constructor() {
    super('Ese email ya está registrado.');
    this.name = 'ClientEmailTakenError';
  }
}

// Indicadores de onboarding Mentoría para la lista de admin, sin abrir cada
// ficha individual (ver plan). Solo se calculan para mentoring — el resto
// queda con valores vacíos/null, que el frontend renderiza como "-".
export type ClientWithOnboardingIndicators = Client & {
  baselineComplete: boolean;
  wearableDaysConDatos: number | null;
  labWeek0Status: string | null;
};

export async function listClients(): Promise<ClientWithOnboardingIndicators[]> {
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));
  const mentoringIds = rows.filter((c) => c.clientType === 'mentoring').map((c) => c.id);
  if (mentoringIds.length === 0) {
    return rows.map((c) => ({ ...c, baselineComplete: false, wearableDaysConDatos: null, labWeek0Status: null }));
  }

  const [infoRows, inbodyRows, labRows, wearableRows] = await Promise.all([
    db.select({ clientId: personalInfo.clientId, completedAt: personalInfo.completedAt }).from(personalInfo).where(inArray(personalInfo.clientId, mentoringIds)),
    db.select({ clientId: bioInbodyRecords.clientId }).from(bioInbodyRecords).where(inArray(bioInbodyRecords.clientId, mentoringIds)),
    db.select({ clientId: labPanels.clientId, status: labPanels.status }).from(labPanels).where(and(inArray(labPanels.clientId, mentoringIds), eq(labPanels.semanaNumero, 0))),
    db
      .select({ clientId: wearableMetricas.clientId, dias: sql<number>`count(distinct ${wearableMetricas.fecha})` })
      .from(wearableMetricas)
      .where(inArray(wearableMetricas.clientId, mentoringIds))
      .groupBy(wearableMetricas.clientId),
  ]);

  const completedAtById = new Map(infoRows.map((r) => [r.clientId, !!r.completedAt]));
  const inbodyIds = new Set(inbodyRows.map((r) => r.clientId));
  const labStatusById = new Map(labRows.map((r) => [r.clientId, r.status]));
  const wearableDaysById = new Map(wearableRows.map((r) => [r.clientId, Number(r.dias) || 0]));

  return rows.map((c) => {
    if (c.clientType !== 'mentoring') return { ...c, baselineComplete: false, wearableDaysConDatos: null, labWeek0Status: null };
    return {
      ...c,
      baselineComplete: !!completedAtById.get(c.id) && inbodyIds.has(c.id),
      wearableDaysConDatos: c.wearableBaselineReadyAt ? null : (wearableDaysById.get(c.id) ?? 0),
      labWeek0Status: labStatusById.get(c.id) ?? null,
    };
  });
}

export type CreateClientInput = {
  name: string;
  email: string;
  password?: string;
  plan?: string;
  mustChangePassword?: boolean;
  client_type?: string;
};

export async function createClient(input: CreateClientInput): Promise<Client> {
  const emailLower = input.email.toLowerCase().trim();
  const [existingClient, existingAdmin] = await Promise.all([
    findClientByEmail(emailLower),
    findAdminByEmail(emailLower),
  ]);
  if (existingClient || existingAdmin) throw new ClientEmailTakenError();

  const isMentoring = input.client_type === 'mentoring';

  // Mentoría: sin contraseña asignada a mano — se crea con passwordHash NULL
  // y se invita por correo (ver client-invitations.service.ts). Cliente 1:1
  // conserva el alta manual existente, sin cambios.
  const passwordHash = isMentoring ? null : await hashPassword(input.password!);
  const [client] = await db
    .insert(clients)
    .values({
      name: input.name,
      email: emailLower,
      passwordHash,
      plan: input.plan || 'Miembro',
      clientType: input.client_type ?? 'coaching_1_1',
      mustChangePassword: isMentoring ? true : (input.mustChangePassword ?? false),
    })
    .returning();

  if (isMentoring) {
    const webBaseUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
    const rawToken = await createInvitation(client.id);
    await sendClientInvitationEmail(client.email, client.name, `${webBaseUrl}/invitacion?token=${rawToken}`);
  }

  return client;
}

export async function updateClient(id: string, patch: Record<string, unknown>): Promise<Client | null> {
  let normalizedPatch = patch;
  if (typeof patch.email === 'string') {
    const emailLower = patch.email.toLowerCase().trim();
    const [existingClient, existingAdmin] = await Promise.all([
      findClientByEmail(emailLower),
      findAdminByEmail(emailLower),
    ]);
    if ((existingClient && existingClient.id !== id) || existingAdmin) throw new ClientEmailTakenError();
    normalizedPatch = { ...patch, email: emailLower };
  }
  const [client] = await db
    .update(clients)
    .set({ ...normalizedPatch, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return client ?? null;
}

export async function updatePermissions(id: string, permissions: Record<string, boolean>): Promise<Client | null> {
  return updateClient(id, { permissions });
}

export async function updateStatus(id: string, status: 'active' | 'inactive'): Promise<Client | null> {
  // Activar (inactive -> active) es el único momento en que se asigna el
  // número de miembro — de forma atómica vía secuencia de Postgres dentro de
  // una transacción, para que dos activaciones concurrentes nunca choquen.
  // Idempotente: si el cliente ya tenía número (se desactivó y se reactiva),
  // no se vuelve a asignar ni se pisa activatedAt.
  return db.transaction(async (tx) => {
    if (status === 'active') {
      const [existing] = await tx.select({ memberNumber: clients.memberNumber }).from(clients).where(eq(clients.id, id)).limit(1);
      if (existing && existing.memberNumber == null) {
        const [client] = await tx
          .update(clients)
          .set({
            status,
            memberNumber: sql`nextval('member_number_seq')`,
            activatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clients.id, id))
          .returning();
        return client ?? null;
      }
    }
    const [client] = await tx
      .update(clients)
      .set({ status, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return client ?? null;
  });
}

export async function updateClientType(id: string, clientType: string): Promise<Client | null> {
  return updateClient(id, { clientType });
}

// Único consumidor: el webhook de Stripe (stripe-webhook.controller.ts),
// tras confirmar el pago. Reutiliza updateStatus/updateClientType/renewPlan
// EN SECUENCIA en vez de reimplementar la lógica de activación — es el
// mismo resultado final que produce hoy la aprobación manual en efectivo
// (AdminClientDetail.handleActivate) más el vencimiento, que ese flujo
// nunca seteaba.
export async function activatePaidPlan(
  id: string,
  input: { clientType: string; durationDays: number; packageSize?: number }
): Promise<Client | null> {
  await updateStatus(id, 'active');
  await updateClientType(id, input.clientType);
  // Solo Presencial vende por paquete de clases — fija el saldo vigente al
  // tamaño comprado (ver training.service.ts::confirmSession, que lo descuenta).
  if (input.packageSize != null) {
    await updateClient(id, { sessionsTotal: input.packageSize, sessionsRemaining: input.packageSize });
  }
  return renewPlan(id, { duration_days: input.durationDays });
}

export async function renewPlan(id: string, input: { plan_start_date: string; plan_end_date: string } | { duration_days: number }): Promise<Client | null> {
  if ('plan_start_date' in input) {
    if (input.plan_end_date <= input.plan_start_date) {
      throw new InvalidPlanDatesError();
    }
    const days = Math.round((new Date(input.plan_end_date).getTime() - new Date(input.plan_start_date).getTime()) / 86400000);
    return updateClient(id, {
      planDurationDays: days,
      planStartDate: input.plan_start_date,
      planEndDate: input.plan_end_date,
    });
  }
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + input.duration_days);
  return updateClient(id, {
    planDurationDays: input.duration_days,
    planStartDate: today.toISOString().slice(0, 10),
    planEndDate: endDate.toISOString().slice(0, 10),
  });
}

// Idempotente: si ya había una solicitud pendiente, no pisa la fecha
// original. No borra ni pausa nada por sí sola — solo la hace visible para
// que un admin revise y contacte al cliente (ver panel admin/clientes).
export async function requestAccountDeletion(id: string): Promise<Client | null> {
  const existing = await findClientById(id);
  if (!existing) return null;
  if (existing.deletionRequestedAt) return existing;
  const [client] = await db
    .update(clients)
    .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return client ?? null;
}

export async function resolveDeletionRequest(id: string): Promise<Client | null> {
  return updateClient(id, { deletionRequestedAt: null });
}

export class InvalidPlanDatesError extends Error {
  constructor() {
    super('La fecha de vencimiento debe ser posterior a la de inicio.');
    this.name = 'InvalidPlanDatesError';
  }
}
