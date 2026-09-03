import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { eventReservations, communityEvents, therapyReservations, communityTherapies, retreatReservations, communityRetreats, clients, personalInfo } from '../models/schema.js';

function formatPhone(phoneCode: string | null, phoneNumber: string | null): string | null {
  const number = (phoneNumber || '').trim();
  if (!number) return null;
  const alreadyHasCode = !phoneCode || number.startsWith('+') || number.startsWith(phoneCode);
  return alreadyHasCode ? number : [phoneCode, number].filter(Boolean).join(' ');
}

export async function getConfirmedReservations() {
  const eventRows = await db
    .select({
      id: eventReservations.id,
      createdAt: eventReservations.createdAt,
      clientId: eventReservations.clientId,
      eventId: eventReservations.eventId,
      clientName: clients.name,
      eventTitle: communityEvents.title,
      eventDate: communityEvents.eventDate,
      eventLocation: communityEvents.location,
    })
    .from(eventReservations)
    .leftJoin(clients, eq(eventReservations.clientId, clients.id))
    .leftJoin(communityEvents, eq(eventReservations.eventId, communityEvents.id))
    .where(eq(eventReservations.status, 'confirmada'));

  const therapyRows = await db
    .select({
      id: therapyReservations.id,
      createdAt: therapyReservations.createdAt,
      clientId: therapyReservations.clientId,
      therapyId: therapyReservations.therapyId,
      clientName: clients.name,
      therapyTitle: communityTherapies.title,
      therapyProvider: communityTherapies.provider,
      therapyDiscountPct: communityTherapies.discountPct,
    })
    .from(therapyReservations)
    .leftJoin(clients, eq(therapyReservations.clientId, clients.id))
    .leftJoin(communityTherapies, eq(therapyReservations.therapyId, communityTherapies.id))
    .where(eq(therapyReservations.status, 'confirmada'));

  const retreatRows = await db
    .select({
      id: retreatReservations.id,
      createdAt: retreatReservations.createdAt,
      clientId: retreatReservations.clientId,
      retreatId: retreatReservations.retreatId,
      clientName: clients.name,
      retreatTitle: communityRetreats.title,
      retreatStartDate: communityRetreats.startDate,
      retreatEndDate: communityRetreats.endDate,
      retreatLocation: communityRetreats.location,
    })
    .from(retreatReservations)
    .leftJoin(clients, eq(retreatReservations.clientId, clients.id))
    .leftJoin(communityRetreats, eq(retreatReservations.retreatId, communityRetreats.id))
    .where(eq(retreatReservations.status, 'confirmada'));

  const clientIds = Array.from(new Set([...eventRows.map((r) => r.clientId), ...therapyRows.map((r) => r.clientId), ...retreatRows.map((r) => r.clientId)]));
  const phoneByClientId = new Map<string, string | null>();
  if (clientIds.length > 0) {
    const infoRows = await db.select().from(personalInfo);
    for (const row of infoRows) {
      if (clientIds.includes(row.clientId)) {
        phoneByClientId.set(row.clientId, formatPhone(row.phoneCode, row.phoneNumber));
      }
    }
  }

  return {
    eventReservations: eventRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      clientName: r.clientName || 'Cliente eliminado',
      clientPhone: phoneByClientId.get(r.clientId) ?? null,
      eventId: r.eventId,
      eventTitle: r.eventTitle || 'Evento eliminado',
      eventDate: r.eventDate,
      eventLocation: r.eventLocation,
    })),
    therapyReservations: therapyRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      clientName: r.clientName || 'Cliente eliminado',
      clientPhone: phoneByClientId.get(r.clientId) ?? null,
      therapyId: r.therapyId,
      therapyTitle: r.therapyTitle || 'Terapia eliminada',
      therapyProvider: r.therapyProvider,
      therapyDiscountPct: r.therapyDiscountPct,
    })),
    retreatReservations: retreatRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      clientName: r.clientName || 'Cliente eliminado',
      clientPhone: phoneByClientId.get(r.clientId) ?? null,
      retreatId: r.retreatId,
      retreatTitle: r.retreatTitle || 'Retiro eliminado',
      retreatStartDate: r.retreatStartDate,
      retreatEndDate: r.retreatEndDate,
      retreatLocation: r.retreatLocation,
    })),
  };
}