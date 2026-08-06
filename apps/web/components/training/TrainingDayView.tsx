'use client';

import type { Exercise, ExerciseCategory } from '../../lib/training-client';
import { CATEGORY_ORDER, getCategoryLockState } from '../../lib/training-day-logic';
import { CATEGORY_LABELS, CategoryIcon, MiniRing, ProgressBar } from './TrainingVisuals';

export type TrainingDayViewProps = {
  day: number;
  exercises: Exercise[];
  completedIds: Set<string>;
  alreadyCompletedThisWeek: boolean;
  onOpenCategory: (category: ExerciseCategory) => void;
  onCompleteDay: () => Promise<void>;
  completingDay: boolean;
  onBack: () => void;
};

export function TrainingDayView({
  day,
  exercises,
  completedIds,
  alreadyCompletedThisWeek,
  onOpenCategory,
  onCompleteDay,
  completingDay,
  onBack,
}: TrainingDayViewProps) {
  const allDone = exercises.length > 0 && exercises.every((ex) => completedIds.has(ex.id));
  const doneCount = exercises.filter((ex) => completedIds.has(ex.id)).length;
  const totalCount = exercises.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div>
      <div className="mb-7">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-block bg-transparent p-0 text-xs font-semibold text-[#5C574E] hover:underline"
        >
          ← Días de entrenamiento
        </button>
        <h1 className="mb-1.5 font-serif text-[28px] font-bold text-[var(--ink)]">Día {day}</h1>
        <p className="m-0 text-[var(--ink-soft)]">Elige qué vas a entrenar hoy.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORY_ORDER.map((category) => {
          const state = alreadyCompletedThisWeek
            ? exercises.some((ex) => ex.category === category)
              ? 'done'
              : 'no_asignada'
            : getCategoryLockState(category, exercises, completedIds);
          const list = exercises.filter((ex) => ex.category === category);
          const catDone = list.filter((ex) => completedIds.has(ex.id)).length;
          const disabled = state === 'no_asignada' || state === 'locked';
          const countText =
            state === 'no_asignada'
              ? 'No asignado'
              : state === 'locked'
                ? 'Bloqueado'
                : list.length > 0 && catDone === list.length
                  ? `${catDone}/${list.length} · ✓ Completado`
                  : `${catDone}/${list.length} ejercicio${list.length === 1 ? '' : 's'}`;

          return (
            <button
              key={category}
              type="button"
              disabled={disabled}
              onClick={() => onOpenCategory(category)}
              className={`flex flex-col items-center rounded-2xl border px-3.5 py-5 text-center transition-colors disabled:cursor-not-allowed ${
                state === 'no_asignada'
                  ? 'border-[#E7DFC9] bg-[#F0EBE0] opacity-40'
                  : state === 'locked'
                    ? 'border-[#E7DFC9] bg-white opacity-45'
                    : state === 'done'
                      ? 'border-2 border-[#5B7A4E] bg-[#F4F8EF]'
                      : 'border-2 border-[#5B7A4E] bg-white'
              } ${!disabled ? 'enabled:hover:border-[#B8935A] enabled:hover:shadow-[0_6px_16px_rgba(184,147,90,.15)]' : ''}`}
            >
              {state === 'locked' ? (
                <span className="text-[15px]">🔒</span>
              ) : (
                <CategoryIcon category={category} className={state === 'done' ? 'text-[#5B7A4E]' : 'text-[#8A8377]'} />
              )}
              <div className="mt-2 font-serif text-[15px] font-semibold text-[var(--ink)]">
                {CATEGORY_LABELS[category]}
                {state === 'locked' ? ' 🔒' : state === 'done' ? ' ✓' : ''}
              </div>
              <div className="mt-1 text-[10px] text-[#8A8377]">{countText}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        <div className="flex items-center gap-4">
          <MiniRing pct={pct} />
          <div className="flex-1">
            <ProgressBar done={doneCount} total={totalCount} />
          </div>
        </div>
        {alreadyCompletedThisWeek ? (
          <p className="mt-4 text-center text-[var(--ink-soft)]">Día completado esta semana.</p>
        ) : (
          <div className="mt-4 text-center">
            <button
              type="button"
              disabled={!allDone || completingDay}
              onClick={() => onCompleteDay()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--terracota)] px-[22px] py-3 font-semibold text-white transition-transform active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Completar Entrenamiento Día {day}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
