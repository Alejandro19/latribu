import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminCommunityPanel } from '../components/community/AdminCommunityPanel';
import * as eventsClient from '../lib/events-client';
import * as therapiesClient from '../lib/therapies-client';
import * as reservationsClient from '../lib/community-reservations-client';

vi.mock('../lib/events-client');
vi.mock('../lib/therapies-client');
vi.mock('../lib/community-reservations-client');

const sampleEvent: eventsClient.CommunityEvent = {
  id: 'e1', title: 'Ice Bath', description: null, eventDate: '2026-07-21T16:30:00Z',
  location: 'Nordico - Calle 93', capacity: null, active: true, confirmed_count: 2,
};
const sampleTherapy: therapiesClient.CommunityTherapy = {
  id: 't1', title: 'Biodescodificación', description: null, discountPct: 20, provider: null, active: true, confirmed_count: 1,
};

describe('AdminCommunityPanel', () => {
  beforeEach(() => {
    vi.mocked(eventsClient.listEvents).mockResolvedValue([sampleEvent]);
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([sampleTherapy]);
  });

  it('lists published events and therapies', async () => {
    render(<AdminCommunityPanel />);
    expect(await screen.findByText('Eventos publicados')).toBeInTheDocument();
    expect(screen.getAllByText('Ice Bath').length).toBeGreaterThan(0);
    expect(screen.getByText('Terapias publicadas')).toBeInTheDocument();
    expect(screen.getAllByText('Biodescodificación').length).toBeGreaterThan(0);
  });

  it('creates a new event from the Crear nuevo form', async () => {
    const user = userEvent.setup();
    vi.mocked(eventsClient.createEvent).mockResolvedValue(sampleEvent);
    render(<AdminCommunityPanel />);
    await screen.findByLabelText('Título');

    await user.type(screen.getByLabelText('Título'), 'Sauna Infrarojo');
    await user.type(screen.getByLabelText('Lugar'), 'Thermcure');
    await user.click(screen.getByRole('button', { name: 'Crear evento' }));

    await waitFor(() =>
      expect(eventsClient.createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sauna Infrarojo', location: 'Thermcure' }))
    );
  });

  it('switches the Crear nuevo segmented control to Terapia and creates one', async () => {
    const user = userEvent.setup();
    vi.mocked(therapiesClient.createTherapy).mockResolvedValue(sampleTherapy);
    render(<AdminCommunityPanel />);
    await screen.findByRole('button', { name: 'Terapia' });

    await user.click(screen.getByRole('button', { name: 'Terapia' }));
    await user.type(screen.getByLabelText('Título'), 'Descarga muscular');
    await user.type(screen.getByLabelText('Descuento (%)'), '10');
    await user.click(screen.getByRole('button', { name: 'Crear terapia' }));

    await waitFor(() =>
      expect(therapiesClient.createTherapy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Descarga muscular', discount_pct: 10 }))
    );
  });

  it('deletes an event from the published list', async () => {
    const user = userEvent.setup();
    vi.mocked(eventsClient.deleteEvent).mockResolvedValue(undefined);
    render(<AdminCommunityPanel />);
    const section = (await screen.findByText('Eventos publicados')).closest('div') as HTMLElement;
    await user.click(within(section).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(eventsClient.deleteEvent).toHaveBeenCalledWith('e1'));
  });

  it('toggles a therapy active state', async () => {
    const user = userEvent.setup();
    vi.mocked(therapiesClient.updateTherapy).mockResolvedValue(sampleTherapy);
    render(<AdminCommunityPanel />);
    const section = (await screen.findByText('Terapias publicadas')).closest('div') as HTMLElement;
    await user.click(within(section).getByRole('button', { name: 'Desactivar' }));

    await waitFor(() => expect(therapiesClient.updateTherapy).toHaveBeenCalledWith('t1', { active: false }));
  });

  it('shows the locked preview for the Lead Wellness client type', async () => {
    const user = userEvent.setup();
    render(<AdminCommunityPanel />);
    await screen.findByText('Vista previa por tipo de cliente');

    await user.click(screen.getByRole('button', { name: 'Lead Wellness' }));
    expect(await screen.findByText('Beneficios solo para clientes activos')).toBeInTheDocument();
  });

  it('switches to the Reservas tab and shows grouped reservations in an accordion', async () => {
    const user = userEvent.setup();
    vi.mocked(reservationsClient.getConfirmedReservations).mockResolvedValue({
      eventReservations: [
        { id: 'r1', eventId: 'e1', eventTitle: 'Ice Bath', eventDate: '2026-07-21T16:30:00Z', eventLocation: 'Nordico - Calle 93', clientName: 'Ana Pérez', clientPhone: '3001234567' },
      ],
      therapyReservations: [],
    });
    render(<AdminCommunityPanel />);
    await screen.findByRole('button', { name: 'Reservas' });
    await user.click(screen.getByRole('button', { name: 'Reservas' }));

    const heading = await screen.findByText(/Ice Bath/);
    await user.click(heading);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('3001234567')).toBeInTheDocument();
  });
});
