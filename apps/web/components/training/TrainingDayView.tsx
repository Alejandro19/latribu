'use client';

import type { Exercise, ExerciseCategory } from '../../lib/training-client';
import { CATEGORY_ORDER, getCategoryLockState } from '../../lib/training-day-logic';
import { CATEGORY_LABELS, CategoryIcon, MiniRing, ProgressBar } from './TrainingVisuals';
import { IconLock } from '../ui/icons';
import Button from '../ui/Button';

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
          className="mb-3 inline-block bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] hover:underline"
          style={{ color: 'var(--eph-muted)' }}
        >
          ← Días de entrenamiento
        </button>
        <h1 className="mb-1.5 font-display text-[28px]" style={{ color: 'var(--eph-text)' }}>Día {day}</h1>
        <p className="m-0 font-body" style={{ color: 'var(--eph-body)' }}>Elige qué vas a entrenar hoy.</p>
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

          const stateStyle =
            state === 'no_asignada'
              ? { borderColor: 'var(--eph-line)', opacity: 0.4 }
              : state === 'locked'
                ? { borderColor: 'var(--eph-line)', opacity: 0.45 }
                : state === 'done'
                  ? { borderColor: 'var(--eph-accent)', background: 'rgba(201,164,106,.08)' }
                  : { borderColor: 'var(--eph-accent)' };

          return (
            <button
              key={category}
              type="button"
              disabled={disabled}
              onClick={() => onOpenCategory(category)}
              className={`flex flex-col items-center border px-3.5 py-5 text-center transition-colors disabled:cursor-not-allowed ${!disabled ? 'enabled:hover:border-[var(--eph-accent-hi)]' : ''}`}
              style={stateStyle}
            >
              {state === 'locked' ? (
                <IconLock size={15} style={{ color: 'var(--eph-faint)' }} />
              ) : (
                <span style={{ color: state === 'done' ? 'var(--eph-accent)' : 'var(--eph-muted)' }}>
                  <CategoryIcon category={category} />
                </span>
              )}
              <div className="mt-2 flex items-center justify-center gap-1 font-display text-[15px]" style={{ color: 'var(--eph-text)' }}>
                {CATEGORY_LABELS[category]}
                {state === 'locked' && <IconLock size={11} style={{ color: 'var(--eph-faint)' }} />}
                {state === 'done' ? ' ✓' : ''}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-muted)' }}>{countText}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t pt-6" style={{ borderColor: 'var(--eph-line)' }}>
        <div className="flex items-center gap-4">
          <MiniRing pct={pct} />
          <div className="flex-1">
            <ProgressBar done={doneCount} total={totalCount} />
          </div>
        </div>
        {alreadyCompletedThisWeek ? (
          <p className="mt-4 text-center font-body" style={{ color: 'var(--eph-body)' }}>Día completado esta semana.</p>
        ) : (
          <div className="mt-4 text-center">
            <Button type="button" variant="primary" disabled={!allDone || completingDay} onClick={() => onCompleteDay()}>
              Completar Entrenamiento Día {day}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
