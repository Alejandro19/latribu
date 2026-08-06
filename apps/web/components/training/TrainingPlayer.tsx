'use client';

import { useEffect, useState } from 'react';
import type { Exercise } from '../../lib/training-client';
import { parseTimeToSeconds, youtubeEmbedUrl } from '../../lib/training-timer-logic';
import { CATEGORY_LABELS, ProgressBar } from './TrainingVisuals';

export type TrainingPlayerProps = {
  exercises: Exercise[];
  completedIds: Set<string>;
  onMarkComplete: (exerciseId: string) => void;
  onExit: () => void;
};

function KpiTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-[18px] text-center">
      <div className="font-serif text-2xl font-semibold text-[var(--ink)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--ink-soft)]">{label}</div>
    </div>
  );
}

export function TrainingPlayer({ exercises, completedIds, onMarkComplete, onExit }: TrainingPlayerProps) {
  const [index, setIndex] = useState(0);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [durationRemaining, setDurationRemaining] = useState<number | null>(null);

  const current = exercises[index];
  const isLast = index === exercises.length - 1;
  const isCurrentDone = current ? completedIds.has(current.id) : false;
  const isCardio = current?.category === 'cardio';
  const doneInCategory = exercises.filter((ex) => completedIds.has(ex.id)).length;

  function startRest() {
    if (!current) return;
    setRestRemaining(parseTimeToSeconds(current.restTime));
  }

  // Reaches 0 -> auto-advance (or stop, if last exercise).
  useEffect(() => {
    if (restRemaining === null || restRemaining > 0) return;
    setRestRemaining(null);
    if (!isLast) setIndex((i) => i + 1);
  }, [restRemaining, isLast]);

  // A single interval drives the countdown for the whole rest period, keyed
  // off the resting/not-resting transition rather than the numeric value —
  // this avoids depending on a fresh effect run (and thus a React render
  // flush) between every tick, which fake timers can't guarantee.
  const isResting = restRemaining !== null;
  useEffect(() => {
    if (!isResting) return;
    const interval = setInterval(() => {
      setRestRemaining((s) => (s === null ? null : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isResting]);

  // Cardio's duration countdown chains into the same rest-timer flow once it
  // reaches 0: mark the exercise complete, then start the normal rest period.
  useEffect(() => {
    if (durationRemaining === null || durationRemaining > 0) return;
    setDurationRemaining(null);
    if (current) onMarkComplete(current.id);
    startRest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationRemaining]);

  const isCountingDuration = durationRemaining !== null;
  useEffect(() => {
    if (!isCountingDuration) return;
    const interval = setInterval(() => {
      setDurationRemaining((s) => (s === null ? null : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isCountingDuration]);

  function goTo(newIndex: number) {
    setRestRemaining(null);
    setDurationRemaining(null);
    setIndex(Math.max(0, Math.min(exercises.length - 1, newIndex)));
  }

  function handleMarkComplete() {
    if (!current) return;
    onMarkComplete(current.id);
    startRest();
  }

  function handleStartDuration() {
    if (!current) return;
    setDurationRemaining(parseTimeToSeconds(current.duration));
  }

  function handleSkipRest() {
    setRestRemaining(null);
    if (!isLast) setIndex((i) => i + 1);
  }

  if (!current) return null;

  const embedUrl = current.youtubeUrl ? youtubeEmbedUrl(current.youtubeUrl) : null;

  return (
    <div>
      <div className="mb-7">
        <button
          type="button"
          onClick={onExit}
          className="mb-3 inline-block bg-transparent p-0 text-xs font-semibold text-[#5C574E] hover:underline"
        >
          Volver al día
        </button>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
          Día {current.dayNumber} · {CATEGORY_LABELS[current.category]}
        </p>
        <h1 className="mb-1.5 font-serif text-[28px] font-bold text-[var(--ink)]">{current.title}</h1>
        <p className="m-0 text-[var(--ink-soft)]">
          Ejercicio {index + 1} de {exercises.length}
        </p>
        <ProgressBar done={doneInCategory} total={exercises.length} />
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        {embedUrl ? (
          <div className="relative overflow-hidden rounded-[14px] bg-black pt-[56.25%]">
            <iframe
              src={embedUrl}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : (
          <div className="py-10 text-center text-[var(--ink-soft)]">Sin video asignado.</div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {isCardio ? (
            <>
              <KpiTile value={current.duration || '-'} label="Duración" />
              <KpiTile value={current.restTime || '-'} label="Descanso" />
            </>
          ) : (
            <>
              <KpiTile value={current.series ?? '-'} label="Series" />
              <KpiTile value={current.reps || '-'} label="Repeticiones" />
              <KpiTile value={current.restTime || '-'} label="Descanso" />
            </>
          )}
        </div>

        {current.description && <p className="mt-4 text-[var(--ink)]">{current.description}</p>}

        {restRemaining !== null ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4 text-center">
            <p className="font-serif text-lg font-semibold text-[var(--ink)]">Descanso: {restRemaining}s</p>
            <button
              type="button"
              onClick={handleSkipRest}
              className="mt-2 rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-sm text-[var(--ink-soft)]"
            >
              Saltar descanso
            </button>
          </div>
        ) : isCardio ? (
          durationRemaining !== null ? (
            <p className="mt-4 text-center font-serif text-lg font-semibold text-[var(--ink)]">Duración: {durationRemaining}s</p>
          ) : (
            <div className="mt-5 text-center">
              <button
                type="button"
                disabled={isCurrentDone}
                onClick={handleStartDuration}
                className="rounded-full bg-[var(--terracota)] px-[22px] py-3 font-semibold text-white transition-transform active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Iniciar
              </button>
            </div>
          )
        ) : (
          <div className="mt-5 text-center">
            <button
              type="button"
              disabled={isCurrentDone}
              onClick={handleMarkComplete}
              className="rounded-full bg-[var(--terracota)] px-[22px] py-3 font-semibold text-white transition-transform active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marcar completado
            </button>
          </div>
        )}

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
            className="rounded-full border border-[var(--line)] bg-transparent px-[22px] py-3 font-semibold text-[var(--ink-soft)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          {isLast && isCurrentDone ? (
            <button
              type="button"
              onClick={onExit}
              className="rounded-full bg-[var(--terracota)] px-[22px] py-3 font-semibold text-white"
            >
              Finalizar
            </button>
          ) : (
            <button
              type="button"
              disabled={isLast}
              onClick={() => goTo(index + 1)}
              className="rounded-full border border-[var(--line)] bg-transparent px-[22px] py-3 font-semibold text-[var(--ink-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
