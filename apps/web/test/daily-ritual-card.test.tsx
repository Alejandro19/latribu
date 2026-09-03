import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import { DailyRitualCard } from '../components/rituals/DailyRitualCard';
import { useAuth } from '../lib/auth-context';
import * as checkinsClient from '../lib/checkins-client';
import * as cortisolClient from '../lib/cortisol-client';

vi.mock('../lib/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/checkins-client');
vi.mock('../lib/cortisol-client');

const BASE_STATUS: checkinsClient.CheckinsStatus = {
  dailyDoneToday: false,
  weeklyDueThisWeek: true,
  periodConfirmationDue: false,
  lastResponseAt: null,
  dailyStreakDays: 0,
  weeklyStreakWeeks: 0,
  weeklyRitualWindowOpen: false,
};

function mockAuth(overrides: { moduleAccess?: Record<string, boolean>; planExpired?: boolean } = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'client-1', name: 'Ana', email: 'a@x.com' },
    role: 'cliente',
    clientType: 'mentoring',
    onboardingComplete: true,
    moduleAccess: {},
    planExpired: false,
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

describe('DailyRitualCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the mood question and the 3 stress questions expanded when nothing was answered today', async () => {
    mockAuth();
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue(BASE_STATUS);
    vi.mocked(checkinsClient.getTodayCheckin).mockResolvedValue(null);
    vi.mocked(cortisolClient.getTodayMorningCheckin).mockResolvedValue(null);

    render(<DailyRitualCard clientId="client-1" />);

    expect(await screen.findByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    expect(screen.getByText('¿Cómo sentiste tu energía al despertar hoy?')).toBeInTheDocument();
    expect(screen.getByText('¿Sentiste tensión o ansiedad apenas despertaste?')).toBeInTheDocument();
    expect(screen.getByText('¿Qué tan clara sientes tu mente en este momento?')).toBeInTheDocument();
    expect(screen.getByText('0 días seguidos')).toBeInTheDocument();
    expect(screen.queryByText('Completado')).not.toBeInTheDocument();
  });

  it('saves both the mood and the stress questions with one click, then collapses to a completed summary', async () => {
    mockAuth();
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue(BASE_STATUS);
    vi.mocked(checkinsClient.getTodayCheckin).mockResolvedValue(null);
    vi.mocked(cortisolClient.getTodayMorningCheckin).mockResolvedValue(null);
    vi.mocked(checkinsClient.postDailyCheckin).mockResolvedValue(undefined);
    vi.mocked(cortisolClient.postMorningCheckin).mockResolvedValue({
      id: 'mc1', fecha: '2026-09-02', energia: 3, tension: 3, claridad: 3, activacionMatutina: 6,
    });

    render(<DailyRitualCard clientId="client-1" />);
    await screen.findByText('¿Cómo te sientes hoy?');

    fireEvent.click(screen.getByRole('button', { name: 'Bien' }));

    vi.mocked(checkinsClient.getTodayCheckin).mockResolvedValue({ id: 'd1', fecha: '2026-09-02', pulsoAnimo: 4, createdAt: '2026-09-02T00:00:00Z' });
    vi.mocked(cortisolClient.getTodayMorningCheckin).mockResolvedValue({
      id: 'mc1', fecha: '2026-09-02', energia: 3, tension: 3, claridad: 3, activacionMatutina: 6,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ritual' }));

    await waitFor(() => expect(checkinsClient.postDailyCheckin).toHaveBeenCalledWith('client-1', 4));
    expect(cortisolClient.postMorningCheckin).toHaveBeenCalledWith('client-1', { energia: 3, tension: 3, claridad: 3 });
    await waitFor(() => expect(screen.getByText('Completado')).toBeInTheDocument());
    expect(screen.getByText(/Ánimo 4\/5/)).toBeInTheDocument();
  });

  it('only asks the mood question and never calls postMorningCheckin when the client has no cortisol/Stress access', async () => {
    mockAuth({ moduleAccess: { cortisol: false } });
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue(BASE_STATUS);
    vi.mocked(checkinsClient.getTodayCheckin).mockResolvedValue(null);
    vi.mocked(checkinsClient.postDailyCheckin).mockResolvedValue(undefined);

    render(<DailyRitualCard clientId="client-1" />);
    await screen.findByText('¿Cómo te sientes hoy?');

    expect(screen.queryByText('¿Cómo sentiste tu energía al despertar hoy?')).not.toBeInTheDocument();
    expect(cortisolClient.getTodayMorningCheckin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Muy bien' }));
    vi.mocked(checkinsClient.getTodayCheckin).mockResolvedValue({ id: 'd1', fecha: '2026-09-02', pulsoAnimo: 5, createdAt: '2026-09-02T00:00:00Z' });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ritual' }));

    await waitFor(() => expect(checkinsClient.postDailyCheckin).toHaveBeenCalledWith('client-1', 5));
    expect(cortisolClient.postMorningCheckin).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Completado')).toBeInTheDocument());
  });

  it('shows "Editar" once completed and reopens the form pre-filled', async () => {
    mockAuth();
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue({ ...BASE_STATUS, dailyDoneToday: true, dailyStreakDays: 3 });
    vi.mocked(checkinsClient.getTodayCheckin).mockResolvedValue({ id: 'd1', fecha: '2026-09-02', pulsoAnimo: 4, createdAt: '2026-09-02T00:00:00Z' });
    vi.mocked(cortisolClient.getTodayMorningCheckin).mockResolvedValue({
      id: 'mc1', fecha: '2026-09-02', energia: 2, tension: 4, claridad: 5, activacionMatutina: 5,
    });

    render(<DailyRitualCard clientId="client-1" />);

    expect(await screen.findByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('3 días seguidos')).toBeInTheDocument();
    expect(screen.queryByText('¿Cómo te sientes hoy?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByText('¿Cómo te sientes hoy?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bien' })).toHaveAttribute('aria-pressed', 'true');
  });
});
