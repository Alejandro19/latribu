import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  adminNotifications,
  clientNotifications,
  type AdminNotification,
  type ClientNotification,
} from '../models/schema.js';

export async function listAdminNotifications(): Promise<AdminNotification[]> {
  return db.select().from(adminNotifications).orderBy(desc(adminNotifications.createdAt));
}

export async function markAdminNotificationRead(id: string): Promise<AdminNotification | null> {
  const [updated] = await db
    .update(adminNotifications)
    .set({ read: true })
    .where(eq(adminNotifications.id, id))
    .returning();
  return updated ?? null;
}

export async function listClientNotifications(clientId: string): Promise<ClientNotification[]> {
  return db
    .select()
    .from(clientNotifications)
    .where(eq(clientNotifications.clientId, clientId))
    .orderBy(desc(clientNotifications.createdAt));
}

export async function markClientNotificationRead(
  clientId: string,
  notificationId: string
): Promise<ClientNotification | null> {
  const [updated] = await db
    .update(clientNotifications)
    .set({ read: true })
    .where(and(eq(clientNotifications.id, notificationId), eq(clientNotifications.clientId, clientId)))
    .returning();
  return updated ?? null;
}
