'use client';

import { useState } from 'react';
import type { Exercise, TrainingCompletion, TrainingStreak } from '../../lib/training-client';
import type { MindsetQuote } from '../../lib/quotes-client';
import { isDayUnlocked, isDayCompletedThisWeek, calculateDisciplineStats } from '../../lib/training-home-logic';
import IdentityHeader from '../ui/IdentityHeader';
import MantraCard from '../ui/MantraCard';
import Button from '../ui/Button';
import { ProgressBar } from './TrainingVisuals';
import { IconFlame, IconShield, IconLock } from '../ui/icons';
import { ProtocolDisclaimerFooter } from '../ui/ProtocolDisclaimerFooter';
import { InsightsSection } from '../insights/InsightsSection';

export type TrainingHomeProps = {
  clientId: string;
  clientType?: string | null;
  trainingDays: number;
  exercises: Exercise[];
  completions: TrainingCompletion[];
  streak: TrainingStreak | null;
  quote: MindsetQuote | null;
  clientName: string;
  onOpenDay: (day: number) => void;
  onUseProtector: () => void;
  protectorPending: boolean;
};

function monthCalendarCells(completions: TrainingCompletion[]): { day: number; completed: boolean }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const completedDates = new Set(completions.map((c) => c.completedDate));
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, completed: completedDates.has(iso) };
  });
}

function nextActionableDay(trainingDays: number, completions: TrainingCompletion[]): number | null {
  for (let day = 1; day <= trainingDays; day++) {
    if (isDayUnlocked(day, completions) && !isDayCompletedThisWeek(day, completions)) return day;
  }
  return null;
}

export function TrainingHome({
  clientId,
  clientType,
  trainingDays,
  exercises,
  completions,
  streak,
  quote,
  clientName,
  onOpenDay,
  onUseProtector,
  protectorPending,
}: TrainingHomeProps) {
  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const days = Array.from({ length: trainingDays }, (_, i) => i + 1);
  const stats = calculateDisciplineStats(completions, trainingDays);
  const calendarCells = monthCalendarCells(completions);
  const heroDay = nextActionableDay(trainingDays, completions);
  const heroCount = heroDay !== null ? exercises.filter((ex) => ex.dayNumber === heroDay).length : 0;

  return (
    <div>
      <IdentityHeader title="Workout" subtitle={trainingDays ? 'Tu programa de ejercicios personalizado.' : undefined} />
      {clientType === 'mentoring' && <InsightsSection clientId={clientId} moduleKey="entrenamiento" />}

      {quote && (
        <MantraCard mantra={quote.quote} lead={`Hola ${clientName}, repite después de mí:`} author={quote.author} />
      )}

      {heroDay !== null && (
        <div
          className="relative mt-8 mb-6 overflow-hidden border p-7"
          style={{ background: 'var(--eph-surface)', borderColor: 'var(--eph-line)', color: 'var(--eph-text)' }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--eph-accent) 16%, transparent) 0%, transparent 70%)' }}
          />
          <div className="relative z-10 mb-2.5 flex items-start justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--eph-accent)' }}>
              HOY · DÍA {heroDay}
            </p>
            {streak && (
              <div className="flex flex-shrink-0 items-center gap-1.5 rounded-[999px] border px-3 py-1.5" style={{ borderColor: 'var(--eph-line-2)' }}>
                <IconFlame size={14} />
                <span className="font-mono text-[13px]">{streak.streakWeeks}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: streak.atRisk ? 'var(--eph-danger)' : 'var(--eph-muted)' }}>
                  {streak.atRisk ? 'en riesgo' : streak.streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'}
                </span>
              </div>
            )}
          </div>
          <p className="relative z-10 mb-1.5 font-display text-xl">
            {heroCount === 0 ? 'Aún no tienes ejercicios asignados' : `${heroCount} ejercicio${heroCount === 1 ? '' : 's'} por entrenar`}
          </p>
          {heroCount > 0 && (
            <p className="relative z-10 font-body text-[13px]" style={{ color: 'var(--eph-body)' }}>
              Asignados por tu mentor
            </p>
          )}
          <div className="relative z-10 mt-5 flex items-center justify-end gap-4">
            <Button type="button" variant="primary" disabled={heroCount === 0} onClick={() => onOpenDay(heroDay)}>
              Comenzar sesión
            </Button>
          </div>
        </div>
      )}

      {streak && (
        <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
          <div className="mb-3 font-display text-[16px]" style={{ color: 'var(--eph-text)' }}>Tu semana</div>
          <div className="flex items-center gap-2.5">
            {Array.from({ length: streak.sessionsRequiredThisWeek }, (_, i) => i + 1).map((n) => {
              const done = n <= streak.sessionsDoneThisWeek;
              const shielded = !done && streak.protectorUsedThisWeek;
              return (
                <div
                  key={n}
                  className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full border font-mono text-[13px] transition-colors"
                  style={
                    done
                      ? { borderColor: 'var(--eph-accent)', background: 'var(--eph-accent)', color: 'var(--eph-ink)' }
                      : shielded
                        ? { borderColor: 'var(--eph-steel)', color: 'var(--eph-steel)' }
                        : { borderColor: 'var(--eph-line-2)', color: 'var(--eph-body)' }
                  }
                >
                  {done ? '✓' : shielded ? <IconShield size={14} /> : n}
                </div>
              );
            })}
          </div>
          <p className="mt-3 font-body text-[13px]" style={{ color: 'var(--eph-body)' }}>
            {streak.protectorUsedThisWeek
              ? 'Semana protegida — no necesitas completar más sesiones para conservar tu racha.'
              : `${streak.sessionsDoneThisWeek} de ${streak.sessionsRequiredThisWeek} sesiones completadas.`}
          </p>
        </section>
      )}

      {streak && (
        <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: 'var(--eph-steel)', color: 'var(--eph-steel)' }}>
              <IconShield size={15} />
            </div>
            <div className="flex-1">
              <div className="font-body text-xs font-medium" style={{ color: 'var(--eph-text)' }}>
                {streak.protectorUsedThisWeek ? 'Protector ya usado esta semana' : 'Protector de racha disponible'}
              </div>
              <div className="mt-0.5 font-body text-[10.5px]" style={{ color: 'var(--eph-muted)' }}>
                {streak.protectorUsedThisWeek
                  ? 'Vuelve a estar disponible la próxima semana.'
                  : 'Úsalo si esta semana no puedes completar tus sesiones — tu racha no se rompe.'}
              </div>
            </div>
            <button
              type="button"
              disabled={streak.protectorUsedThisWeek || protectorPending}
              onClick={onUseProtector}
              className="h-8 flex-shrink-0 rounded-[999px] border px-3.5 font-mono text-[10px] uppercase tracking-[0.08em] disabled:cursor-default disabled:opacity-40"
              style={{ borderColor: 'var(--eph-steel)', color: 'var(--eph-steel)' }}
            >
              {streak.protectorUsedThisWeek ? 'Usado' : 'Usar protector'}
            </button>
          </div>
        </section>
      )}

      <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <h2 className="mb-4 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Días de entrenamiento</h2>
        {days.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((day) => {
              const unlocked = isDayUnlocked(day, completions);
              const completedThisWeek = isDayCompletedThisWeek(day, completions);
              const count = exercises.filter((ex) => ex.dayNumber === day).length;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onOpenDay(day)}
                  className="border px-3.5 py-5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-[var(--eph-accent)]"
                  style={{ borderColor: 'var(--eph-line-2)', background: 'transparent' }}
                >
                  <div className="font-display text-[22px]" style={{ color: 'var(--eph-text)' }}>Día {day}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>
                    {!unlocked ? (
                      <span className="inline-flex items-center gap-1">
                        <IconLock size={11} /> Bloqueado
                      </span>
                    ) : completedThisWeek ? (
                      'Completado esta semana'
                    ) : (
                      `${count} ejercicio${count === 1 ? '' : 's'}`
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center font-body" style={{ color: 'var(--eph-body)' }}>Tu coach aún no configuró tus días de entrenamiento.</div>
        )}
      </section>

      {days.length > 0 && (
        <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
          <div className="overflow-hidden border" style={{ borderColor: 'var(--eph-line)' }}>
            <button
              type="button"
              onClick={() => setDisciplineOpen((v) => !v)}
              className="flex w-full items-center justify-between px-[18px] py-4 text-left font-display text-[15px]"
              style={{ background: 'var(--eph-surface-2)', color: 'var(--eph-text)' }}
            >
              Nivel de disciplina
              <span className="flex items-center gap-2.5">
                <span className="inline-block h-[2px] w-[70px] overflow-hidden" style={{ background: 'var(--eph-line-2)' }}>
                  <span
                    className="block h-full"
                    style={{ width: `${Math.min(stats.pct, 100)}%`, background: 'var(--eph-accent)' }}
                  />
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--eph-text)' }}>{stats.pct}%</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-muted)' }}>{disciplineOpen ? 'Ocultar' : 'Ver'}</span>
              </span>
            </button>
            {disciplineOpen && (
              <div className="px-[18px] pb-3 pt-[18px]" style={{ background: 'var(--eph-surface)' }}>
                <ProgressBar done={stats.doneDays} total={stats.expected} />
                <div className="mx-auto mt-3.5 grid max-w-[280px] grid-cols-7 gap-[5px]">
                  {calendarCells.map(({ day, completed }) => (
                    <div
                      key={day}
                      className="flex aspect-square flex-col items-center justify-center border font-mono text-[11px]"
                      style={completed
                        ? { borderColor: 'var(--eph-accent)', background: 'rgba(201,164,106,.16)', color: 'var(--eph-text)' }
                        : { borderColor: 'var(--eph-line)', color: 'var(--eph-faint)' }}
                    >
                      {completed ? <strong>{day}</strong> : <span>{day}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      <ProtocolDisclaimerFooter />
    </div>
  );
}
