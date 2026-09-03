'use client';

import useSWR from 'swr';
import { getWellnessIndex, type WellnessIndexResult } from '../../lib/wellness-index-client';
import RingProgress from '../ui/RingProgress';

const TREND_COPY: Record<WellnessIndexResult['trend'], string> = {
  up: 'Estás mejorando',
  down: 'Es momento de ajustar',
  stable: 'Manteniendo el ritmo',
  none: 'Primera medición',
};

function DeltaLine({ delta }: { delta: number }) {
  const up = delta > 0;
  return (
    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-accent)' }}>
      {up ? '▲' : '▼'} {up ? '+' : ''}
      {delta} vs. semana pasada
    </p>
  );
}

export function WellnessIndexCard({ clientId }: { clientId: string }) {
  const { data } = useSWR(['wellness-index', clientId], () => getWellnessIndex(clientId));

  if (!data) return null;

  return (
    <div
      className="mb-8 flex items-center gap-5 rounded-[0] border p-7"
      style={{
        background: 'linear-gradient(135deg, var(--eph-surface), var(--eph-surface-2))',
        borderColor: 'var(--eph-line)',
        color: 'var(--eph-text)',
      }}
    >
      <RingProgress value={data.value} size={76} strokeWidth={2}>
        <div className="flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-normal leading-none">{data.value}</span>
          <span className="mt-0.5 font-mono text-[9px]" style={{ color: 'var(--eph-muted)' }}>/ 100</span>
        </div>
      </RingProgress>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-accent)' }}>
          Índice de rendimiento
        </p>
        <p className="mt-1 font-display text-lg font-normal">{TREND_COPY[data.trend]}</p>
        {data.delta != null && <DeltaLine delta={data.delta} />}
      </div>
    </div>
  );
}
