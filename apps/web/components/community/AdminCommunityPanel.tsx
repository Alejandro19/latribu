'use client';

import { useCallback, useEffect, useState } from 'react';
import { listEvents, createEvent, updateEvent, deleteEvent, type CommunityEvent } from '../../lib/events-client';
import { listTherapies, createTherapy, updateTherapy, deleteTherapy, type CommunityTherapy } from '../../lib/therapies-client';
import { getConfirmedReservations, type EventReservation, type TherapyReservation } from '../../lib/community-reservations-client';
import { formatEventDateTime } from '../../lib/community-logic';
import { showToast } from '../layout/AppShell';
import Accordion from '../ui/Accordion';
import EmptyState from '../ui/EmptyState';
import LockedOverlay from '../ui/LockedOverlay';
import { COACH_WHATSAPP_NUMBER } from '../../lib/constants';
import { TherapyCard } from './CommunityVisuals';

const cardStyle: React.CSSProperties = {
  background: 'var(--paper)', border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 18,
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4,
};
const fieldStyle: React.CSSProperties = {
  width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--line)',
  padding: '0 10px', fontSize: 13, background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none', boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  ...fieldStyle, height: 'auto', minHeight: 72, padding: 10, resize: 'vertical', fontFamily: 'inherit',
};
const primaryButtonStyle: React.CSSProperties = {
  height: 40, padding: '0 22px', borderRadius: 9999, border: 'none',
  background: 'var(--sage)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const ghostButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 9999, border: '1px solid var(--line)',
  background: 'transparent', color: 'var(--ink-soft)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const dangerButtonStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 9999, border: '1px solid var(--danger)',
  background: 'transparent', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
};
function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 38, padding: '0 20px', borderRadius: 9999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: active ? 'none' : '1px solid var(--line)',
    background: active ? 'var(--gold)' : 'transparent',
    color: active ? '#fff' : 'var(--ink-soft)',
  };
}
function segmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, height: 36, borderRadius: 9999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: active ? 'none' : '1px solid var(--line)',
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? '#fff' : 'var(--ink-soft)',
  };
}

const PREVIEW_TYPES: { key: string; label: string }[] = [
  { key: 'coaching_1_1', label: 'Coaching 1:1' },
  { key: 'coaching_online', label: 'Coaching Online' },
  { key: 'lead_wellness', label: 'Lead Wellness' },
];

function PublishedRow({
  title, badge, meta, active, onToggleActive, onDelete,
}: {
  title: string; badge?: React.ReactNode; meta: string; active: boolean; onToggleActive: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line)', opacity: active ? 1 : 0.5 }}>
      <div style={{ flex: 1 }}>
        <strong>{title}</strong> {badge}
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{meta}</div>
      </div>
      <button type="button" style={ghostButtonStyle} onClick={onToggleActive}>
        {active ? 'Desactivar' : 'Activar'}
      </button>
      <button type="button" style={dangerButtonStyle} onClick={onDelete}>
        Eliminar
      </button>
    </div>
  );
}

function ReservationAccordionSection({
  title, groups, dateOrMeta,
}: {
  title: string;
  groups: { key: string; heading: string; meta: string; rows: { name: string; phone: string | null }[] }[];
  dateOrMeta?: never;
}) {
  void dateOrMeta;
  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>{title}</h3>
      {groups.length === 0 ? (
        <EmptyState message={`Sin reservas de ${title.toLowerCase()}.`} />
      ) : (
        <Accordion
          items={groups.map((g) => ({
            header: (
              <span>
                {g.heading} <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>— {g.rows.length} reserva{g.rows.length === 1 ? '' : 's'}</span>
              </span>
            ),
            content: (
              <div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>{g.meta}</div>
                {g.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < g.rows.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <strong>{r.name}</strong>
                    <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{r.phone || 'Sin celular registrado'}</span>
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      )}
    </div>
  );
}

function groupReservations<T extends { name: string; phone: string | null }>(
  rows: Array<T & Record<string, unknown>>,
  idKey: string,
  headingKey: string,
  metaFn: (first: T & Record<string, unknown>) => string
) {
  const groups = new Map<string, (T & Record<string, unknown>)[]>();
  for (const r of rows) {
    const key = (r[idKey] as string) || 'sin-id';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    heading: String(group[0][headingKey] ?? ''),
    meta: metaFn(group[0]),
    rows: group.map((r) => ({ name: r.name, phone: r.phone })),
  }));
}

export function AdminCommunityPanel() {
  const [tab, setTab] = useState<'gestion' | 'reservas'>('gestion');
  const [newType, setNewType] = useState<'event' | 'therapy'>('event');
  const [previewType, setPreviewType] = useState<string>('coaching_1_1');

  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [therapies, setTherapies] = useState<CommunityTherapy[]>([]);
  const [loading, setLoading] = useState(true);

  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evDesc, setEvDesc] = useState('');

  const [thTitle, setThTitle] = useState('');
  const [thProvider, setThProvider] = useState('');
  const [thDiscount, setThDiscount] = useState('');
  const [thDesc, setThDesc] = useState('');

  const [eventReservations, setEventReservations] = useState<EventReservation[]>([]);
  const [therapyReservations, setTherapyReservations] = useState<TherapyReservation[]>([]);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [reservationsLoading, setReservationsLoading] = useState(false);

  const refetch = useCallback(async () => {
    const [eventsList, therapiesList] = await Promise.all([listEvents(), listTherapies()]);
    setEvents(eventsList);
    setTherapies(therapiesList);
  }, []);

  useEffect(() => {
    setLoading(true);
    refetch()
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [refetch]);

  useEffect(() => {
    if (tab !== 'reservas' || reservationsLoaded) return;
    setReservationsLoading(true);
    getConfirmedReservations()
      .then(({ eventReservations: ev, therapyReservations: th }) => {
        setEventReservations(ev);
        setTherapyReservations(th);
        setReservationsLoaded(true);
      })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setReservationsLoading(false));
  }, [tab, reservationsLoaded]);

  async function handleCreateEvent() {
    if (!evTitle.trim()) return;
    try {
      await createEvent({ title: evTitle.trim(), event_date: evDate || undefined, location: evLocation || undefined, description: evDesc || undefined });
      setEvTitle('');
      setEvDate('');
      setEvLocation('');
      setEvDesc('');
      await refetch();
      showToast('Evento creado.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleCreateTherapy() {
    if (!thTitle.trim()) return;
    try {
      await createTherapy({ title: thTitle.trim(), provider: thProvider || undefined, discount_pct: thDiscount ? Number(thDiscount) : undefined, description: thDesc || undefined });
      setThTitle('');
      setThProvider('');
      setThDiscount('');
      setThDesc('');
      await refetch();
      showToast('Terapia creada.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  async function handleToggleEventActive(ev: CommunityEvent) {
    try {
      await updateEvent(ev.id, { active: ev.active === false });
      await refetch();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }
  async function handleDeleteEvent(id: string) {
    try {
      await deleteEvent(id);
      await refetch();
      showToast('Evento eliminado.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }
  async function handleToggleTherapyActive(t: CommunityTherapy) {
    try {
      await updateTherapy(t.id, { active: t.active === false });
      await refetch();
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }
  async function handleDeleteTherapy(id: string) {
    try {
      await deleteTherapy(id);
      await refetch();
      showToast('Terapia eliminada.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando comunidad…</p>;

  const tabSwitcher = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      <button type="button" style={tabButtonStyle(tab === 'gestion')} onClick={() => setTab('gestion')}>
        Gestión
      </button>
      <button type="button" style={tabButtonStyle(tab === 'reservas')} onClick={() => setTab('reservas')}>
        Reservas
      </button>
    </div>
  );

  if (tab === 'reservas') {
    const eventGroups = groupReservations(
      eventReservations.map((r) => ({ ...r, name: r.clientName, phone: r.clientPhone })),
      'eventId',
      'eventTitle',
      (first) => `${first.eventDate ? formatEventDateTime(first.eventDate as string) : 'Sin fecha'}${first.eventLocation ? ' · ' + first.eventLocation : ''}`
    );
    const therapyGroups = groupReservations(
      therapyReservations.map((r) => ({ ...r, name: r.clientName, phone: r.clientPhone })),
      'therapyId',
      'therapyTitle',
      (first) => `${first.therapyProvider || ''}${first.therapyDiscountPct ? ' · -' + first.therapyDiscountPct + '%' : ''}`
    );
    return (
      <div>
        {tabSwitcher}
        {reservationsLoading ? (
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando reservas…</p>
        ) : (
          <>
            <ReservationAccordionSection title="Reservas de Eventos" groups={eventGroups} />
            <ReservationAccordionSection title="Reservas de Terapias" groups={therapyGroups} />
          </>
        )}
      </div>
    );
  }

  const previewUnlocked = previewType !== 'lead_wellness';

  return (
    <div>
      {tabSwitcher}

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Crear nuevo</h3>
        <div style={{ display: 'flex', gap: 8, maxWidth: 280, marginBottom: 16 }}>
          <button type="button" style={segmentButtonStyle(newType === 'event')} onClick={() => setNewType('event')}>
            Evento
          </button>
          <button type="button" style={segmentButtonStyle(newType === 'therapy')} onClick={() => setNewType('therapy')}>
            Terapia
          </button>
        </div>

        {newType === 'event' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="ev-new-title">Título</label>
                <input id="ev-new-title" style={fieldStyle} value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="ev-new-date">Fecha</label>
                <input id="ev-new-date" type="datetime-local" style={fieldStyle} value={evDate} onChange={(e) => setEvDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="ev-new-location">Lugar</label>
                <input id="ev-new-location" style={fieldStyle} value={evLocation} onChange={(e) => setEvLocation(e.target.value)} />
              </div>
            </div>
            <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="ev-new-desc">Descripción</label>
            <textarea id="ev-new-desc" rows={2} style={textareaStyle} value={evDesc} onChange={(e) => setEvDesc(e.target.value)} />
            <button type="button" style={{ ...primaryButtonStyle, marginTop: 16 }} onClick={handleCreateEvent}>
              Crear evento
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="th-new-title">Título</label>
                <input id="th-new-title" style={fieldStyle} value={thTitle} onChange={(e) => setThTitle(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="th-new-provider">Proveedor</label>
                <input id="th-new-provider" style={fieldStyle} value={thProvider} onChange={(e) => setThProvider(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="th-new-discount">Descuento (%)</label>
                <input id="th-new-discount" type="number" style={fieldStyle} value={thDiscount} onChange={(e) => setThDiscount(e.target.value)} />
              </div>
            </div>
            <label style={{ ...labelStyle, marginTop: 12 }} htmlFor="th-new-desc">Descripción</label>
            <textarea id="th-new-desc" rows={2} style={textareaStyle} value={thDesc} onChange={(e) => setThDesc(e.target.value)} />
            <button type="button" style={{ ...primaryButtonStyle, marginTop: 16 }} onClick={handleCreateTherapy}>
              Crear terapia
            </button>
          </>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Eventos publicados</h3>
        {events.length === 0 ? (
          <EmptyState message="Sin eventos." />
        ) : (
          events.map((ev) => (
            <PublishedRow
              key={ev.id}
              title={ev.title}
              meta={`${ev.eventDate ? formatEventDateTime(ev.eventDate) : 'Sin fecha'}${ev.location ? ' · ' + ev.location : ''}`}
              active={ev.active !== false}
              onToggleActive={() => handleToggleEventActive(ev)}
              onDelete={() => handleDeleteEvent(ev.id)}
            />
          ))
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Terapias publicadas</h3>
        {therapies.length === 0 ? (
          <EmptyState message="Sin terapias." />
        ) : (
          therapies.map((t) => (
            <PublishedRow
              key={t.id}
              title={t.title}
              badge={t.discountPct ? (
                <span style={{ background: 'var(--terracota-soft)', color: 'var(--terracota)', borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  -{t.discountPct}%
                </span>
              ) : undefined}
              meta={t.provider || ''}
              active={t.active !== false}
              onToggleActive={() => handleToggleTherapyActive(t)}
              onDelete={() => handleDeleteTherapy(t.id)}
            />
          ))
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Vista previa por tipo de cliente</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '-8px 0 14px' }}>
          Eventos se ve igual para los 3 tipos, así que no cambia aquí. Esto es exactamente lo que un cliente vería hoy
          en la pestaña Terapias, según su tipo — sin necesidad de entrar con otra cuenta.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {PREVIEW_TYPES.map((pt) => (
            <button key={pt.key} type="button" style={tabButtonStyle(previewType === pt.key)} onClick={() => setPreviewType(pt.key)}>
              {pt.label}
            </button>
          ))}
        </div>
        {previewUnlocked ? (
          therapies.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {therapies.map((t) => (
                <TherapyCard key={t.id} therapy={t} />
              ))}
            </div>
          ) : (
            <EmptyState message="Sin terapias publicadas." />
          )
        ) : (
          <LockedOverlay
            title="Beneficios solo para clientes activos"
            subtitle="Activa un plan de Coaching con tu mentor para desbloquear descuentos reales en spa, terapia, fisioterapia y más."
            ctaLabel="Hablar con un coach"
            onCta={() => window.open(`https://wa.me/${COACH_WHATSAPP_NUMBER}`, '_blank')}
          >
            {therapies.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {therapies.slice(0, 3).map((t) => (
                  <TherapyCard key={t.id} therapy={t} />
                ))}
              </div>
            ) : (
              <EmptyState message="Sin terapias publicadas." />
            )}
          </LockedOverlay>
        )}
      </div>
    </div>
  );
}
