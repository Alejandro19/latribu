'use client';

import type { ReactElement, ReactNode } from 'react';
import type { CommunityEvent } from '../../lib/events-client';
import type { CommunityTherapy } from '../../lib/therapies-client';
import type { CommunityRetreat } from '../../lib/retreats-client';
import {
  formatEventDateTime,
  eventCategoryIcon,
  therapyCategoryIcon,
  type EventCategoryKey,
  type TherapyCategoryKey,
} from '../../lib/community-logic';
import {
  IconSnowflake,
  IconYoga,
  IconRun,
  IconFlame,
  IconHandshake,
  IconCalendar,
  IconMassage,
  IconStethoscope,
  IconSalad,
  IconBrain,
  IconMapPin,
  IconCamera,
} from '../ui/icons';

const AVATAR_COLORS = ['var(--eph-accent)', 'var(--eph-steel)', 'var(--eph-muted)'];

const EVENT_CATEGORY_ICON: Record<EventCategoryKey, (props: { size?: number }) => ReactElement> = {
  ice: IconSnowflake,
  mindful: IconYoga,
  activity: IconRun,
  heat: IconFlame,
  social: IconHandshake,
  default: IconCalendar,
};

const THERAPY_CATEGORY_ICON: Record<TherapyCategoryKey, (props: { size?: number }) => ReactElement> = {
  massage: IconMassage,
  physio: IconStethoscope,
  nutrition: IconSalad,
  mental: IconBrain,
  default: IconCalendar,
};

export function AttendanceStrip({ count, capacity }: { count: number; capacity: number | null }) {
  const avatarCount = Math.min(count, 3);
  const spotsLeft = capacity ? Math.max(capacity - count, 0) : null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border px-3 py-2 font-body text-[11px]" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)', color: 'var(--eph-muted)' }}>
      {avatarCount > 0 && (
        <div className="flex -space-x-2">
          {Array.from({ length: avatarCount }).map((_, i) => (
            <div key={i} className="h-5 w-5 rounded-full border-2" style={{ borderColor: 'var(--eph-surface-2)', background: AVATAR_COLORS[i] }} />
          ))}
        </div>
      )}
      <span>
        {count} persona{count === 1 ? '' : 's'} confirmada{count === 1 ? '' : 's'}
      </span>
      {spotsLeft !== null && (
        <span className="ml-auto whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-accent)' }}>
          Quedan {spotsLeft} lugar{spotsLeft === 1 ? '' : 'es'}
        </span>
      )}
    </div>
  );
}

// Foto arriba de la card (o un placeholder neutro si el admin todavía no
// cargó ninguna) — sangra hasta el borde de la card (p-3.5). `aspectClass`
// varía por tipo de card: Eventos un poco más cuadrado (2/1), Terapias y
// Retiros más achatado (2.4/1) para ocupar menos alto.
function CardPhoto({ imageUrl, alt, aspectClass = 'aspect-[2.4/1]' }: { imageUrl: string | null | undefined; alt: string; aspectClass?: string }) {
  return imageUrl ? (
    <div className={`-m-3.5 mb-2.5 ${aspectClass} overflow-hidden rounded-t-[0]`}>
      <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
    </div>
  ) : (
    <div
      className={`-m-3.5 mb-2.5 flex ${aspectClass} items-center justify-center rounded-t-[0]`}
      style={{ background: 'linear-gradient(135deg, var(--eph-surface), var(--eph-surface-2))' }}
    >
      <span style={{ color: 'var(--eph-accent)' }}>
        <IconCamera size={20} />
      </span>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-accent)' }}>{label}</p>
      <p className="font-body text-[13px] font-medium" style={{ color: 'var(--eph-text)' }}>{value}</p>
    </div>
  );
}

export function EventCard({ event, action }: { event: CommunityEvent; action?: ReactNode }) {
  const EventIcon = EVENT_CATEGORY_ICON[eventCategoryIcon(event.title)];
  return (
    <div className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-3.5">
      <CardPhoto imageUrl={event.imageUrl} alt={event.title} aspectClass="aspect-[2/1]" />
      <div className="mb-2.5 flex items-start gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--eph-surface-2)] text-[var(--eph-accent)]">
          <EventIcon size={15} />
        </div>
        <div className="flex-1">
          <p className="font-display text-[15px] font-normal text-[var(--eph-text)]">{event.title}</p>
          {event.description && <p className="mt-0.5 text-xs text-[var(--eph-muted)]">{event.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InfoField label="Fecha" value={formatEventDateTime(event.eventDate)} />
        <InfoField label="Lugar" value={event.location || '-'} />
      </div>
      <AttendanceStrip count={event.confirmed_count || 0} capacity={event.capacity} />
      {action}
    </div>
  );
}

export function TherapyCard({ therapy, action }: { therapy: CommunityTherapy; action?: ReactNode }) {
  const TherapyIcon = THERAPY_CATEGORY_ICON[therapyCategoryIcon(therapy.title)];
  return (
    <div className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-3.5">
      <CardPhoto imageUrl={therapy.imageUrl} alt={therapy.title} />
      <div className="mb-2.5 flex items-start gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--eph-surface-2)] text-[var(--eph-accent)]">
          <TherapyIcon size={15} />
        </div>
        <div className="flex-1">
          <p className="font-display text-[15px] font-normal text-[var(--eph-text)]">
            {therapy.title}
            {therapy.discountPct ? (
              <span
                className="ml-2 inline-block rounded-[999px] border px-2 py-0.5 align-middle font-mono text-[10px]"
                style={{ borderColor: 'var(--eph-accent)', color: 'var(--eph-accent)' }}
              >
                -{therapy.discountPct}%
              </span>
            ) : null}
          </p>
          {therapy.description && <p className="mt-0.5 text-xs text-[var(--eph-muted)]">{therapy.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InfoField label="Proveedor" value={therapy.provider || '-'} />
        <InfoField label="Descuento" value={therapy.discountPct ? `-${therapy.discountPct}%` : '-'} />
      </div>
      <AttendanceStrip count={therapy.confirmed_count || 0} capacity={null} />
      {action}
    </div>
  );
}

// Retiros se cotizan en dólares (price_cents = centavos de USD).
function formatPriceCents(cents: number | null): string {
  if (cents == null) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(cents / 100);
}

// Fecha inicio/fin en un solo campo ("31 ago – 9 sep") — sin hora, ya que en
// un retiro de varios días la hora del día de inicio/fin no aporta y ocupaba
// una fila extra completa en la card.
function formatDateRangeShort(startIso: string | null, endIso: string | null): string {
  if (!startIso && !endIso) return '-';
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const short = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '-' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };
  if (startIso && endIso) return `${short(startIso)} – ${short(endIso)}`;
  return short(startIso || endIso!);
}

export function RetreatCard({ retreat, action }: { retreat: CommunityRetreat; action?: ReactNode }) {
  return (
    <div className="rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-3.5">
      <CardPhoto imageUrl={retreat.imageUrl} alt={retreat.title} />
      <div className="mb-2.5 flex items-start gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--eph-surface-2)] text-[var(--eph-accent)]">
          <IconMapPin size={15} />
        </div>
        <div className="flex-1">
          <p className="font-display text-[15px] font-normal text-[var(--eph-text)]">{retreat.title}</p>
          {retreat.description && <p className="mt-0.5 text-xs text-[var(--eph-muted)]">{retreat.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <InfoField label="Fechas" value={formatDateRangeShort(retreat.startDate, retreat.endDate)} />
        <InfoField label="Lugar" value={retreat.location || '-'} />
        <InfoField label="Precio" value={formatPriceCents(retreat.priceCents)} />
      </div>
      <AttendanceStrip count={retreat.confirmed_count || 0} capacity={retreat.capacity} />
      {action}
    </div>
  );
}
