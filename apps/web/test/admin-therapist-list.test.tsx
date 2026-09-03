import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminTherapistList from '../components/admin/AdminTherapistList';
import * as blindspotClient from '../lib/blindspot-client';

vi.mock('../lib/blindspot-client');
vi.mock('../components/layout/AppShell', () => ({
  showToast: vi.fn(),
}));

const therapist: blindspotClient.Therapist = {
  id: 't1', name: 'Dra. Ríos', email: 'rios@example.com', specialty: 'Biodescodificación', phone: '3001234567', active: true,
};

describe('AdminTherapistList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(blindspotClient.adminListTherapists).mockResolvedValue([therapist]);
  });

  it('lists the fetched therapists', async () => {
    render(<AdminTherapistList />);
    expect(await screen.findByText('Dra. Ríos')).toBeInTheDocument();
    expect(screen.getByText('rios@example.com')).toBeInTheDocument();
    expect(screen.getByText('Biodescodificación')).toBeInTheDocument();
  });

  it('edits a therapist inline and saves the new fields', async () => {
    const user = userEvent.setup();
    vi.mocked(blindspotClient.adminUpdateTherapist).mockResolvedValue({ ...therapist, name: 'Dra. Ana Ríos' });

    render(<AdminTherapistList />);
    await screen.findByText('Dra. Ríos');

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    const nameInput = screen.getByLabelText('Nombre-t1');
    await user.clear(nameInput);
    await user.type(nameInput, 'Dra. Ana Ríos');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(blindspotClient.adminUpdateTherapist).toHaveBeenCalledWith('t1', {
        name: 'Dra. Ana Ríos', email: 'rios@example.com', specialty: 'Biodescodificación', phone: '3001234567',
      })
    );
  });

  it('toggles active state', async () => {
    const user = userEvent.setup();
    vi.mocked(blindspotClient.adminUpdateTherapist).mockResolvedValue({ ...therapist, active: false });

    render(<AdminTherapistList />);
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }));

    await waitFor(() => expect(blindspotClient.adminUpdateTherapist).toHaveBeenCalledWith('t1', { active: false }));
  });

  it('deletes a therapist after confirming', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(blindspotClient.adminDeleteTherapist).mockResolvedValue(undefined);

    render(<AdminTherapistList />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(blindspotClient.adminDeleteTherapist).toHaveBeenCalledWith('t1'));
  });

  it('does not delete when the confirm dialog is dismissed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<AdminTherapistList />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }));

    expect(blindspotClient.adminDeleteTherapist).not.toHaveBeenCalled();
  });

  it('shows a friendly error when deleting a therapist with assigned cases', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(blindspotClient.adminDeleteTherapist).mockRejectedValue(
      new Error('No se puede eliminar: este terapeuta tiene casos de Punto Ciego asignados. Reasígnalos primero.')
    );
    const { showToast } = await import('../components/layout/AppShell');

    render(<AdminTherapistList />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        'No se puede eliminar: este terapeuta tiene casos de Punto Ciego asignados. Reasígnalos primero.',
        'error'
      )
    );
  });
});
