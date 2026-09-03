'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetchClient } from '../../lib/clients-client';
import { MEMBERSHIP_LABELS } from '../../lib/constants';
import Isotipo from '../ui/Isotipo';

function formatMemberNumber(n: number): string {
  return String(n).padStart(5, '0');
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPlanDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ManageMembershipLink() {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/configuracion/membresias"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-block justify-self-start border px-7 py-3.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors"
      style={{ borderColor: hover ? 'var(--eph-accent-line)' : 'var(--eph-line-2)', color: hover ? 'var(--eph-text)' : 'var(--eph-body)' }}
    >
      Gestionar membresía
    </Link>
  );
}

export function MemberCard({ clientId }: { clientId: string }) {
  const { data: client } = useSWR(['client-detail-for-member-card', clientId], () => fetchClient(clientId));

  // Sin card mientras carga, si la membresía todavía no fue activada, o si
  // por algún motivo aún no tiene número asignado (activación en curso).
  if (!client || client.status !== 'active' || client.memberNumber == null) return null;

  const tierLabel = MEMBERSHIP_LABELS[client.clientType] || client.clientType;
  const expired = client.planEndDate != null && new Date().toISOString().slice(0, 10) > client.planEndDate;

  return (
    <div
      className="mb-8 grid items-center gap-8 border p-7"
      style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}
    >
      {/* La credencial en sí — objeto de marca, siempre dark-brand sin
          importar el tema activo (spec: "objeto de marca"). */}
      <div
        data-theme="dark-brand"
        className="relative w-full max-w-[470px]"
        style={{
          aspectRatio: '1.585',
          background: 'linear-gradient(148deg, #241D18 0%, #17120F 46%, #1F1915 100%)',
          border: '1px solid rgba(201,166,107,0.30)',
          padding: 'clamp(20px, 2.6vw, 30px)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          boxShadow: '0 18px 44px rgba(0,0,0,0.30), 0 1px 0 rgba(201,166,107,0.12) inset',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(115deg, rgba(201,164,106,0) 38%, rgba(201,164,106,0.10) 50%, rgba(201,164,106,0) 62%)' }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <Isotipo size={34} />
          <div className="text-right font-mono text-[9px] uppercase leading-[1.9] tracking-[0.2em]" style={{ color: 'var(--eph-body)' }}>
            <div>MEMBRESÍA</div>
            <div>N.º {formatMemberNumber(client.memberNumber)}</div>
          </div>
        </div>
        <div className="relative flex flex-col justify-end gap-2">
          <div className="font-display font-light leading-none" style={{ fontSize: 'clamp(26px, 3vw, 34px)', color: 'var(--eph-text)' }}>
            {client.name}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: 'var(--eph-accent)' }}>{tierLabel}</div>
        </div>
        <div className="relative flex items-end justify-between gap-4" style={{ marginTop: 'clamp(14px, 2vw, 22px)' }}>
          <div className="font-display font-light" style={{ fontSize: 21, letterSpacing: '0.2em', textIndent: '0.2em', color: 'var(--eph-text)' }}>
            EPHIROX
          </div>
          <div className="font-mono text-[9px] tracking-[0.16em]" style={{ color: 'var(--eph-muted)' }}>MMXXVI</div>
        </div>
      </div>

      {/* Info de la membresía + acción */}
      <div className="grid gap-5">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: 'var(--eph-accent)' }}>Tu credencial</p>
          <p className="mt-3 font-display font-light leading-tight" style={{ fontSize: 'clamp(24px, 2.6vw, 30px)', color: 'var(--eph-text)' }}>
            Miembro activo del círculo
          </p>
        </div>
        <div className="grid gap-4 border-t pt-5" style={{ borderColor: 'var(--eph-line)', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {client.activatedAt && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--eph-muted)' }}>Miembro desde</p>
              <p className="mt-2 font-body text-[16px]" style={{ color: 'var(--eph-text)' }}>{formatJoinDate(client.activatedAt)}</p>
            </div>
          )}
          {client.clientType === 'coaching_1_1' && client.sessionsTotal != null && client.sessionsRemaining != null && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--eph-muted)' }}>Clases</p>
              <p className="mt-2 font-body text-[16px]" style={{ color: 'var(--eph-text)' }}>
                Quedan {client.sessionsRemaining} de {client.sessionsTotal}
              </p>
            </div>
          )}
          {client.planEndDate && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--eph-muted)' }}>{expired ? 'Venció' : 'Vence'}</p>
              <p className="mt-2 font-body text-[16px]" style={expired ? { color: 'var(--eph-accent)' } : { color: 'var(--eph-text)' }}>
                {formatPlanDate(client.planEndDate)}
              </p>
            </div>
          )}
        </div>
        <ManageMembershipLink />
      </div>
    </div>
  );
}
