'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  getCheckinsStatus,
  getCurrentWeekReflection,
  postWeeklyReflection,
} from '@/lib/checkins-client';
import { RitualCheckinCard } from './RitualCheckinCard';
import Button from '@/components/ui/Button';

const DESPERTARES_OPTIONS: ('Ninguno' | '1-2' | '3+')[] = ['Ninguno', '1-2', '3+'];

function streakLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? 'semana seguida' : 'semanas seguidas'}`;
}

export function WeeklyRitualCard({ clientId }: { clientId: string }) {
  const { data: status, mutate: mutateStatus } = useSWR(['checkins-status', clientId], () => getCheckinsStatus(clientId));
  const { data: reflection, mutate: mutateReflection } = useSWR(['weekly-reflection-current', clientId], () => getCurrentWeekReflection(clientId));

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [estres, setEstres] = useState(5);
  const [tecnicas, setTecnicas] = useState('');
  const [despertares, setDespertares] = useState<'Ninguno' | '1-2' | '3+'>('Ninguno');

  useEffect(() => {
    if (reflection) {
      setEstres(reflection.estresCronico);
      setTecnicas(reflection.tecnicasManejoUsadas || '');
      if (reflection.despertaresNocturnosSemana) {
        setDespertares(reflection.despertaresNocturnosSemana as 'Ninguno' | '1-2' | '3+');
      }
    }
  }, [reflection]);

  if (!status) return null;

  const answeredThisWeek = !!reflection;
  // Siempre visible (nunca desaparece) — bloqueado hasta el fin de semana si
  // aún no se respondió, a propósito: ver el bloque ahí, sabiendo que se
  // habilita el sábado/domingo, genera más retentiva que ocultarlo.
  const locked = !answeredThisWeek && !status.weeklyRitualWindowOpen;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await postWeeklyReflection(clientId, {
        estresCronico: estres,
        tecnicasManejoUsadas: tecnicas.trim() || undefined,
        despertaresNocturnosSemana: despertares,
      });
      setIsEditing(false);
      await Promise.all([mutateReflection(), mutateStatus()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RitualCheckinCard
      cadence="weekly"
      title="Ritual Semanal"
      completed={answeredThisWeek}
      locked={locked}
      lockedMessage="Se habilita el sábado y domingo — vuelve entonces para responder."
      streakLabel={streakLabel(status.weeklyStreakWeeks)}
      isEditing={isEditing}
      onStartEdit={() => setIsEditing(true)}
      onCancelEdit={() => setIsEditing(false)}
      saving={saving}
      summary={
        reflection && (
          <p className="font-body text-sm" style={{ color: 'var(--eph-body)' }}>
            Estrés crónico {reflection.estresCronico}/10 · Despertares: {reflection.despertaresNocturnosSemana || 'Ninguno'}
            {reflection.tecnicasManejoUsadas ? ` · ${reflection.tecnicasManejoUsadas}` : ''}
          </p>
        )
      }
    >
      <div>
        <label className="mb-1.5 block text-[12px]" style={{ color: 'var(--eph-muted)' }} htmlFor="reflection-stress">
          Nivel de estrés crónico (1-10): {estres}
        </label>
        <input
          id="reflection-stress"
          type="range"
          min={1}
          max={10}
          value={estres}
          onChange={(e) => setEstres(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12px]" style={{ color: 'var(--eph-muted)' }} htmlFor="reflection-coping">
          Técnicas de manejo del estrés que usaste
        </label>
        <input
          id="reflection-coping"
          type="text"
          value={tecnicas}
          onChange={(e) => setTecnicas(e.target.value)}
          className="h-9 w-full border-0 border-b bg-transparent text-[14px] outline-none"
          style={{ borderColor: 'var(--eph-line-2)', color: 'var(--eph-text)' }}
        />
      </div>
      <div>
        <p className="mb-1.5 text-[12px]" style={{ color: 'var(--eph-muted)' }}>Despertares nocturnos esta semana</p>
        <div className="flex gap-2" role="group" aria-label="Despertares nocturnos esta semana">
          {DESPERTARES_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={despertares === opt}
              onClick={() => setDespertares(opt)}
              className="rounded-[999px] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.06em]"
              style={{
                border: despertares === opt ? '1px solid var(--eph-accent)' : '1px solid var(--eph-line-2)',
                background: despertares === opt ? 'var(--eph-accent)' : 'transparent',
                color: despertares === opt ? 'var(--eph-ink)' : 'var(--eph-body)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="font-body text-sm" style={{ color: 'var(--eph-danger)' }}>{error}</p>
      )}
      <Button type="button" variant="primary" onClick={handleSubmit} disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar reflexión'}
      </Button>
    </RitualCheckinCard>
  );
}

export default WeeklyRitualCard;
