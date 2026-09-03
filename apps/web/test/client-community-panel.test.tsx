import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSWR as render } from './swr-test-utils';
import { ClientCommunityPanel } from '../components/community/ClientCommunityPanel';
import * as eventsClient from '../lib/events-client';
import * as therapiesClient from '../lib/therapies-client';
import * as retreatsClient from '../lib/retreats-client';
import { PermissionDeniedError } from '../lib/api-client';

vi.mock('../lib/events-client');
vi.mock('../lib/therapies-client');
vi.mock('../lib/retreats-client');

const sampleEvent: eventsClient.CommunityEvent = {
  id: 'e1', title: 'Ice Bath', description: 'Llevar ropa cómoda.', eventDate: '2026-07-21T16:30:00Z',
  location: 'Nordico - Calle 93', capacity: null, imageUrl: null, active: true, confirmed_count: 2,
};
const sampleTherapy: therapiesClient.CommunityTherapy = {
  id: 't1', title: 'Biodescodificación', description: null, discountPct: 20, provider: null, imageUrl: null, active: true, confirmed_count: 1,
};
const sampleRetreat: retreatsClient.CommunityRetreat = {
  id: 'r1', title: 'Retiro de montaña', description: null, startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-05T00:00:00Z',
  location: 'Sierra Nevada', capacity: 12, priceCents: 250000, imageUrl: null, active: true, confirmed_count: 0,
};

function mockFetches({
  events = [sampleEvent],
  therapies = [sampleTherapy],
  retreats = [sampleRetreat],
  myEventReservations = [] as Array<{ eventId: string; status: string }>,
  myTherapyReservations = [] as Array<{ therapyId: string; status: string }>,
  myRetreatReservations = [] as Array<{ retreatId: string; status: string }>,
} = {}) {
  vi.mocked(eventsClient.listEvents).mockResolvedValue(events);
  vi.mocked(therapiesClient.listTherapies).mockResolvedValue(therapies);
  vi.mocked(retreatsClient.listRetreats).mockResolvedValue(retreats);
  vi.mocked(eventsClient.listMyEventReservations).mockResolvedValue(myEventReservations);
  vi.mocked(therapiesClient.listMyTherapyReservations).mockResolvedValue(myTherapyReservations);
  vi.mocked(retreatsClient.listMyRetreatReservations).mockResolvedValue(myRetreatReservations);
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

  it('switches to the Retiros tab and shows retreat cards for an active client', async () => {
    const user = userEvent.setup();
    mockFetches();
    render(<ClientCommunityPanel clientId="client-1" />);
    await screen.findByRole('button', { name: 'Retiros' });

    await user.click(screen.getByRole('button', { name: 'Retiros' }));
    expect(await screen.findByText('Retiro de montaña')).toBeInTheDocument();
  });

  it('shows the uploaded photo on a retreat card when it has one', async () => {
    const user = userEvent.setup();
    mockFetches({ retreats: [{ ...sampleRetreat, imageUrl: 'https://x/retiro.jpg' }] });
    render(<ClientCommunityPanel clientId="client-1" />);
    await user.click(await screen.findByRole('button', { name: 'Retiros' }));
    expect(await screen.findByRole('img', { name: 'Retiro de montaña' })).toBeInTheDocument();
  });

  it('shows no photo element (falls back to the placeholder) for a retreat without one', async () => {
    const user = userEvent.setup();
    mockFetches();
    render(<ClientCommunityPanel clientId="client-1" />);
    await user.click(await screen.findByRole('button', { name: 'Retiros' }));
    await screen.findByText('Retiro de montaña');
    expect(screen.queryByRole('img', { name: 'Retiro de montaña' })).not.toBeInTheDocument();
  });

  it('reserves a retreat and flips the button to cancel', async () => {
    const user = userEvent.setup();
    mockFetches();
    vi.mocked(retreatsClient.reserveRetreat).mockResolvedValue(undefined);
    vi.mocked(retreatsClient.listMyRetreatReservations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ retreatId: 'r1', status: 'confirmada' }]);

    render(<ClientCommunityPanel clientId="client-1" />);
    await user.click(await screen.findByRole('button', { name: 'Retiros' }));
    await user.click(await screen.findByRole('button', { name: 'Reservar mi lugar' }));

    await waitFor(() => expect(retreatsClient.reserveRetreat).toHaveBeenCalledWith('r1'));
    expect(await screen.findByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
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

  it('shows the generic upgrade card when the whole module is not allowed for this client type', async () => {
    mockFetches();
    vi.mocked(eventsClient.listEvents).mockRejectedValue(new PermissionDeniedError('Este módulo no está disponible para tu tipo de cuenta.'));
    render(<ClientCommunityPanel clientId="client-1" />);
    expect(await screen.findByText('Disponible en Premium')).toBeInTheDocument();
  });
});
