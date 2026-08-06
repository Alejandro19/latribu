import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientCommunityPanel } from '../components/community/ClientCommunityPanel';
import * as eventsClient from '../lib/events-client';
import * as therapiesClient from '../lib/therapies-client';
import * as clientsClient from '../lib/clients-client';

vi.mock('../lib/events-client');
vi.mock('../lib/therapies-client');
vi.mock('../lib/clients-client');

const sampleEvent: eventsClient.CommunityEvent = {
  id: 'e1', title: 'Ice Bath', description: 'Llevar ropa cómoda.', eventDate: '2026-07-21T16:30:00Z',
  location: 'Nordico - Calle 93', capacity: null, active: true, confirmed_count: 2,
};
const sampleTherapy: therapiesClient.CommunityTherapy = {
  id: 't1', title: 'Biodescodificación', description: null, discountPct: 20, provider: null, active: true, confirmed_count: 1,
};

function mockFetches({
  events = [sampleEvent],
  therapies = [sampleTherapy],
  myEventReservations = [] as Array<{ eventId: string; status: string }>,
  myTherapyReservations = [] as Array<{ therapyId: string; status: string }>,
  clientType = 'coaching_1_1',
} = {}) {
  vi.mocked(eventsClient.listEvents).mockResolvedValue(events);
  vi.mocked(therapiesClient.listTherapies).mockResolvedValue(therapies);
  vi.mocked(eventsClient.listMyEventReservations).mockResolvedValue(myEventReservations);
  vi.mocked(therapiesClient.listMyTherapyReservations).mockResolvedValue(myTherapyReservations);
  vi.mocked(clientsClient.fetchClient).mockResolvedValue({
    id: 'client-1', name: 'Ana', email: 'a@x.com', plan: '', status: 'active', clientType,
  });
}

describe('ClientCommunityPanel', () => {
  it('shows the next event in the hero and the event cards under the Eventos tab', async () => {
    mockFetches();
    render(<ClientCommunityPanel clientId="client-1" />);
    expect(await screen.findByText('Próximo evento')).toBeInTheDocument();
    expect(screen.getAllByText('Ice Bath').length).toBeGreaterThan(0);
    expect(screen.getByText(/2 personas confirmadas/)).toBeInTheDocument();
  });

  it('switches to the Terapias tab and shows therapy cards for an active client', async () => {
    const user = userEvent.setup();
    mockFetches();
    render(<ClientCommunityPanel clientId="client-1" />);
    await screen.findByRole('button', { name: 'Terapias' });

    await user.click(screen.getByRole('button', { name: 'Terapias' }));
    expect(await screen.findByText('Biodescodificación')).toBeInTheDocument();
    expect(screen.getAllByText('-20%').length).toBeGreaterThan(0);
  });

  it('locks the Terapias tab behind an overlay for a lead_wellness client', async () => {
    const user = userEvent.setup();
    mockFetches({ clientType: 'lead_wellness' });
    render(<ClientCommunityPanel clientId="client-1" />);
    await screen.findByRole('button', { name: 'Terapias' });

    await user.click(screen.getByRole('button', { name: 'Terapias' }));
    expect(await screen.findByText('Beneficios solo para clientes activos')).toBeInTheDocument();
  });

  it('reserves an event and flips the button to cancel', async () => {
    const user = userEvent.setup();
    mockFetches();
    vi.mocked(eventsClient.reserveEvent).mockResolvedValue(undefined);
    vi.mocked(eventsClient.listMyEventReservations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ eventId: 'e1', status: 'confirmada' }]);

    render(<ClientCommunityPanel clientId="client-1" />);
    await user.click(await screen.findByRole('button', { name: 'Reservar mi lugar' }));

    await waitFor(() => expect(eventsClient.reserveEvent).toHaveBeenCalledWith('e1'));
    expect(await screen.findByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
  });

  it('shows an empty state when there are no events', async () => {
    mockFetches({ events: [] });
    render(<ClientCommunityPanel clientId="client-1" />);
    expect(await screen.findByText('No hay eventos disponibles por ahora.')).toBeInTheDocument();
    expect(screen.getByText('Aún no hay eventos programados')).toBeInTheDocument();
  });
});
