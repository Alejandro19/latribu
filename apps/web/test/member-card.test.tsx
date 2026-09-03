import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import { MemberCard } from '../components/member/MemberCard';
import * as clientsClient from '../lib/clients-client';

vi.mock('../lib/clients-client');

describe('MemberCard', () => {
  it('shows the member number, type, and join date for an active client', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue({
      id: 'client-1',
      name: 'Ana López',
      email: 'ana@example.com',
      plan: 'Miembro',
      status: 'active',
      clientType: 'mentoring',
      memberNumber: 142,
      activatedAt: '2026-03-05T12:00:00.000Z',
    });
    render(<MemberCard clientId="client-1" />);
    expect(await screen.findByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('N.º 00142')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Tu credencial')).toBeInTheDocument();
    expect(screen.getByText('Miembro activo del círculo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gestionar membresía' })).toHaveAttribute('href', '/configuracion/membresias');
    expect(screen.getByText('EPHIROX')).toBeInTheDocument();
  });

  it('shows "Quedan X de Y clases" for a Cliente 1:1 client with an active package, alongside the expiration date', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue({
      id: 'client-3',
      name: 'Presencial Client',
      email: 'presencial@example.com',
      plan: 'Miembro',
      status: 'active',
      clientType: 'coaching_1_1',
      memberNumber: 7,
      activatedAt: '2026-01-01T00:00:00.000Z',
      planEndDate: '2099-01-01',
      sessionsTotal: 8,
      sessionsRemaining: 5,
    });
    render(<MemberCard clientId="client-3" />);
    expect(await screen.findByText('Quedan 5 de 8')).toBeInTheDocument();
  });

  it('does not show a sessions line for a non-Cliente-1:1 client', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue({
      id: 'client-4',
      name: 'Mentoring Client',
      email: 'mentoring@example.com',
      plan: 'Miembro',
      status: 'active',
      clientType: 'mentoring',
      memberNumber: 8,
      activatedAt: '2026-01-01T00:00:00.000Z',
      planEndDate: '2099-01-01',
    });
    render(<MemberCard clientId="client-4" />);
    await screen.findByText('N.º 00008');
    expect(screen.queryByText('Clases')).not.toBeInTheDocument();
  });

  it('renders nothing for a client that is not active yet', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue({
      id: 'client-2',
      name: 'Pending Client',
      email: 'pending@example.com',
      plan: 'Miembro',
      status: 'inactive',
      clientType: 'coaching_1_1',
      memberNumber: null,
      activatedAt: null,
    });
    const { container } = render(<MemberCard clientId="client-2" />);
    await waitFor(() => expect(clientsClient.fetchClient).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
