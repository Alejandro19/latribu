import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TrainingPlayer } from '../components/training/TrainingPlayer';
import type { Exercise } from '../lib/training-client';

function exercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    clientId: 'c1',
    title: `Ejercicio ${id}`,
    dayNumber: 1,
    category: 'strength',
    series: 3,
    reps: '10',
    duration: null,
    restTime: '00:02',
    youtubeUrl: null,
    description: null,
    recommendations: null,
    sortOrder: 0,
    ...overrides,
  };
}

describe('TrainingPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the current exercise complete and starts the rest timer', () => {
    const onMarkComplete = vi.fn();
    render(<TrainingPlayer exercises={[exercise('e1'), exercise('e2')]} completedIds={new Set()} onMarkComplete={onMarkComplete} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar completado' }));
    expect(onMarkComplete).toHaveBeenCalledWith('e1');
    expect(screen.getByText(/Descanso: \d+s/)).toBeInTheDocument();
  });

  it('auto-advances to the next exercise when the rest timer reaches 0', () => {
    render(
      <TrainingPlayer
        exercises={[exercise('e1'), exercise('e2')]}
        completedIds={new Set()}
        onMarkComplete={vi.fn()}
        onExit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marcar completado' }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Ejercicio e2')).toBeInTheDocument();
  });

  it('navigates with Anterior/Siguiente and calls onExit after Finalizar on the last exercise', () => {
    const onExit = vi.fn();
    render(
      <TrainingPlayer
        exercises={[exercise('e1'), exercise('e2')]}
        completedIds={new Set(['e1', 'e2'])}
        onMarkComplete={vi.fn()}
        onExit={onExit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Ejercicio e2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('shows series/reps KPIs for a non-cardio exercise and an Iniciar button for cardio', () => {
    const { rerender } = render(
      <TrainingPlayer exercises={[exercise('e1', { series: 4, reps: '12' })]} completedIds={new Set()} onMarkComplete={vi.fn()} onExit={vi.fn()} />
    );
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    rerender(
      <TrainingPlayer
        exercises={[exercise('e1', { category: 'cardio', duration: '05:00', series: null, reps: null })]}
        completedIds={new Set()}
        onMarkComplete={vi.fn()}
        onExit={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar completado' })).not.toBeInTheDocument();
  });

  it('always shows a Volver al día button that calls onExit regardless of position', () => {
    const onExit = vi.fn();
    render(<TrainingPlayer exercises={[exercise('e1'), exercise('e2')]} completedIds={new Set()} onMarkComplete={vi.fn()} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al día' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('runs a cardio duration countdown, then auto-completes and starts the rest timer', () => {
    const onMarkComplete = vi.fn();
    render(
      <TrainingPlayer
        exercises={[exercise('e1', { category: 'cardio', duration: '00:02', series: null, reps: null })]}
        completedIds={new Set()}
        onMarkComplete={onMarkComplete}
        onExit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    expect(screen.getByText(/Duración: 2s/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onMarkComplete).toHaveBeenCalledWith('e1');
    expect(screen.getByText(/Descanso: \d+s/)).toBeInTheDocument();
  });
});
