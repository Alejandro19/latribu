import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSWR as render } from './swr-test-utils';
import { ClientCortisolPanel } from '../components/cortisol/ClientCortisolPanel';
import * as cortisolClient from '../lib/cortisol-client';
import { PermissionDeniedError } from '../lib/api-client';

vi.mock('../lib/cortisol-client');

const DEFAULT_COGNITIVE_LOAD: cortisolClient.CognitiveLoadOverview = {
  today: null,
  trend: [],
  threshold: null,
  consecutiveDaysOverThreshold: 0,
  alert: false,
  alertStreakThreshold: 3,
  latest: { hrv: null, activacionMatutina: null, recuperacionPct: null },
};

function mockFetches({
  techniques = [],
  completions = [],
  tip = null,
  checkin = null,
  morningCheckin = { id: 'mc1', fecha: '2026-08-02', energia: 3, tension: 3, claridad: 3, activacionMatutina: 6 },
  cognitiveLoad = DEFAULT_COGNITIVE_LOAD,
}: {
  techniques?: cortisolClient.CortisolTechnique[];
  completions?: cortisolClient.CortisolCompletion[];
  tip?: cortisolClient.CortisolTip;
  checkin?: cortisolClient.CortisolCheckin;
  morningCheckin?: cortisolClient.MorningCheckin;
  cognitiveLoad?: cortisolClient.CognitiveLoadOverview;
} = {}) {
  vi.mocked(cortisolClient.listTechniques).mockResolvedValue(techniques);
  vi.mocked(cortisolClient.listCompletions).mockResolvedValue(completions);
  vi.mocked(cortisolClient.getTipOfTheDay).mockResolvedValue(tip);
  vi.mocked(cortisolClient.getTodayCheckin).mockResolvedValue(checkin);
  // Check-in ya hecho por defecto en los tests que no lo ejercitan a
  // propósito, para no mezclar el prompt del check-in matutino con
  // aserciones de otras features.
  vi.mocked(cortisolClient.getTodayMorningCheckin).mockResolvedValue(morningCheckin);
  vi.mocked(cortisolClient.getCognitiveLoadOverview).mockResolvedValue(cognitiveLoad);
}

describe('ClientCortisolPanel', () => {
  it('shows the assigned techniques and the tip of the day', async () => {
    mockFetches({
      techniques: [
        { id: 't1', title: 'Respiración 4-7-8', type: 'Respiración', duration: '5 min', durationMinutes: 5, durationSeconds: null, description: null, videoUrl: null, videoName: null, youtubeUrl: null, audioUrl: null, audioName: null, emotion: null, precautionNote: null, isRitual: false },
      ],
      tip: { id: 'tip1', content: 'Duerme 8 horas.' },
    });

    render(<ClientCortisolPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Respiración 4-7-8')).toBeInTheDocument());
    expect(screen.getByText(/Duerme 8 horas\./)).toBeInTheDocument();
  });

  it('shows a message when no techniques are assigned yet', async () => {
    mockFetches();
    render(<ClientCortisolPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Aún no tienes técnicas asignadas.')).toBeInTheDocument());
  });

  it('opens the technique player and marks it as completed today', async () => {
    const user = userEvent.setup();
    mockFetches({
      techniques: [
        { id: 't1', title: 'Meditación guiada', type: 'Meditación', duration: null, durationMinutes: null, durationSeconds: null, description: null, videoUrl: null, videoName: null, youtubeUrl: 'https://youtube.com/watch?v=abcdef', audioUrl: null, audioName: null, emotion: null, precautionNote: null, isRitual: false },
      ],
    });

    render(<ClientCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByText('Meditación guiada'));

    await user.click(screen.getByRole('button', { name: 'Reproducir' }));
    await user.click(screen.getByRole('button', { name: 'Marcar completado' }));
    await waitFor(() => expect(cortisolClient.markCompletion).toHaveBeenCalledWith('client-1'));
  });

  it('submits a daily emotional check-in', async () => {
    const user = userEvent.setup();
    mockFetches();
    vi.mocked(cortisolClient.postCheckin).mockResolvedValue({ id: 'c1', emotion: 'tranquilo', checkinDate: '2026-08-02' });

    render(<ClientCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByText('¿Cómo te sientes ahora mismo?'));

    await user.click(screen.getByRole('button', { name: /Tranquilo\/a/ }));

    await waitFor(() => expect(cortisolClient.postCheckin).toHaveBeenCalledWith('client-1', 'tranquilo'));
  });

  it('recommends and plays the technique the admin assigned to the checked-in emotion', async () => {
    const user = userEvent.setup();
    mockFetches({
      techniques: [
        { id: 't1', title: 'Respiración de caja', type: 'Respiración', duration: null, durationMinutes: null, durationSeconds: null, description: 'Ordena tus pensamientos.', videoUrl: null, videoName: null, youtubeUrl: 'https://youtube.com/watch?v=boxbreath', audioUrl: null, audioName: null, emotion: 'ansioso', precautionNote: null, isRitual: false },
        { id: 't2', title: 'Meditación guiada', type: 'Meditación', duration: null, durationMinutes: null, durationSeconds: null, description: null, videoUrl: null, videoName: null, youtubeUrl: null, audioUrl: null, audioName: null, emotion: null, precautionNote: null, isRitual: false },
      ],
      checkin: { id: 'c1', emotion: 'ansioso', checkinDate: '2026-08-02' },
    });

    render(<ClientCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByText('Recomendada para ti ahora'));
    expect(screen.getByRole('heading', { level: 3, name: 'Respiración de caja' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Empezar técnica' }));
    expect(await screen.findByRole('heading', { name: 'Respiración de caja' })).toBeInTheDocument();
  });

  it('shows the generic upgrade card when this client type has no access to Cortisol', async () => {
    vi.mocked(cortisolClient.listTechniques).mockRejectedValue(new PermissionDeniedError('Este módulo no está disponible para tu tipo de cuenta.'));
    vi.mocked(cortisolClient.listCompletions).mockResolvedValue([]);
    vi.mocked(cortisolClient.getTipOfTheDay).mockResolvedValue(null);
    vi.mocked(cortisolClient.getTodayCheckin).mockResolvedValue(null);

    render(<ClientCortisolPanel clientId="client-1" />);
    expect(await screen.findByText('Disponible en Premium')).toBeInTheDocument();
  });
});
