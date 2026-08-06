import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionConfirmedScreen } from '../components/training/SessionConfirmedScreen';
import * as trainingClient from '../lib/training-client';
import * as trainingCard from '../lib/training-card';
import * as shareCard from '../lib/share-card';

const baseStreak = {
  streakWeeks: 3,
  sessionsDoneThisWeek: 2,
  sessionsRequiredThisWeek: 2,
  protectorAvailable: true,
  protectorUsedThisWeek: false,
  atRisk: false,
};

describe('SessionConfirmedScreen', () => {
  it('shows the title, week fraction, and streak count', () => {
    render(<SessionConfirmedScreen streak={baseStreak} phrase={null} clientId="client-1" onClose={vi.fn()} />);
    expect(screen.getByText('¡Sesión confirmada!')).toBeInTheDocument();
    expect(screen.getByText('2/2 esta semana')).toBeInTheDocument();
    expect(screen.getByText(/3 semanas seguidas/)).toBeInTheDocument();
  });

  it('shows the phrase when provided, and nothing when null', () => {
    const { rerender } = render(
      <SessionConfirmedScreen streak={baseStreak} phrase="Sigue así." clientId="client-1" onClose={vi.fn()} />
    );
    expect(screen.getByText('"Sigue así."')).toBeInTheDocument();

    rerender(<SessionConfirmedScreen streak={baseStreak} phrase={null} clientId="client-1" onClose={vi.fn()} />);
    expect(screen.queryByText(/"/)).not.toBeInTheDocument();
  });

  it('calls onClose when Cerrar is clicked', () => {
    const onClose = vi.fn();
    render(<SessionConfirmedScreen streak={baseStreak} phrase={null} clientId="client-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the share button enabled by default', () => {
    render(<SessionConfirmedScreen streak={baseStreak} phrase={null} clientId="client-1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeEnabled();
  });
});

describe('SessionConfirmedScreen — Compartir', () => {
  const streak = {
    streakWeeks: 2,
    sessionsDoneThisWeek: 3,
    sessionsRequiredThisWeek: 3,
    protectorAvailable: true,
    protectorUsedThisWeek: false,
    atRisk: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('disables the button while generating, then re-enables it after success', async () => {
    vi.spyOn(trainingClient, 'getPhraseByContext').mockResolvedValue('Vamos con todo');
    vi.spyOn(trainingCard, 'drawInstagramCard').mockImplementation(() => {});
    vi.spyOn(shareCard, 'shareCanvasAsImage').mockResolvedValue(undefined);

    render(<SessionConfirmedScreen streak={streak} phrase={null} clientId="client-1" onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Compartir' });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(button).toBeDisabled();

    await waitFor(() => expect(button).toBeEnabled());
    expect(shareCard.shareCanvasAsImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 'la-tribu-racha.png');
    expect(trainingCard.drawInstagramCard).toHaveBeenCalledWith(expect.anything(), { streakWeeks: 2, phrase: 'Vamos con todo' });
    expect(trainingClient.getPhraseByContext).toHaveBeenCalledWith('client-1', 'instagram');
  });

  it('draws the card with a null phrase when the phrase fetch fails (non-fatal)', async () => {
    vi.spyOn(trainingClient, 'getPhraseByContext').mockRejectedValue(new Error('network'));
    vi.spyOn(trainingCard, 'drawInstagramCard').mockImplementation(() => {});
    vi.spyOn(shareCard, 'shareCanvasAsImage').mockResolvedValue(undefined);

    render(<SessionConfirmedScreen streak={streak} phrase={null} clientId="client-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(trainingCard.drawInstagramCard).toHaveBeenCalled());
    expect(trainingCard.drawInstagramCard).toHaveBeenCalledWith(expect.anything(), { streakWeeks: 2, phrase: null });
  });

  it('shows a short error message without blocking Cerrar when sharing fails', async () => {
    vi.spyOn(trainingClient, 'getPhraseByContext').mockResolvedValue(null);
    vi.spyOn(trainingCard, 'drawInstagramCard').mockImplementation(() => {});
    vi.spyOn(shareCard, 'shareCanvasAsImage').mockRejectedValue(new Error('boom'));

    const onClose = vi.fn();
    render(<SessionConfirmedScreen streak={streak} phrase={null} clientId="client-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    expect(closeButton).toBeEnabled();
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a short error message without blocking Cerrar when getContext returns null', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    vi.spyOn(trainingClient, 'getPhraseByContext').mockResolvedValue(null);
    vi.spyOn(trainingCard, 'drawInstagramCard').mockImplementation(() => {});
    vi.spyOn(shareCard, 'shareCanvasAsImage').mockResolvedValue(undefined);

    const onClose = vi.fn();
    render(<SessionConfirmedScreen streak={streak} phrase={null} clientId="client-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(trainingCard.drawInstagramCard).not.toHaveBeenCalled();
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    expect(closeButton).toBeEnabled();
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
