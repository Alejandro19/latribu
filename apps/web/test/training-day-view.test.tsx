import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrainingDayView } from '../components/training/TrainingDayView';
import type { Exercise } from '../lib/training-client';

function exercise(id: string, category: Exercise['category']): Exercise {
  return {
    id,
    clientId: 'c1',
    title: id,
    dayNumber: 1,
    category,
    series: 3,
    reps: '10',
    duration: null,
    restTime: '01:00',
    youtubeUrl: null,
    description: null,
    recommendations: null,
    sortOrder: 0,
  };
}

describe('TrainingDayView', () => {
  it('disables a locked category and enables the first active one', () => {
    const exercises = [exercise('e1', 'warmup'), exercise('e2', 'strength')];
    render(
      <TrainingDayView
        day={1}
        exercises={exercises}
        completedIds={new Set()}
        alreadyCompletedThisWeek={false}
        onOpenCategory={vi.fn()}
        onCompleteDay={vi.fn()}
        completingDay={false}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Calentamiento/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Fuerza/ })).toBeDisabled();
  });

  it('enables "Completar Entrenamiento" only when every exercise is done', () => {
    const exercises = [exercise('e1', 'warmup')];
    const { rerender } = render(
      <TrainingDayView
        day={1}
        exercises={exercises}
        completedIds={new Set()}
        alreadyCompletedThisWeek={false}
        onOpenCategory={vi.fn()}
        onCompleteDay={vi.fn()}
        completingDay={false}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Completar Entrenamiento/ })).toBeDisabled();

    rerender(
      <TrainingDayView
        day={1}
        exercises={exercises}
        completedIds={new Set(['e1'])}
        alreadyCompletedThisWeek={false}
        onOpenCategory={vi.fn()}
        onCompleteDay={vi.fn()}
        completingDay={false}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Completar Entrenamiento/ })).toBeEnabled();
  });

  it('calls onCompleteDay when the button is clicked', () => {
    const onCompleteDay = vi.fn();
    const exercises = [exercise('e1', 'warmup')];
    render(
      <TrainingDayView
        day={1}
        exercises={exercises}
        completedIds={new Set(['e1'])}
        alreadyCompletedThisWeek={false}
        onOpenCategory={vi.fn()}
        onCompleteDay={onCompleteDay}
        completingDay={false}
        onBack={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Completar Entrenamiento/ }));
    expect(onCompleteDay).toHaveBeenCalled();
  });

  it('shows the "already completed this week" status and hides the complete button, even with empty completedIds', () => {
    const exercises = [exercise('e1', 'warmup')];
    render(
      <TrainingDayView
        day={1}
        exercises={exercises}
        completedIds={new Set()}
        alreadyCompletedThisWeek={true}
        onOpenCategory={vi.fn()}
        onCompleteDay={vi.fn()}
        completingDay={false}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText('Día completado esta semana.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Completar Entrenamiento/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Calentamiento ✓/ })).toBeInTheDocument();
  });

  it('keeps an unassigned category disabled even when the day is already completed this week', () => {
    const exercises = [exercise('e1', 'strength')];
    render(
      <TrainingDayView
        day={1}
        exercises={exercises}
        completedIds={new Set()}
        alreadyCompletedThisWeek={true}
        onOpenCategory={vi.fn()}
        onCompleteDay={vi.fn()}
        completingDay={false}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Cardio/ })).toBeDisabled();
  });
});
