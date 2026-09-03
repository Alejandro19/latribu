import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import { WellnessIndexCard } from '../components/home/WellnessIndexCard';
import * as wellnessIndexClient from '../lib/wellness-index-client';

vi.mock('../lib/wellness-index-client');

describe('WellnessIndexCard', () => {
  it('shows the value, an upward trend phrase, and the delta vs. last week', async () => {
    vi.mocked(wellnessIndexClient.getWellnessIndex).mockResolvedValue({
      value: 72, previousValue: 64, delta: 8, trend: 'up', componentsUsed: { training: 60 },
    });
    render(<WellnessIndexCard clientId="client-1" />);
    expect(await screen.findByText('72')).toBeInTheDocument();
    expect(screen.getByText('Estás mejorando')).toBeInTheDocument();
    expect(screen.getByText('▲ +8 vs. semana pasada')).toBeInTheDocument();
  });

  it('shows the downward trend phrase for a negative delta', async () => {
    vi.mocked(wellnessIndexClient.getWellnessIndex).mockResolvedValue({
      value: 40, previousValue: 55, delta: -15, trend: 'down', componentsUsed: {},
    });
    render(<WellnessIndexCard clientId="client-1" />);
    expect(await screen.findByText('Es momento de ajustar')).toBeInTheDocument();
    expect(screen.getByText('▼ -15 vs. semana pasada')).toBeInTheDocument();
  });

  it('shows "Primera medición" with no delta line when there is no previous week to compare', async () => {
    vi.mocked(wellnessIndexClient.getWellnessIndex).mockResolvedValue({
      value: 55, previousValue: null, delta: null, trend: 'none', componentsUsed: {},
    });
    render(<WellnessIndexCard clientId="client-1" />);
    expect(await screen.findByText('Primera medición')).toBeInTheDocument();
    expect(screen.queryByText(/vs\. semana pasada/)).not.toBeInTheDocument();
  });

  it('renders nothing when the client has no wellness index yet', async () => {
    vi.mocked(wellnessIndexClient.getWellnessIndex).mockResolvedValue(null);
    const { container } = render(<WellnessIndexCard clientId="client-1" />);
    await waitFor(() => expect(wellnessIndexClient.getWellnessIndex).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
