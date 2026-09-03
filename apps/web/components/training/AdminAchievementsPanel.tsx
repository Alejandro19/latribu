'use client';

import useSWR from 'swr';
import { getAchievements, getStreak } from '../../lib/training-client';
import { computeAchievements } from '../../lib/training-card';
import RingProgress from '../ui/RingProgress';
import { IconTrophy, IconMedal } from '../ui/icons';

const cardStyle: React.CSSProperties = {
  background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
  borderRadius: 0, padding: '22px 24px', marginBottom: 20,
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--eph-text)', margin: '0 0 16px',
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AdminAchievementsPanel({ clientId }: { clientId: string }) {
  const { data, error, isLoading: loading } = useSWR(['training-achievements', clientId], async () => {
    const [achievements, streak] = await Promise.all([
      getAchievements(clientId),
      getStreak(clientId, clientTz()).catch(() => null),
    ]);
    return { achievements, streakWeeks: streak?.streakWeeks ?? null };
  });

  if (loading) return <div style={cardStyle}><p style={{ color: 'var(--eph-muted)', margin: 0 }}>Cargando medallas y trofeos…</p></div>;
  if (error) return <div style={cardStyle}><p style={{ color: 'var(--eph-danger)', margin: 0 }}>{(error as Error).message}</p></div>;
  if (!data) return null;

  const { medalsInCurrentCycle, trophiesEarned } = computeAchievements(data.streakWeeks ?? 0);
  const sorted = [...data.achievements].sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1));

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Medallas y trofeos</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
        <RingProgress value={(medalsInCurrentCycle / 4) * 100} size={64}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="font-mono" style={{ fontSize: 16, fontWeight: 400, color: 'var(--eph-text)' }}>{medalsInCurrentCycle}/4</span>
          </div>
        </RingProgress>
        <div>
          <p className="font-mono" style={{ margin: '0 0 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 400, color: 'var(--eph-muted)' }}>
            Medallas del ciclo actual
          </p>
          <p className="font-body" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--eph-text)' }}>
            <IconTrophy size={14} style={{ color: 'var(--eph-accent)' }} /> {trophiesEarned} copa{trophiesEarned === 1 ? '' : 's'} en total — las copas nunca se resetean.
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="font-body" style={{ color: 'var(--eph-body)', fontSize: 13, margin: 0 }}>
          Aún no ha ganado medallas ni trofeos.
        </p>
      ) : (
        <div>
          {sorted.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--eph-line)',
              }}
            >
              <span style={{ display: 'flex', color: 'var(--eph-accent)' }}>
                {a.type === 'copa' ? <IconTrophy size={16} /> : <IconMedal size={16} />}
              </span>
              <div style={{ flex: 1 }}>
                <span className="font-body" style={{ fontSize: 13, fontWeight: 500, color: 'var(--eph-text)' }}>
                  {a.type === 'copa' ? 'Copa' : 'Medalla'} · semana {a.weekNumber}
                </span>
              </div>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--eph-muted)' }}>{formatDate(a.earnedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
