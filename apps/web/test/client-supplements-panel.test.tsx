import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ClientSupplementsPanel } from '../components/supplements/ClientSupplementsPanel';
import * as supplementsClient from '../lib/supplements-client';

vi.mock('../lib/supplements-client');

describe('ClientSupplementsPanel', () => {
  it('shows the assigned supplements', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Magnesio', brand: null, dose: '400mg', timing: 'Antes de dormir', benefit: null, category: 'Sueño', active: true },
    ]);
    render(<ClientSupplementsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Magnesio')).toBeInTheDocument());
    expect(screen.getByText(/400mg/)).toBeInTheDocument();
  });

  it('shows a message when no supplements are assigned yet', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
    render(<ClientSupplementsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Todavía no tienes suplementos asignados.')).toBeInTheDocument());
  });
});
