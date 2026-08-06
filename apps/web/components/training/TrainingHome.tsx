'use client';

import { useState } from 'react';
import type { Exercise, TrainingCompletion, TrainingStreak } from '../../lib/training-client';
import type { MindsetQuote } from '../../lib/quotes-client';
import { isDayUnlocked, isDayCompletedThisWeek, calculateDisciplineStats } from '../../lib/training-home-logic';
import IdentityHeader from '../ui/IdentityHeader';
import { ProgressBar } from './TrainingVisuals';

export type TrainingHomeProps = {
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
      <IdentityHeader title="Entrenamiento" subtitle={trainingDays ? 'Tu programa de ejercicios personalizado.' : undefined} />

      {quote && (
        <div className="mb-[22px] border-b border-[var(--line)] pb-[18px] font-serif text-xl font-medium italic leading-snug text-[var(--ink)]">
          <span className="mb-2 block font-sans text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Hola {clientName}, repite después de mí:
          </span>
          &quot;{quote.quote}&quot;
          {quote.author && <p className="mt-1.5 text-xs font-sans not-italic text-[var(--ink-soft)]">— {quote.author}</p>}
        </div>
      )}

      {streak && (
        <div className="mb-4 flex justify-end">
          <div
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 ${
              streak.atRisk ? 'border-[#F0DAC0] bg-[#FBEFE4]' : 'border-[#E7DFC9] bg-white'
            }`}
          >
            <span className="text-base">🔥</span>
            <span className="font-serif text-[15px] font-bold text-[#2B2621]">{streak.streakWeeks}</span>
            <span className={`text-[9.5px] ${streak.atRisk ? 'font-semibold text-[#B8794A]' : 'text-[#8A8377]'}`}>
              {streak.atRisk ? 'en riesgo' : streak.streakWeeks === 1 ? 'semana seguida' : 'semanas seguidas'}
            </span>
          </div>
        </div>
      )}

      {heroDay !== null && (
        <div
          className="relative mb-6 overflow-hidden rounded-[20px] p-7 text-white"
          style={{ background: 'linear-gradient(135deg, #2B2621, #3A322A)' }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,.16) 0%, transparent 70%)' }}
          />
          <p className="relative z-10 mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#D9BE8C]">
            HOY · DÍA {heroDay}
          </p>
          <p className="relative z-10 mb-1.5 font-serif text-xl font-semibold">
            {heroCount === 0 ? 'Aún no tienes ejercicios asignados' : `${heroCount} ejercicio${heroCount === 1 ? '' : 's'} por entrenar`}
          </p>
          {heroCount > 0 && <p className="relative z-10 text-[13px] opacity-75">Asignados por tu mentor</p>}
          <div className="relative z-10 mt-5 flex items-center justify-end gap-4">
            <button
              type="button"
              disabled={heroCount === 0}
              onClick={() => onOpenDay(heroDay)}
              className="whitespace-nowrap rounded-full bg-[#D9BE8C] px-5 py-2.5 text-[13px] font-bold text-[#2B2621] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Comenzar sesión
            </button>
          </div>
        </div>
      )}

      {streak && (
        <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
          <div className="mb-1 font-serif text-[15px] font-bold text-[var(--ink)]">Tu semana</div>
          <div className="flex items-center gap-2.5">
            {Array.from({ length: streak.sessionsRequiredThisWeek }, (_, i) => i + 1).map((n) => {
              const done = n <= streak.sessionsDoneThisWeek;
              const shielded = !done && streak.protectorUsedThisWeek;
              return (
                <div
                  key={n}
                  className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-[13px] transition-colors ${
                    done
                      ? 'border-[#B8935A] bg-[#B8935A] text-white'
                      : shielded
                        ? 'border border-[#E1D5EE] bg-[#F1EAF7] text-[#8A5FA0]'
                        : 'border border-dashed border-[#D9A441] font-bold text-[#B8935A]'
                  } border`}
                >
                  {done ? '✓' : shielded ? '🛡️' : '?'}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-[var(--ink-soft)]">
            {streak.protectorUsedThisWeek
              ? 'Semana protegida — no necesitas completar más sesiones para conservar tu racha.'
              : `${streak.sessionsDoneThisWeek} de ${streak.sessionsRequiredThisWeek} sesiones completadas.`}
          </p>
          <div className="mt-4 flex items-center gap-3 border-t border-[#E7DFC9] pt-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F1EAF7] text-[15px]">
              🛡️
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-[#2B2621]">
                {streak.protectorUsedThisWeek ? 'Protector ya usado esta semana' : 'Protector de racha disponible'}
              </div>
              <div className="mt-0.5 text-[10.5px] text-[#8A8377]">
                {streak.protectorUsedThisWeek
                  ? 'Vuelve a estar disponible la próxima semana.'
                  : 'Úsalo si esta semana no puedes completar tus sesiones — tu racha no se rompe.'}
              </div>
            </div>
            <button
              type="button"
              disabled={streak.protectorUsedThisWeek || protectorPending}
              onClick={onUseProtector}
              className="h-8 flex-shrink-0 rounded-full border border-[#E1D5EE] px-3.5 text-[11px] font-bold text-[#8A5FA0] disabled:cursor-default disabled:opacity-40"
            >
              {streak.protectorUsedThisWeek ? 'Usado' : 'Usar protector'}
            </button>
          </div>
        </section>
      )}

      <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Días de entrenamiento</h2>
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
                  className="rounded-2xl border border-[#E7DFC9] bg-white px-3.5 py-5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-[#B8935A] enabled:hover:shadow-[0_6px_16px_rgba(184,147,90,.15)]"
                >
                  <div className="font-serif text-[22px] font-semibold text-[var(--ink)]">Día {day}</div>
                  <div className="mt-1 text-[10px] text-[#8A8377]">
                    {!unlocked ? (
                      <>
                        <span className="text-[13px]">🔒</span> Bloqueado
                      </>
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
          <div className="py-10 text-center text-[var(--ink-soft)]">Tu coach aún no configuró tus días de entrenamiento.</div>
        )}
      </section>

      {days.length > 0 && (
        <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
          <div className="overflow-hidden rounded-[18px] border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setDisciplineOpen((v) => !v)}
              className="flex w-full items-center justify-between bg-[var(--cream)] px-[18px] py-4 text-left text-[15px] font-bold"
            >
              Nivel de disciplina
              <span className="flex items-center gap-2.5">
                <span className="inline-block h-1.5 w-[70px] overflow-hidden rounded-full bg-[var(--line)]">
                  <span
                    className="block h-full rounded-full bg-[var(--terracota)]"
                    style={{ width: `${Math.min(stats.pct, 100)}%` }}
                  />
                </span>
                <span className="text-xs font-bold text-[var(--terracota)]">{stats.pct}%</span>
                <span className="text-sm text-[var(--terracota)]">{disciplineOpen ? 'Ocultar' : 'Ver'}</span>
              </span>
            </button>
            {disciplineOpen && (
              <div className="bg-[var(--paper)] px-[18px] pb-3 pt-[18px]">
                <ProgressBar done={stats.doneDays} total={stats.expected} />
                <div className="mx-auto mt-3.5 grid max-w-[280px] grid-cols-7 gap-[5px]">
                  {calendarCells.map(({ day, completed }) => (
                    <div
                      key={day}
                      className={`flex aspect-square flex-col items-center justify-center rounded-[10px] border text-[11px] ${
                        completed ? 'border-[var(--sage)] bg-[var(--sage-soft)]' : 'border-[var(--line)] bg-[var(--cream)]'
                      }`}
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
    </div>
  );
}
