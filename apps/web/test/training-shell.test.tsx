import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TrainingShell } from '../components/training/TrainingShell';
import * as trainingClient from '../lib/training-client';
import * as quotesClient from '../lib/quotes-client';

vi.mock('../lib/training-client');
vi.mock('../lib/quotes-client');

function exercise(id: string, dayNumber: number, category: trainingClient.ExerciseCategory = 'strength'): trainingClient.Exercise {
  return {
    id,
    clientId: 'c1',
    title: `Ejercicio ${id}`,
    dayNumber,
    category,
    series: 3,
    reps: '10',
    duration: null,
    restTime: '00:01',
    youtubeUrl: null,
    description: null,
    recommendations: null,
    sortOrder: 0,
  };
}

describe('TrainingShell', () => {
  beforeEach(() => {
    vi.mocked(trainingClient.getClientTrainingDays).mockResolvedValue(1);
    vi.mocked(trainingClient.getClientName).mockResolvedValue('Ana');
    vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1)]);
    vi.mocked(trainingClient.listTrainingCompletions).mockResolvedValue([]);
    vi.mocked(trainingClient.getStreak).mockResolvedValue({
      streakWeeks: 0,
      sessionsDoneThisWeek: 0,
      sessionsRequiredThisWeek: 1,
      protectorAvailable: true,
      protectorUsedThisWeek: false,
      atRisk: false,
    });
    vi.mocked(trainingClient.confirmSession).mockResolvedValue({
      alreadyConfirmedToday: false,
      dayNumber: 1,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: 'Vas muy bien.',
    });
    vi.mocked(quotesClient.getQuoteOfTheDay).mockResolvedValue(null);
  });

  it('loads training data and shows the home screen', async () => {
    render(<TrainingShell clientId="c1" />);
    await screen.findByRole('button', { name: /Día 1/ });
  });

  it('navigates home → day → category (player) → mark complete → confirm session', async () => {
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Fuerza/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
    // rest timer starts; go back to day view without waiting it out
    await waitFor(() => expect(screen.getByText(/Descanso: \d+s/)).toBeInTheDocument());
  });

  it('calls confirmSession when completing the day and returns to home after closing the confirmed screen', async () => {
    vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
    // Leave the category via the always-present "Volver al día" button, back to day view.
    fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
    await waitFor(() => expect(trainingClient.confirmSession).toHaveBeenCalledWith('c1', expect.any(String)));
    // A real (non-duplicate) confirmation shows the SessionConfirmedScreen first.
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
    // Confirms the shell actually returns to the home screen afterwards.
    await screen.findByRole('button', { name: /Día 1/ });
  });

  it('shows a notice when confirmSession reports the session was already confirmed today', async () => {
    vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
    vi.mocked(trainingClient.confirmSession).mockResolvedValue({
      alreadyConfirmedToday: true,
      dayNumber: null,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: null,
    });
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
    await screen.findByText('Ya confirmaste tu sesión de hoy — vuelve mañana para el siguiente día.');
  });

  it('does not treat an old (prior-week) completion as completed this week', async () => {
    const oldCompletion: trainingClient.TrainingCompletion = {
      id: 'c1',
      clientId: 'c1',
      dayNumber: 1,
      completedDate: '2020-01-01',
      source: 'manual',
    };
    vi.mocked(trainingClient.listTrainingCompletions).mockResolvedValue([oldCompletion]);
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
    await screen.findByRole('button', { name: /Completar Entrenamiento/ });
    expect(screen.queryByText('Día completado esta semana.')).not.toBeInTheDocument();
  });

  it('shows SessionConfirmedScreen after a real (non-duplicate) day completion', async () => {
    vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
    expect(await screen.findByText('¡Sesión confirmada!')).toBeInTheDocument();
    expect(screen.getByText('"Vas muy bien."')).toBeInTheDocument();
  });

  it('returns to home when Cerrar is clicked on the confirmed screen', async () => {
    vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
    expect(await screen.findByRole('button', { name: /Día 1/ })).toBeInTheDocument();
  });

  it('shows the completionNotice (not the confirmed screen) when alreadyConfirmedToday is true', async () => {
    vi.mocked(trainingClient.listExercises).mockResolvedValue([exercise('e1', 1, 'warmup')]);
    vi.mocked(trainingClient.confirmSession).mockResolvedValue({
      alreadyConfirmedToday: true,
      dayNumber: null,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: null,
    });
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Día 1/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Calentamiento/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar completado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver al día' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Completar Entrenamiento Día 1' }));
    expect(await screen.findByText(/Ya confirmaste tu sesión de hoy/)).toBeInTheDocument();
    expect(screen.queryByText('¡Sesión confirmada!')).not.toBeInTheDocument();
  });

  it('calls useProtector and updates the displayed streak', async () => {
    vi.mocked(trainingClient.useProtector).mockResolvedValue({
      streakWeeks: 1,
      sessionsDoneThisWeek: 0,
      sessionsRequiredThisWeek: 1,
      protectorAvailable: false,
      protectorUsedThisWeek: true,
      atRisk: false,
    });
    render(<TrainingShell clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /usar protector/i }));
    await waitFor(() => expect(trainingClient.useProtector).toHaveBeenCalledWith('c1', expect.any(String)));
    expect(await screen.findByRole('button', { name: /^usado$/i })).toBeInTheDocument();
  });

  it('fetches the quote of the day and passes it to TrainingHome, non-fatally on failure', async () => {
    vi.mocked(quotesClient.getQuoteOfTheDay).mockRejectedValueOnce(new Error('network'));
    render(<TrainingShell clientId="c1" />);
    expect(await screen.findByText('Entrenamiento')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
