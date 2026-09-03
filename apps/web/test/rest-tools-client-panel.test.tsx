import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RestToolsClientPanel } from '../components/rest/RestToolsClientPanel';
import * as restToolsClient from '../lib/rest-tools-client';

const tools = [
  { id: 't1', name: 'Sonidos para dormir', meta: 'Ruido blanco', action: 'play', minutes: 0, seconds: 2, audioUrl: null, audioName: null, active: true, sortOrder: 0 },
  { id: 't2', name: 'Con audio propio', meta: null, action: 'play', minutes: null, seconds: null, audioUrl: 'https://x/song.mp3', audioName: 'song.mp3', active: true, sortOrder: 1 },
  { id: 't3', name: 'Diario', meta: null, action: 'write', minutes: null, seconds: null, audioUrl: null, audioName: null, active: true, sortOrder: 2 },
];

describe('RestToolsClientPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn();
    vi.spyOn(restToolsClient, 'listRestTools').mockResolvedValue(tools);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the fetched tools', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    expect(screen.getByText('Con audio propio')).toBeInTheDocument();
    expect(screen.getByText('Diario')).toBeInTheDocument();
  });

  it('a "write" tool opens an ephemeral journal that never calls the network', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Diario')).toBeInTheDocument());
    const writeButtons = screen.getAllByRole('button', { name: 'Escribir' });
    fireEvent.click(writeButtons[0]);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'lo que ronda mi cabeza' } });
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('a "play" tool without audioUrl starts a countdown timer and stops at 0', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Sonidos para dormir')).toBeInTheDocument());
    const playButtons = screen.getAllByRole('button', { name: 'Reproducir' });
    fireEvent.click(playButtons[0]);
    expect(screen.getByText('0:02')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('0:01')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Detener' })).not.toBeInTheDocument();
  });

  it('a "play" tool with audioUrl toggles an inline audio player', async () => {
    render(<RestToolsClientPanel />);
    await waitFor(() => expect(screen.getByText('Con audio propio')).toBeInTheDocument());
    const toggleButtons = screen.getAllByRole('button', { name: 'Reproducir' });
    // The second tool ('Con audio propio') has audio, sortOrder 1 -> second play button
    fireEvent.click(toggleButtons[1]);
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument();
  });
});
