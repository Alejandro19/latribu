'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { ExerciseCategory, TrainingStreak } from '../../lib/training-client';
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
import { getQuoteOfTheDay } from '../../lib/quotes-client';
import { PermissionDeniedError } from '../../lib/api-client';
import { TrainingHome } from './TrainingHome';
import { TrainingDayView } from './TrainingDayView';
import { TrainingPlayer } from './TrainingPlayer';
import { SessionConfirmedScreen } from './SessionConfirmedScreen';
import { showToast } from '../layout/AppShell';
import LockedBenefit from '../ui/LockedBenefit';

export type TrainingShellProps = {
  clientId: string;
  clientType?: string | null;
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function fetchTrainingBundle(clientId: string) {
  const tz = clientTz();
  const [trainingDays, clientName, exercises, completions, streak, quote] = await Promise.all([
    getClientTrainingDays(clientId),
    getClientName(clientId),
    listExercises(clientId),
    listTrainingCompletions(clientId),
    getStreak(clientId, tz),
    getQuoteOfTheDay(clientId).catch(() => null),
  ]);
  return { trainingDays, clientName, exercises, completions, streak, quote };
}

export function TrainingShell({ clientId, clientType }: TrainingShellProps) {
  const { data, error: loadError, isLoading: loading, mutate } = useSWR(['training-bundle', clientId], () =>
    fetchTrainingBundle(clientId),
  );
  const [day, setDay] = useState<number | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completingDay, setCompletingDay] = useState(false);
  const [protectorPending, setProtectorPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<{ streak: TrainingStreak; phrase: string | null } | null>(null);

  function openDay(d: number) {
    setDay(d);
    setCategory(null);
    setCompletedIds(new Set());
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
      await mutate();
      if (result.alreadyConfirmedToday) {
        backToHome();
        showToast('Ya confirmaste tu sesión de hoy — vuelve mañana para el siguiente día.', 'info');
      } else {
        setConfirmedResult({ streak: result.streak, phrase: result.phrase });
      }
    } catch (e) {
      setActionError((e as Error).message);
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
      await mutate((current) => (current ? { ...current, streak: streakState } : current), { revalidate: false });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setProtectorPending(false);
    }
  }

  function handleMarkComplete(exerciseId: string) {
    setCompletedIds((prev) => new Set(prev).add(exerciseId));
  }

  if (loading) return <p className="font-body" style={{ color: 'var(--eph-body)', fontSize: 14 }}>Cargando tu rutina…</p>;
  if (loadError instanceof PermissionDeniedError) {
    return <LockedBenefit benefit="tu plan de entrenamiento" />;
  }
  const error = actionError || (loadError ? (loadError as Error).message : null);
  if (error) return <p role="alert" className="font-body" style={{ color: 'var(--eph-danger)' }}>{error}</p>;
  if (!data) return null;

  const { trainingDays, exercises, completions, streak, quote, clientName } = data;

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
      <TrainingHome
        clientId={clientId}
        clientType={clientType}
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
