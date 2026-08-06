'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Exercise, ExerciseCategory, TrainingCompletion, TrainingStreak } from '../../lib/training-client';
import {
  getClientTrainingDays,
  getClientName,
  listExercises,
  listTrainingCompletions,
  confirmSession,
  getStreak,
  useProtector,
} from '../../lib/training-client';
import { isDayCompletedThisWeek } from '../../lib/training-home-logic';
import { getQuoteOfTheDay, type MindsetQuote } from '../../lib/quotes-client';
import { TrainingHome } from './TrainingHome';
import { TrainingDayView } from './TrainingDayView';
import { TrainingPlayer } from './TrainingPlayer';
import { SessionConfirmedScreen } from './SessionConfirmedScreen';

export type TrainingShellProps = {
  clientId: string;
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function TrainingShell({ clientId }: TrainingShellProps) {
  const [trainingDays, setTrainingDays] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [completions, setCompletions] = useState<TrainingCompletion[]>([]);
  const [streak, setStreak] = useState<TrainingStreak | null>(null);
  const [quote, setQuote] = useState<MindsetQuote | null>(null);
  const [clientName, setClientName] = useState('');
  const [day, setDay] = useState<number | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completingDay, setCompletingDay] = useState(false);
  const [protectorPending, setProtectorPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<{ streak: TrainingStreak; phrase: string | null } | null>(null);
  // Sin esto, TrainingHome se monta con trainingDays=0 antes de que load()
  // resuelva y muestra por un instante el estado "sin días configurados"
  // aunque el cliente sí tenga rutina — un flash de contenido incorrecto.
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const tz = clientTz();
    const [days, name, exerciseList, completionList, streakState, quoteOfTheDay] = await Promise.all([
      getClientTrainingDays(clientId),
      getClientName(clientId),
      listExercises(clientId),
      listTrainingCompletions(clientId),
      getStreak(clientId, tz),
      getQuoteOfTheDay(clientId).catch(() => null),
    ]);
    setTrainingDays(days);
    setClientName(name);
    setExercises(exerciseList);
    setCompletions(completionList);
    setStreak(streakState);
    setQuote(quoteOfTheDay);
  }, [clientId]);

  useEffect(() => {
    load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  function openDay(d: number) {
    setDay(d);
    setCategory(null);
    setCompletedIds(new Set());
    setCompletionNotice(null);
  }

  function backToHome() {
    setDay(null);
    setCategory(null);
    setCompletedIds(new Set());
  }

  function backToDay() {
    setCategory(null);
  }

  async function handleCompleteDay() {
    setCompletingDay(true);
    try {
      const result = await confirmSession(clientId, clientTz());
      await load();
      if (result.alreadyConfirmedToday) {
        backToHome();
        setCompletionNotice('Ya confirmaste tu sesión de hoy — vuelve mañana para el siguiente día.');
      } else {
        setConfirmedResult({ streak: result.streak, phrase: result.phrase });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCompletingDay(false);
    }
  }

  function closeConfirmedScreen() {
    setConfirmedResult(null);
    backToHome();
  }

  async function handleUseProtector() {
    setProtectorPending(true);
    try {
      const streakState = await useProtector(clientId, clientTz());
      setStreak(streakState);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProtectorPending(false);
    }
  }

  function handleMarkComplete(exerciseId: string) {
    setCompletedIds((prev) => new Set(prev).add(exerciseId));
  }

  if (loading) return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Cargando tu rutina…</p>;
  if (error) return <p role="alert">{error}</p>;

  if (confirmedResult) {
    return (
      <SessionConfirmedScreen
        streak={confirmedResult.streak}
        phrase={confirmedResult.phrase}
        clientId={clientId}
        onClose={closeConfirmedScreen}
      />
    );
  }

  if (day && category) {
    const categoryExercises = exercises
      .filter((ex) => ex.dayNumber === day && ex.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return (
      <TrainingPlayer exercises={categoryExercises} completedIds={completedIds} onMarkComplete={handleMarkComplete} onExit={backToDay} />
    );
  }

  if (day) {
    const dayExercises = exercises.filter((ex) => ex.dayNumber === day);
    const alreadyCompletedThisWeek = isDayCompletedThisWeek(day, completions);
    return (
      <TrainingDayView
        day={day}
        exercises={dayExercises}
        completedIds={completedIds}
        alreadyCompletedThisWeek={alreadyCompletedThisWeek}
        onOpenCategory={setCategory}
        onCompleteDay={handleCompleteDay}
        completingDay={completingDay}
        onBack={backToHome}
      />
    );
  }

  return (
    <>
      {completionNotice && (
        <p>
          {completionNotice}
          <button type="button" onClick={() => setCompletionNotice(null)}>
            Cerrar
          </button>
        </p>
      )}
      <TrainingHome
        trainingDays={trainingDays}
        exercises={exercises}
        completions={completions}
        streak={streak}
        quote={quote}
        clientName={clientName}
        onOpenDay={openDay}
        onUseProtector={handleUseProtector}
        protectorPending={protectorPending}
      />
    </>
  );
}
