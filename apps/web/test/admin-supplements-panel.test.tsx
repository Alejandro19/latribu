import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSWR as render } from './swr-test-utils';
import { AdminSupplementsPanel } from '../components/supplements/AdminSupplementsPanel';
import * as supplementsClient from '../lib/supplements-client';

vi.mock('../lib/supplements-client');

describe('AdminSupplementsPanel', () => {
  beforeEach(() => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([]);
  });

  it('lists existing supplements', async () => {
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Magnesio', brand: null, dose: '400mg', timing: null, benefit: null, category: 'Sueño', active: true },
    ]);
    render(<AdminSupplementsPanel clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Magnesio')).toBeInTheDocument());
  });

  it('assigns a new supplement', async () => {
    const user = userEvent.setup();
    vi.mocked(supplementsClient.createSupplement).mockResolvedValue({ id: 's2', name: 'Ashwagandha', brand: null, dose: null, timing: null, benefit: null, category: null, active: true });
    render(<AdminSupplementsPanel clientId="client-1" />);
    await waitFor(() => screen.getByLabelText('Nombre del suplemento'));

    await user.type(screen.getByLabelText('Nombre del suplemento'), 'Ashwagandha');
    await user.click(screen.getByRole('button', { name: 'Asignar suplemento' }));

    await waitFor(() => expect(supplementsClient.createSupplement).toHaveBeenCalledWith('client-1', expect.objectContaining({ name: 'Ashwagandha' })));
  });

  it('deletes a supplement', async () => {
    const user = userEvent.setup();
    vi.mocked(supplementsClient.listSupplements).mockResolvedValue([
      { id: 's1', name: 'Magnesio', brand: null, dose: null, timing: null, benefit: null, category: null, active: true },
    ]);
    render(<AdminSupplementsPanel clientId="client-1" />);
    await waitFor(() => screen.getByText('Magnesio'));

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(supplementsClient.deleteSupplement).toHaveBeenCalledWith('client-1', 's1'));
  });
});
