import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientCortisolPanel } from '../components/cortisol/ClientCortisolPanel';
import * as cortisolClient from '../lib/cortisol-client';

vi.mock('../lib/cortisol-client');

function mockFetches({
  techniques = [],
  completions = [],
  tip = null,
  checkin = null,
}: {
  techniques?: cortisolClient.CortisolTechnique[];
  completions?: cortisolClient.CortisolCompletion[];
  tip?: cortisolClient.CortisolTip;
  checkin?: cortisolClient.CortisolCheckin;
} = {}) {
  vi.mocked(cortisolClient.listTechniques).mockResolvedValue(techniques);
  vi.mocked(cortisolClient.listCompletions).mockResolvedValue(completions);
  vi.mocked(cortisolClient.getTipOfTheDay).mockResolvedValue(tip);
  vi.mocked(cortisolClient.getTodayCheckin).mockResolvedValue(checkin);
}

describe('ClientCortisolPanel', () => {
  it('shows the assigned techniques and the tip of the day', async () => {
    mockFetches({
      techniques: [
        { id: 't1', title: 'Respiración 4-7-8', type: 'Respiración', duration: '5 min', durationMinutes: 5, durationSeconds: null, description: null, videoUrl: null, videoName: null, youtubeUrl: null, audioUrl: null, audioName: null },
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
        { id: 't1', title: 'Meditación guiada', type: 'Meditación', duration: null, durationMinutes: null, durationSeconds: null, description: null, videoUrl: null, videoName: null, youtubeUrl: 'https://youtube.com/watch?v=abcdef', audioUrl: null, audioName: null },
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
});
