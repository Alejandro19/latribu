import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { clients, clientNotifications, labPanels } from '../src/models/schema.js';
import { signToken } from '../src/services/auth.service.js';

describe('onboarding approvals (baseline / wearable) + activación de Semana 1', () => {
  const app = createApp();
  const adminToken = signToken({ id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com' });
  let clientId: string;

  beforeAll(async () => {
    const [client] = await db
      .insert(clients)
      .values({ name: 'Approvals Client', email: `approvals-${Date.now()}@example.com`, status: 'active', clientType: 'mentoring' })
      .returning();
    clientId = client.id;
  });

  afterAll(async () => {
    await db.delete(clients).where(eq(clients.id, clientId));
  });

  afterEach(async () => {
    await db.delete(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    await db.delete(labPanels).where(eq(labPanels.clientId, clientId));
    await db
      .update(clients)
      .set({ baselineApprovedAt: null, wearableApprovedAt: null, wearableBaselineReadyAt: null, week1ActivatedAt: null })
      .where(eq(clients.id, clientId));
  });

  it('approves baseline and sends a client notification', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/onboarding/approve-baseline`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.client.baselineApprovedAt).not.toBeNull();

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('baseline'))).toBe(true);
  });

  it('rejects approving wearable before the 7-day minimum is reached', async () => {
    const res = await request(app)
      .post(`/api/clients/${clientId}/onboarding/approve-wearable`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('approves wearable once wearableBaselineReadyAt is set, and sends a notification', async () => {
    await db.update(clients).set({ wearableBaselineReadyAt: new Date() }).where(eq(clients.id, clientId));
    const res = await request(app)
      .post(`/api/clients/${clientId}/onboarding/approve-wearable`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.client.wearableApprovedAt).not.toBeNull();

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('wearable'))).toBe(true);
  });

  it('activates Semana 1 exactly once baseline + wearable + laboratorio semana 0 are all approved', async () => {
    await db.update(clients).set({ wearableBaselineReadyAt: new Date() }).where(eq(clients.id, clientId));
    await db.insert(labPanels).values({ clientId, semanaNumero: 0, datos: { cortisol: 15 } });

    await request(app).post(`/api/clients/${clientId}/onboarding/approve-baseline`).set('Authorization', `Bearer ${adminToken}`);
    let [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.week1ActivatedAt).toBeNull(); // solo 1 de 3 aprobado todavía.

    await request(app).post(`/api/clients/${clientId}/onboarding/approve-wearable`).set('Authorization', `Bearer ${adminToken}`);
    [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.week1ActivatedAt).toBeNull(); // 2 de 3 todavía.

    const approveLabRes = await request(app)
      .post(`/api/clients/${clientId}/lab-panels/0/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(approveLabRes.status).toBe(200);

    [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(client.week1ActivatedAt).not.toBeNull();

    const notifications = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    expect(notifications.some((n) => n.message.includes('Semana 1'))).toBe(true);

    // Idempotente: aprobar de nuevo (ej. re-consultar) no debe duplicar la notificación de Semana 1.
    const week1NotificationsBefore = notifications.filter((n) => n.message.includes('Semana 1')).length;
    await request(app).post(`/api/clients/${clientId}/onboarding/approve-baseline`).set('Authorization', `Bearer ${adminToken}`);
    const notificationsAfter = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId));
    const week1NotificationsAfter = notificationsAfter.filter((n) => n.message.includes('Semana 1')).length;
    expect(week1NotificationsAfter).toBe(week1NotificationsBefore);
  });

  it('a non-admin cannot approve baseline or wearable', async () => {
    const clientToken = signToken({ id: clientId, role: 'cliente', name: 'x', email: 'x@x.com', clientType: 'mentoring' });
    const res1 = await request(app).post(`/api/clients/${clientId}/onboarding/approve-baseline`).set('Authorization', `Bearer ${clientToken}`);
    expect(res1.status).toBe(403);
    const res2 = await request(app).post(`/api/clients/${clientId}/onboarding/approve-wearable`).set('Authorization', `Bearer ${clientToken}`);
    expect(res2.status).toBe(403);
  });
});
