'use client';

import { useEffect, useState } from 'react';
import type { Exercise } from '../../lib/training-client';
import { parseTimeToSeconds, youtubeEmbedUrl } from '../../lib/training-timer-logic';
import { CATEGORY_LABELS, ProgressBar } from './TrainingVisuals';
import Button from '../ui/Button';

export type TrainingPlayerProps = {
  exercises: Exercise[];
  completedIds: Set<string>;
  onMarkComplete: (exerciseId: string) => void;
  onExit: () => void;
};

function KpiTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="border p-[18px] text-center" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
      <div className="font-display text-2xl" style={{ color: 'var(--eph-text)' }}>{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>{label}</div>
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
          className="mb-3 inline-block bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] hover:underline"
          style={{ color: 'var(--eph-muted)' }}
        >
          Volver al día
        </button>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--eph-muted)' }}>
          Día {current.dayNumber} · {CATEGORY_LABELS[current.category]}
        </p>
        <h1 className="mb-1.5 font-display text-[28px]" style={{ color: 'var(--eph-text)' }}>{current.title}</h1>
        <p className="m-0 font-body" style={{ color: 'var(--eph-body)' }}>
          Ejercicio {index + 1} de {exercises.length}
        </p>
        <ProgressBar done={doneInCategory} total={exercises.length} />
      </div>

      <div className="border p-[26px]" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        {embedUrl ? (
          <div className="relative overflow-hidden bg-black pt-[56.25%]">
            <iframe
              src={embedUrl}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : (
          <div className="py-10 text-center font-body" style={{ color: 'var(--eph-body)' }}>Sin video asignado.</div>
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

        {current.description && <p className="mt-4 font-body" style={{ color: 'var(--eph-text)' }}>{current.description}</p>}

        {restRemaining !== null ? (
          <div className="mt-4 border p-4 text-center" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
            <p className="font-display text-lg" style={{ color: 'var(--eph-text)' }}>Descanso: {restRemaining}s</p>
            <Button type="button" variant="secondary" onClick={handleSkipRest} className="mt-2">
              Saltar descanso
            </Button>
          </div>
        ) : isCardio ? (
          durationRemaining !== null ? (
            <p className="mt-4 text-center font-display text-lg" style={{ color: 'var(--eph-text)' }}>Duración: {durationRemaining}s</p>
          ) : (
            <div className="mt-5 text-center">
              <Button type="button" variant="primary" disabled={isCurrentDone} onClick={handleStartDuration}>
                Iniciar
              </Button>
            </div>
          )
        ) : (
          <div className="mt-5 text-center">
            <Button type="button" variant="primary" disabled={isCurrentDone} onClick={handleMarkComplete}>
              Marcar completado
            </Button>
          </div>
        )}

        <div className="mt-5 flex justify-between gap-2">
          <Button type="button" variant="secondary" disabled={index === 0} onClick={() => goTo(index - 1)}>
            Anterior
          </Button>
          {isLast && isCurrentDone ? (
            <Button type="button" variant="primary" onClick={onExit}>
              Finalizar
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled={isLast} onClick={() => goTo(index + 1)}>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
