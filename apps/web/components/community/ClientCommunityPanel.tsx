'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { listEvents, reserveEvent, cancelEventReservation, listMyEventReservations } from '../../lib/events-client';
import { listTherapies, reserveTherapy, cancelTherapyReservation, listMyTherapyReservations } from '../../lib/therapies-client';
import { listRetreats, reserveRetreat, cancelRetreatReservation, listMyRetreatReservations } from '../../lib/retreats-client';
import { PermissionDeniedError } from '../../lib/api-client';
import { pickMantra } from '../../lib/mantra-bank';
import { formatEventDateTime } from '../../lib/community-logic';
import IdentityHeader from '../ui/IdentityHeader';
import MantraCard from '../ui/MantraCard';
import LockedBenefit from '../ui/LockedBenefit';
import EmptyState from '../ui/EmptyState';
import { IconFlame } from '../ui/icons';
import { EventCard, TherapyCard, RetreatCard } from './CommunityVisuals';
import Button from '../ui/Button';

function ReserveButton({ reserved, onReserve, onCancel }: { reserved: boolean; onReserve: () => void; onCancel: () => void }) {
  return reserved ? (
    <Button type="button" variant="secondary" onClick={onCancel} className="mt-4 w-full">
      Cancelar reserva
    </Button>
  ) : (
    <Button type="button" variant="primary" onClick={onReserve} className="mt-4 w-full">
      Reservar mi lugar
    </Button>
  );
}

async function fetchCommunityBundle(clientId: string) {
  const [eventsList, therapiesList, retreatsList, myEvents, myTherapies, myRetreats] = await Promise.all([
    listEvents(),
    listTherapies().catch(() => []),
    listRetreats().catch(() => []),
    listMyEventReservations(clientId).catch(() => []),
    listMyTherapyReservations(clientId).catch(() => []),
    listMyRetreatReservations(clientId).catch(() => []),
  ]);
  return {
    events: eventsList,
    therapies: therapiesList,
    retreats: retreatsList,
    myEventReservations: myEvents,
    myTherapyReservations: myTherapies,
    myRetreatReservations: myRetreats,
  };
}

export function ClientCommunityPanel({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<'events' | 'therapies' | 'retreats'>('events');
  const [mantra] = useState(() => pickMantra('community'));
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error: loadError, isLoading, mutate } = useSWR(['community-bundle', clientId], () =>
    fetchCommunityBundle(clientId),
  );

  async function handleReserveEvent(id: string) {
    try {
      await reserveEvent(id);
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function handleCancelEvent(id: string) {
    try {
      await cancelEventReservation(id);
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function handleReserveTherapy(id: string) {
    try {
      await reserveTherapy(id);
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function handleCancelTherapy(id: string) {
    try {
      await cancelTherapyReservation(id);
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function handleReserveRetreat(id: string) {
    try {
      await reserveRetreat(id);
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function handleCancelRetreat(id: string) {
    try {
      await cancelRetreatReservation(id);
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  const header = (
    <>
      <IdentityHeader title="The Circle" subtitle="Acceso reservado a quienes lideran al mismo nivel que tú." />
      {mantra && <MantraCard mantra={mantra} />}
    </>
  );

  if (isLoading) {
    return (
      <div>
        {header}
        <p className="text-sm text-[var(--eph-muted)]">Cargando The Circle…</p>
      </div>
    );
  }
  if (loadError && loadError instanceof PermissionDeniedError) {
    return (
      <div>
        {header}
        <LockedBenefit benefit="The Circle y sus beneficios" />
      </div>
    );
  }
  const error = actionError || (loadError ? (loadError as Error).message : null);
  if (error) {
    return (
      <div>
        {header}
        <p role="alert" className="font-body" style={{ color: 'var(--eph-danger)' }}>
          {error}
        </p>
      </div>
    );
  }
  if (!data) return null;

  const { events, therapies, retreats, myEventReservations, myTherapyReservations, myRetreatReservations } = data;
  const nextEvent = events[0];
  const nextEventConfirmed = nextEvent?.confirmed_count || 0;

  const eventsBody =
    events.length > 0 ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {events.map((ev) => (
          <EventCard
            key={ev.id}
            event={ev}
            action={
              <ReserveButton
                reserved={myEventReservations.some((r) => r.eventId === ev.id && r.status === 'confirmada')}
                onReserve={() => handleReserveEvent(ev.id)}
                onCancel={() => handleCancelEvent(ev.id)}
              />
            }
          />
        ))}
      </div>
    ) : (
      <EmptyState message="No hay eventos disponibles por ahora." />
    );

  const therapiesBody =
    therapies.length > 0 ? (
      <div className="space-y-4">
        {therapies.map((t) => (
          <TherapyCard
            key={t.id}
            therapy={t}
            action={
              <ReserveButton
                reserved={myTherapyReservations.some((r) => r.therapyId === t.id && r.status === 'confirmada')}
                onReserve={() => handleReserveTherapy(t.id)}
                onCancel={() => handleCancelTherapy(t.id)}
              />
            }
          />
        ))}
      </div>
    ) : (
      <EmptyState message="No hay terapias disponibles por ahora." />
    );

  const retreatsBody =
    retreats.length > 0 ? (
      <div className="space-y-4">
        {retreats.map((r) => (
          <RetreatCard
            key={r.id}
            retreat={r}
            action={
              <ReserveButton
                reserved={myRetreatReservations.some((res) => res.retreatId === r.id && res.status === 'confirmada')}
                onReserve={() => handleReserveRetreat(r.id)}
                onCancel={() => handleCancelRetreat(r.id)}
              />
            }
          />
        ))}
      </div>
    ) : (
      <EmptyState message="No hay retiros disponibles por ahora." />
    );

  return (
    <div>
      {header}

      <div
        className="relative mt-8 mb-6 overflow-hidden rounded-[0] p-7"
        style={{ background: 'var(--eph-surface)', color: 'var(--eph-text)' }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(217,183,126,.18) 0%, transparent 70%)' }}
        />
        <p className="relative z-10 mb-2 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-accent)' }}>{nextEvent ? 'Próximo evento' : 'The Circle'}</p>
        <p className="relative z-10 mb-1 font-display text-2xl font-normal">{nextEvent ? nextEvent.title : 'Aún no hay eventos programados'}</p>
        <p className="relative z-10 font-body text-sm" style={{ color: 'var(--eph-muted)' }}>
          {nextEvent
            ? `${formatEventDateTime(nextEvent.eventDate)}${nextEvent.location ? ' · ' + nextEvent.location : ''}`
            : 'Tu coach publicará el próximo evento pronto.'}
        </p>
        {nextEventConfirmed > 0 && (
          <p className="relative z-10 mt-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-accent)' }}>
            <IconFlame size={12} /> {nextEventConfirmed} persona{nextEventConfirmed === 1 ? '' : 's'} ya confirmaron su lugar
          </p>
        )}
      </div>

      <div className="mb-5 flex gap-2.5">
        <button
          type="button"
          onClick={() => setTab('events')}
          className="h-10 rounded-none px-5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors"
          style={tab === 'events'
            ? { background: 'var(--eph-accent)', color: 'var(--eph-ink)' }
            : { border: '1px solid var(--eph-line-2)', color: 'var(--eph-muted)' }}
        >
          Eventos
        </button>
        <button
          type="button"
          onClick={() => setTab('therapies')}
          className="h-10 rounded-none px-5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors"
          style={tab === 'therapies'
            ? { background: 'var(--eph-accent)', color: 'var(--eph-ink)' }
            : { border: '1px solid var(--eph-line-2)', color: 'var(--eph-muted)' }}
        >
          Terapias
        </button>
        <button
          type="button"
          onClick={() => setTab('retreats')}
          className="h-10 rounded-none px-5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors"
          style={tab === 'retreats'
            ? { background: 'var(--eph-accent)', color: 'var(--eph-ink)' }
            : { border: '1px solid var(--eph-line-2)', color: 'var(--eph-muted)' }}
        >
          Retiros
        </button>
      </div>

      {tab === 'events' ? eventsBody : tab === 'therapies' ? therapiesBody : retreatsBody}
    </div>
  );
}
