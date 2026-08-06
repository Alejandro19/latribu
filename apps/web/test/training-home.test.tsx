import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrainingHome } from '../components/training/TrainingHome';
import type { Exercise, TrainingCompletion } from '../lib/training-client';

function exercise(id: string, dayNumber: number): Exercise {
  return {
    id,
    clientId: 'c1',
    title: `Ejercicio ${id}`,
    dayNumber,
    category: 'strength',
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

describe('TrainingHome', () => {
  it('renders one tile per training day and calls onOpenDay for an unlocked day', () => {
    const onOpenDay = vi.fn();
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[exercise('e1', 1), exercise('e2', 2)]}
        completions={[]}
        streak={null}
        quote={null}
        clientName="Ana"
        onOpenDay={onOpenDay}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.getByRole('button', { name: /Día 1/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Día 1/ }));
    expect(onOpenDay).toHaveBeenCalledWith(1);
  });

  it('disables a locked day', () => {
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[exercise('e1', 1), exercise('e2', 2)]}
        completions={[]}
        streak={null}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.getByRole('button', { name: /Día 2/ })).toBeDisabled();
  });

  it('shows the discipline calendar section', () => {
    render(
      <TrainingHome
        trainingDays={1}
        exercises={[]}
        completions={[]}
        streak={null}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.getByText('Nivel de disciplina')).toBeInTheDocument();
  });

  it('renders one calendar cell per day of the current month, marking completed dates', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const completedIso = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const completion: TrainingCompletion = { id: 'c1', clientId: 'c1', dayNumber: 1, completedDate: completedIso, source: 'manual' };

    render(
      <TrainingHome
        trainingDays={1}
        exercises={[]}
        completions={[completion]}
        streak={null}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );

    // El calendario vive dentro de un acordeón colapsado por defecto.
    fireEvent.click(screen.getByText('Nivel de disciplina'));

    // One cell per day of the month (day "1" appears as a marked <strong>).
    expect(screen.getAllByText(String(daysInMonth)).length).toBeGreaterThan(0);
    const markedDay1 = screen.getByText('1', { selector: 'strong' });
    expect(markedDay1).toBeInTheDocument();
  });

  it('shows a Comenzar sesión hero button that opens the next actionable day', () => {
    const onOpenDay = vi.fn();
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[exercise('e1', 1), exercise('e2', 2)]}
        completions={[]}
        streak={null}
        quote={null}
        clientName="Ana"
        onOpenDay={onOpenDay}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar sesión' }));
    expect(onOpenDay).toHaveBeenCalledWith(1);
  });

  it('does not render the hero button when there is no next actionable day', () => {
    render(
      <TrainingHome
        trainingDays={0}
        exercises={[]}
        completions={[]}
        streak={null}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.queryByRole('button', { name: 'Comenzar sesión' })).not.toBeInTheDocument();
  });

  it('renders the streak badge with the current streakWeeks', () => {
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[]}
        completions={[]}
        streak={{ streakWeeks: 3, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false }}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    // Scoped to the streak badge container: a bare getByText('3') is ambiguous here because
    // the pre-existing discipline calendar also renders an unmarked "3" span for day 3 of the month.
    const badge = screen.getByText('🔥').closest('div');
    expect(badge).toHaveTextContent('3');
    expect(badge).toHaveTextContent(/semanas seguidas/);
  });

  it('shows an "en riesgo" label when atRisk is true', () => {
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[]}
        completions={[]}
        streak={{ streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: true }}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.getByText(/en riesgo/)).toBeInTheDocument();
  });

  it('calls onUseProtector when the protector button is clicked, and disables it once used', () => {
    const onUseProtector = vi.fn();
    const { rerender } = render(
      <TrainingHome
        trainingDays={2}
        exercises={[]}
        completions={[]}
        streak={{ streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false }}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={onUseProtector}
        protectorPending={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /usar/i }));
    expect(onUseProtector).toHaveBeenCalled();

    rerender(
      <TrainingHome
        trainingDays={2}
        exercises={[]}
        completions={[]}
        streak={{ streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 2, protectorAvailable: false, protectorUsedThisWeek: true, atRisk: false }}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={onUseProtector}
        protectorPending={false}
      />
    );
    expect(screen.getByRole('button', { name: /usar|usado/i })).toBeDisabled();
  });

  it('renders the affirmation banner when a quote is present', () => {
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[]}
        completions={[]}
        streak={null}
        quote={{ id: 'q1', quote: 'Estoy en mi mejor momento', author: 'La Tribu', active: true }}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.getByText(/Hola Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Estoy en mi mejor momento/)).toBeInTheDocument();
    expect(screen.getByText(/La Tribu/)).toBeInTheDocument();
  });

  it('renders the affirmation banner with the quote but no author line when the quote has no author', () => {
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[]}
        completions={[]}
        streak={null}
        quote={{ id: 'q1', quote: 'Estoy en mi mejor momento', author: null, active: true }}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.getByText(/Hola Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Estoy en mi mejor momento/)).toBeInTheDocument();
    const banner = screen.getByText(/Hola Ana/).closest('div');
    expect(banner).not.toHaveTextContent('—');
  });

  it('renders no banner when quote is null', () => {
    render(
      <TrainingHome
        trainingDays={2}
        exercises={[]}
        completions={[]}
        streak={null}
        quote={null}
        clientName="Ana"
        onOpenDay={vi.fn()}
        onUseProtector={vi.fn()}
        protectorPending={false}
      />
    );
    expect(screen.queryByText(/repite después de mí/)).not.toBeInTheDocument();
  });
});
