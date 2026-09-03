import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import TrainingPage from '../app/(app)/training/page';
import { showToast } from '../components/layout/AppShell';
import * as trainingClient from '../lib/training-client';
import { clearPendingAction } from '../lib/deep-link';

vi.mock('../lib/training-client');
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ role: 'cliente', user: { id: 'client-1', name: '', email: '' } }),
}));
vi.mock('../components/layout/AppShell', () => ({ showToast: vi.fn() }));

const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

describe('TrainingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockClear();
    clearPendingAction();
    vi.mocked(trainingClient.getClientTrainingDays).mockResolvedValue(0);
    vi.mocked(trainingClient.listExercises).mockResolvedValue([]);
    vi.mocked(trainingClient.listTrainingCompletions).mockResolvedValue([]);
    vi.mocked(trainingClient.getStreak).mockResolvedValue({
      streakWeeks: 0,
      sessionsDoneThisWeek: 0,
      sessionsRequiredThisWeek: 0,
      protectorAvailable: true,
      protectorUsedThisWeek: false,
      atRisk: false,
    });
  });

  it('renders the training home once the session is resolved', async () => {
    render(<TrainingPage />);
    await screen.findByText('Workout');
  });

  it('executes the NFC confirmation immediately when m/a query params are present and a session exists', async () => {
    vi.mocked(trainingClient.confirmSession).mockResolvedValue({
      alreadyConfirmedToday: false,
      dayNumber: 1,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: null,
    });
    window.history.pushState({}, '', '/training?m=entrenamiento&a=confirmar');

    render(<TrainingPage />);

    await waitFor(() => expect(trainingClient.confirmSession).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'nfc'));
    expect(await screen.findByText('Sesión confirmada.')).toBeInTheDocument();
  });

  it('consumes a pending action from localStorage (no query params) when a session exists', async () => {
    vi.mocked(trainingClient.confirmSession).mockResolvedValue({
      alreadyConfirmedToday: false,
      dayNumber: 1,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: null,
    });
    window.localStorage.setItem('lt_pending_action', JSON.stringify({ m: 'entrenamiento', a: 'confirmar' }));
    window.history.pushState({}, '', '/training');

    render(<TrainingPage />);

    await waitFor(() => expect(trainingClient.confirmSession).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'nfc'));
    expect(window.localStorage.getItem('lt_pending_action')).toBeNull();
  });

  it('shows a toast (not the celebration screen) when the NFC confirm reports alreadyConfirmedToday', async () => {
    vi.mocked(trainingClient.confirmSession).mockResolvedValue({
      alreadyConfirmedToday: true,
      dayNumber: null,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 1, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: null,
    });
    window.history.pushState({}, '', '/training?m=entrenamiento&a=confirmar');

    render(<TrainingPage />);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Ya confirmaste tu sesión de hoy — vuelve mañana para el siguiente día.', 'info'),
    );
    expect(screen.queryByText('Sesión confirmada.')).not.toBeInTheDocument();
    // Cae al home normal (TrainingShell) en vez de reemplazar toda la página por el aviso.
    expect(await screen.findByText('Workout')).toBeInTheDocument();
  });

  it('falls through to TrainingShell (never a dead-end alert) when the NFC confirm-session call fails', async () => {
    vi.mocked(trainingClient.confirmSession).mockRejectedValue(new Error('403'));
    window.history.pushState({}, '', '/training?m=entrenamiento&a=confirmar');

    render(<TrainingPage />);

    await screen.findByText('Workout');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
