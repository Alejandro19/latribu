'use client';

import type { ExerciseCategory } from '../../lib/training-client';

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  warmup: 'Calentamiento',
  strength: 'Fuerza',
  core: 'Core',
  cardio: 'Cardio',
  stretching: 'Estiramiento',
};

const CATEGORY_ICON_PATHS: Record<ExerciseCategory, React.ReactNode> = {
  warmup: (
    <>
      <circle cx="15" cy="15" r="6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M15 2v4M15 24v4M2 15h4M24 15h4M6.5 6.5l2.8 2.8M20.7 20.7l2.8 2.8M23.5 6.5l-2.8 2.8M9.3 20.7l-2.8 2.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  strength: (
    <>
      <rect x="2" y="11" width="5" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <rect x="23" y="11" width="5" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M7 15h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  core: (
    <>
      <rect x="8" y="4" width="14" height="22" rx="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M8 11h14M8 18h14M15 4v22" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  cardio: (
    <path
      d="M3 15h5l2-7 3 13 2-10 2 4h7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  stretching: (
    <>
      <circle cx="15" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path
        d="M15 9v9M15 9l-8-3M15 9l8-3M15 18l-6 8M15 18l6 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

export function CategoryIcon({ category, className }: { category: ExerciseCategory; className?: string }) {
  return (
    <svg className={className} width="30" height="30" viewBox="0 0 30 30" fill="none">
      {CATEGORY_ICON_PATHS[category]}
    </svg>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const barWidth = Math.min(pct, 100);
  return (
    <div className="mt-3.5">
      <div className="mb-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-muted)' }}>
        <span>Progreso</span>
        <span>
          {done}/{total} · {pct}%
        </span>
      </div>
      <div className="h-[2px] overflow-hidden" style={{ background: 'var(--eph-line-2)' }}>
        <div className="h-full" style={{ width: `${barWidth}%`, background: 'var(--eph-accent)' }} />
      </div>
    </div>
  );
}

export function MiniRing({ pct, size = 46 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--eph-line-2)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--eph-accent)"
          strokeWidth="4"
          strokeLinecap="butt"
          strokeDasharray={`${filled.toFixed(1)} ${circ.toFixed(1)}`}
        />
      </svg>
    </div>
  );
}
