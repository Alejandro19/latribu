import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import { WeeklyRitualCard } from '../components/rituals/WeeklyRitualCard';
import * as checkinsClient from '../lib/checkins-client';

vi.mock('../lib/checkins-client');

const BASE_STATUS: checkinsClient.CheckinsStatus = {
  dailyDoneToday: false,
  weeklyDueThisWeek: true,
  periodConfirmationDue: false,
  lastResponseAt: null,
  dailyStreakDays: 0,
  weeklyStreakWeeks: 0,
  weeklyRitualWindowOpen: false,
};

describe('WeeklyRitualCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stays visible but locked (no form) outside the weekend window when nothing was answered this week', async () => {
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue({ ...BASE_STATUS, weeklyRitualWindowOpen: false });
    vi.mocked(checkinsClient.getCurrentWeekReflection).mockResolvedValue(null);

    render(<WeeklyRitualCard clientId="client-1" />);

    expect(await screen.findByText('Ritual Semanal')).toBeInTheDocument();
    expect(screen.getByText(/Se habilita el sábado y domingo/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nivel de estrés crónico/)).not.toBeInTheDocument();
    expect(screen.queryByText('Completado')).not.toBeInTheDocument();
  });

  it('renders expanded on weekend days when nothing was answered this week', async () => {
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue({ ...BASE_STATUS, weeklyRitualWindowOpen: true });
    vi.mocked(checkinsClient.getCurrentWeekReflection).mockResolvedValue(null);

    render(<WeeklyRitualCard clientId="client-1" />);

    expect(await screen.findByText('Ritual Semanal')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nivel de estrés crónico/)).toBeInTheDocument();
    expect(screen.getByText('0 semanas seguidas')).toBeInTheDocument();
  });

  it('stays visible collapsed any day of the week once answered, even outside the Sunday window', async () => {
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue({ ...BASE_STATUS, weeklyRitualWindowOpen: false, weeklyStreakWeeks: 2 });
    vi.mocked(checkinsClient.getCurrentWeekReflection).mockResolvedValue({
      id: 'w1', semanaInicio: '2026-08-31', estresCronico: 6, tecnicasManejoUsadas: 'Respiración', despertaresNocturnosSemana: '1-2', createdAt: '2026-08-31T00:00:00Z',
    });

    render(<WeeklyRitualCard clientId="client-1" />);

    expect(await screen.findByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('2 semanas seguidas')).toBeInTheDocument();
    expect(screen.getByText(/Estrés crónico 6\/10/)).toBeInTheDocument();
  });

  it('saves the reflection and collapses to a completed summary', async () => {
    vi.mocked(checkinsClient.getCheckinsStatus).mockResolvedValue({ ...BASE_STATUS, weeklyRitualWindowOpen: true });
    vi.mocked(checkinsClient.getCurrentWeekReflection).mockResolvedValue(null);
    vi.mocked(checkinsClient.postWeeklyReflection).mockResolvedValue(undefined);

    render(<WeeklyRitualCard clientId="client-1" />);
    await screen.findByText('Ritual Semanal');

    fireEvent.click(screen.getByRole('button', { name: '1-2' }));
    vi.mocked(checkinsClient.getCurrentWeekReflection).mockResolvedValue({
      id: 'w1', semanaInicio: '2026-08-31', estresCronico: 5, tecnicasManejoUsadas: null, despertaresNocturnosSemana: '1-2', createdAt: '2026-08-31T00:00:00Z',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar reflexión' }));

    await waitFor(() =>
      expect(checkinsClient.postWeeklyReflection).toHaveBeenCalledWith('client-1', {
        estresCronico: 5,
        tecnicasManejoUsadas: undefined,
        despertaresNocturnosSemana: '1-2',
      })
    );
    await waitFor(() => expect(screen.getByText('Completado')).toBeInTheDocument());
  });
});
