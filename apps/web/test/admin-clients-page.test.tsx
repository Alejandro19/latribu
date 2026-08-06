import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminClientsPage from '../app/(app)/admin/clients/page';

vi.mock('../lib/clients-client', () => ({
  fetchClients: vi.fn(async () => [
    { id: '1', name: 'Ana Pérez', email: 'ana@example.com', plan: 'Miembro', status: 'active', clientType: 'coaching_1_1' },
  ]),
  createClient: vi.fn(),
}));

vi.mock('../components/layout/AppShell', () => ({
  showToast: vi.fn(),
}));

describe('AdminClientsPage', () => {
  it('renders the fetched clients in a table', async () => {
    render(<AdminClientsPage />);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });
});
