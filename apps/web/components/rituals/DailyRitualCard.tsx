'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { getModuleAccessState } from '@/lib/module-access';
import {
  getCheckinsStatus,
  getTodayCheckin,
  postDailyCheckin,
} from '@/lib/checkins-client';
import { getTodayMorningCheckin, postMorningCheckin } from '@/lib/cortisol-client';
import { RitualCheckinCard } from './RitualCheckinCard';
import { ScaleQuestion } from './ScaleQuestion';
import Button from '@/components/ui/Button';

// Escala de 5 caras del spec, representada como círculos numerados con
// gradiente de color (peor→mejor) — movida tal cual de la vieja CheckinCard.
const PULSO_OPTIONS: { value: number; label: string; color: string }[] = [
  { value: 1, label: 'Muy mal', color: '#B85C4A' },
  { value: 2, label: 'Mal', color: '#C98A5E' },
  { value: 3, label: 'Regular', color: '#C9A66B' },
  { value: 4, label: 'Bien', color: '#8FA37A' },
  { value: 5, label: 'Muy bien', color: '#6B8F71' },
];

function streakLabel(days: number): string {
  return `${days} ${days === 1 ? 'día seguido' : 'días seguidos'}`;
}

export function DailyRitualCard({ clientId }: { clientId: string }) {
  const { moduleAccess, planExpired } = useAuth();
  const hasCortisolAccess = getModuleAccessState('cortisol', { moduleAccess, planExpired }) === 'ok';

  const { data: status, mutate: mutateStatus } = useSWR(['checkins-status', clientId], () => getCheckinsStatus(clientId));
  const { data: dailyCheckin, mutate: mutateDaily } = useSWR(['daily-checkin-today', clientId], () => getTodayCheckin(clientId));
  const { data: morningCheckin, mutate: mutateMorning } = useSWR(
    hasCortisolAccess ? ['morning-checkin-today', clientId] : null,
    () => getTodayMorningCheckin(clientId)
  );

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mood, setMood] = useState<number | null>(null);
  const [energia, setEnergia] = useState('3');
  const [tension, setTension] = useState('3');
  const [claridad, setClaridad] = useState('3');

  useEffect(() => {
    if (dailyCheckin) setMood(dailyCheckin.pulsoAnimo);
  }, [dailyCheckin]);

  useEffect(() => {
    if (morningCheckin) {
      setEnergia(String(morningCheckin.energia));
      setTension(String(morningCheckin.tension));
      setClaridad(String(morningCheckin.claridad));
    }
  }, [morningCheckin]);

  if (!status) return null;

  const completed = hasCortisolAccess ? !!dailyCheckin && !!morningCheckin : !!dailyCheckin;

  async function handleSubmit() {
    if (mood == null) return;
    setSaving(true);
    setError(null);
    try {
      await postDailyCheckin(clientId, mood);
      if (hasCortisolAccess) {
        await postMorningCheckin(clientId, { energia: Number(energia), tension: Number(tension), claridad: Number(claridad) });
      }
      setIsEditing(false);
      await Promise.all([mutateDaily(), hasCortisolAccess ? mutateMorning() : null, mutateStatus()].filter(Boolean));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RitualCheckinCard
      cadence="daily"
      title="Ritual Diario"
      completed={completed}
      streakLabel={streakLabel(status.dailyStreakDays)}
      isEditing={isEditing}
      onStartEdit={() => setIsEditing(true)}
      onCancelEdit={() => setIsEditing(false)}
      saving={saving}
      summary={
        <p className="font-body text-sm" style={{ color: 'var(--eph-body)' }}>
          {dailyCheckin && `Ánimo ${dailyCheckin.pulsoAnimo}/5`}
          {hasCortisolAccess && morningCheckin && ` · Energía ${morningCheckin.energia}/5 · Tensión ${morningCheckin.tension}/5 · Claridad ${morningCheckin.claridad}/5`}
        </p>
      }
    >
      <div>
        <p className="m-0 mb-2.5 text-[13px] font-semibold" style={{ color: 'var(--eph-text)' }}>¿Cómo te sientes hoy?</p>
        <div className="flex gap-2.5" role="group" aria-label="¿Cómo te sientes hoy?">
          {PULSO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-label={opt.label}
              aria-pressed={mood === opt.value}
              onClick={() => setMood(opt.value)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold text-white transition-transform hover:scale-105"
              style={{ background: opt.color, outline: mood === opt.value ? '2px solid var(--eph-accent)' : 'none', outlineOffset: 2 }}
            >
              {opt.value}
            </button>
          ))}
        </div>
      </div>

      {hasCortisolAccess && (
        <>
          <ScaleQuestion
            question="¿Cómo sentiste tu energía al despertar hoy?"
            minLabel="Agotado"
            maxLabel="Con energía"
            value={energia}
            onChange={setEnergia}
          />
          <ScaleQuestion
            question="¿Sentiste tensión o ansiedad apenas despertaste?"
            minLabel="Mucha tensión"
            maxLabel="Ninguna"
            value={tension}
            onChange={setTension}
          />
          <ScaleQuestion
            question="¿Qué tan clara sientes tu mente en este momento?"
            minLabel="Nublada"
            maxLabel="Muy clara"
            value={claridad}
            onChange={setClaridad}
          />
        </>
      )}

      {error && (
        <p role="alert" className="font-body text-sm" style={{ color: 'var(--eph-danger)' }}>{error}</p>
      )}
      <Button type="button" variant="primary" disabled={saving || mood == null} onClick={handleSubmit}>
        {saving ? 'Guardando…' : 'Guardar ritual'}
      </Button>
    </RitualCheckinCard>
  );
}

export default DailyRitualCard;
