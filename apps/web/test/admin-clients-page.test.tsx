import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminClientsPage from '../app/(app)/admin/clients/page';
import * as blindspotClient from '../lib/blindspot-client';

vi.mock('../lib/clients-client', () => ({
  fetchClients: vi.fn(async () => [
    { id: '1', name: 'Ana Pérez', email: 'ana@example.com', plan: 'Miembro', status: 'active', clientType: 'coaching_1_1' },
  ]),
  createClient: vi.fn(),
}));

vi.mock('../lib/blindspot-client', () => ({
  adminCreateTherapist: vi.fn(),
  adminListTherapists: vi.fn(async () => []),
  adminUpdateTherapist: vi.fn(),
  adminDeleteTherapist: vi.fn(),
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

  it('switches the Nuevo cliente/terapeuta segmented control to Terapeuta and creates one', async () => {
    const user = userEvent.setup();
    vi.mocked(blindspotClient.adminCreateTherapist).mockResolvedValue({
      id: 't1', name: 'Dra. Ríos', email: 'rios@example.com', specialty: 'Biodescodificación', active: true,
    } as blindspotClient.Therapist);

    render(<AdminClientsPage />);
    await screen.findByText('Ana Pérez');

    await user.click(screen.getByRole('button', { name: 'Terapeuta' }));
    expect(screen.getByRole('heading', { name: 'Nuevo terapeuta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Especialidad')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombre'), 'Dra. Ríos');
    await user.type(screen.getByLabelText('Email'), 'rios@example.com');
    await user.type(screen.getByLabelText('Contraseña temporal'), 'temporal123');
    await user.type(screen.getByLabelText('Especialidad'), 'Biodescodificación');
    await user.click(screen.getByRole('button', { name: 'Crear terapeuta' }));

    await waitFor(() =>
      expect(blindspotClient.adminCreateTherapist).toHaveBeenCalledWith({
        name: 'Dra. Ríos', email: 'rios@example.com', password: 'temporal123', specialty: 'Biodescodificación',
      })
    );
  });
});
