import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communityEvents, eventReservations, type CommunityEvent, type EventReservation } from '../models/schema.js';
import { CommunityEventInput } from '@latribu/shared-types';

export async function listActiveEventsWithCounts(): Promise<Array<CommunityEvent & { confirmedCount: number }>> {
  const events = await db.select().from(communityEvents).where(eq(communityEvents.active, true)).orderBy(asc(communityEvents.eventDate));
  if (events.length === 0) return [];
  const confirmed = await db.select().from(eventReservations).where(eq(eventReservations.status, 'confirmada'));
  const countByEvent = new Map<string, number>();
  for (const r of confirmed) countByEvent.set(r.eventId, (countByEvent.get(r.eventId) ?? 0) + 1);
  return events.map((e) => ({ ...e, confirmedCount: countByEvent.get(e.id) ?? 0 }));
}

export async function createEvent(input: CommunityEventInput): Promise<CommunityEvent> {
  const [event] = await db.insert(communityEvents).values({
    title: input.title,
    description: input.description ?? null,
    eventDate: input.event_date ? new Date(input.event_date) : null,
    location: input.location ?? null,
    capacity: input.capacity ?? null,
    imageUrl: input.image_url ?? null,
    active: input.active ?? true,
    sortOrder: input.sort_order ?? 0,
  }).returning();
  return event;
}

export async function updateEvent(eventId: string, input: Partial<CommunityEventInput>): Promise<CommunityEvent | null> {
  const [event] = await db.update(communityEvents).set({
    title: input.title ?? undefined,
    description: input.description ?? undefined,
    eventDate: input.event_date ? new Date(input.event_date) : null,
    location: input.location ?? undefined,
    capacity: input.capacity ?? undefined,
    imageUrl: input.image_url ?? undefined,
    active: input.active ?? undefined,
    sortOrder: input.sort_order ?? undefined,
  }).where(eq(communityEvents.id, eventId)).returning();
  return event ?? null;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await db.delete(communityEvents).where(eq(communityEvents.id, eventId));
}

export async function reserveEvent(eventId: string, clientId: string): Promise<{ reservation: EventReservation | null; conflict: boolean }> {
  const existing = await db
    .select()
    .from(eventReservations)
    .where(and(eq(eventReservations.eventId, eventId), eq(eventReservations.clientId, clientId)));
  if (existing[0]?.status === 'confirmada') return { reservation: null, conflict: true };

  if (existing[0]) {
    const [reservation] = await db
      .update(eventReservations)
      .set({ status: 'confirmada' })
      .where(eq(eventReservations.id, existing[0].id))
      .returning();
    return { reservation, conflict: false };
  }
  const [reservation] = await db.insert(eventReservations).values({ eventId, clientId }).returning();
  return { reservation, conflict: false };
}

export async function cancelEventReservation(eventId: string, clientId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(eventReservations)
    .where(and(eq(eventReservations.eventId, eventId), eq(eventReservations.clientId, clientId), eq(eventReservations.status, 'confirmada')));
  if (!existing[0]) return false;
  await db.update(eventReservations).set({ status: 'cancelada' }).where(eq(eventReservations.id, existing[0].id));
  return true;
}

export async function listClientEventReservations(clientId: string): Promise<EventReservation[]> {
  return db.select().from(eventReservations).where(eq(eventReservations.clientId, clientId));
}