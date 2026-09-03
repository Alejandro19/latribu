import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSWR as render } from './swr-test-utils';
import { AdminCommunityPanel } from '../components/community/AdminCommunityPanel';
import * as eventsClient from '../lib/events-client';
import * as therapiesClient from '../lib/therapies-client';
import * as retreatsClient from '../lib/retreats-client';
import * as reservationsClient from '../lib/community-reservations-client';

vi.mock('../lib/events-client');
vi.mock('../lib/therapies-client');
vi.mock('../lib/retreats-client');
vi.mock('../lib/community-reservations-client');

const sampleEvent: eventsClient.CommunityEvent = {
  id: 'e1', title: 'Ice Bath', description: null, eventDate: '2026-07-21T16:30:00Z',
  location: 'Nordico - Calle 93', capacity: null, imageUrl: null, active: true, confirmed_count: 2,
};
const sampleTherapy: therapiesClient.CommunityTherapy = {
  id: 't1', title: 'Biodescodificación', description: null, discountPct: 20, provider: null, imageUrl: null, active: true, confirmed_count: 1,
};
const sampleRetreat: retreatsClient.CommunityRetreat = {
  id: 'r1', title: 'Retiro de montaña', description: null, startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-05T00:00:00Z',
  location: 'Sierra Nevada', capacity: 12, priceCents: 250000, imageUrl: null, active: true, confirmed_count: 0,
};

describe('AdminCommunityPanel', () => {
  beforeEach(() => {
    vi.mocked(eventsClient.listEvents).mockResolvedValue([sampleEvent]);
    vi.mocked(therapiesClient.listTherapies).mockResolvedValue([sampleTherapy]);
    vi.mocked(retreatsClient.listRetreats).mockResolvedValue([sampleRetreat]);
  });

  it('lists published events, therapies, and retreats', async () => {
    render(<AdminCommunityPanel />);
    expect(await screen.findByText('Eventos publicados')).toBeInTheDocument();
    expect(screen.getAllByText('Ice Bath').length).toBeGreaterThan(0);
    expect(screen.getByText('Terapias publicadas')).toBeInTheDocument();
    expect(screen.getAllByText('Biodescodificación').length).toBeGreaterThan(0);
    expect(screen.getByText('Retiros publicados')).toBeInTheDocument();
    expect(screen.getAllByText('Retiro de montaña').length).toBeGreaterThan(0);
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

  it('switches the Crear nuevo segmented control to Retiro and creates one', async () => {
    const user = userEvent.setup();
    vi.mocked(retreatsClient.createRetreat).mockResolvedValue(sampleRetreat);
    render(<AdminCommunityPanel />);
    await screen.findByRole('button', { name: 'Retiro' });

    await user.click(screen.getByRole('button', { name: 'Retiro' }));
    await user.type(screen.getByLabelText('Título'), 'Retiro de playa');
    await user.type(screen.getByLabelText('Lugar'), 'Santa Marta');
    await user.type(screen.getByLabelText('Cupos'), '15');
    await user.click(screen.getByRole('button', { name: 'Crear retiro' }));

    await waitFor(() =>
      expect(retreatsClient.createRetreat).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retiro de playa', location: 'Santa Marta', capacity: 15 }))
    );
  });

  it('uploads the chosen photo right after creating an event', async () => {
    const user = userEvent.setup();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:fake-preview');
    global.URL.revokeObjectURL = vi.fn();
    vi.mocked(eventsClient.createEvent).mockResolvedValue(sampleEvent);
    vi.mocked(eventsClient.uploadEventImage).mockResolvedValue({ ...sampleEvent, imageUrl: 'https://x/img.jpg' });
    render(<AdminCommunityPanel />);
    await screen.findByLabelText('Título');

    await user.type(screen.getByLabelText('Título'), 'Sauna Infrarojo');
    const file = new File(['fake'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Foto (opcional)'), file);
    await user.click(screen.getByRole('button', { name: 'Crear evento' }));

    await waitFor(() => expect(eventsClient.uploadEventImage).toHaveBeenCalledWith(sampleEvent.id, file));
  });

  it('deletes a retreat from the published list', async () => {
    const user = userEvent.setup();
    vi.mocked(retreatsClient.deleteRetreat).mockResolvedValue(undefined);
    render(<AdminCommunityPanel />);
    const section = (await screen.findByText('Retiros publicados')).closest('div') as HTMLElement;
    await user.click(within(section).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(retreatsClient.deleteRetreat).toHaveBeenCalledWith('r1'));
  });

  it('edits an event from the published list', async () => {
    const user = userEvent.setup();
    vi.mocked(eventsClient.updateEvent).mockResolvedValue({ ...sampleEvent, title: 'Ice Bath actualizado' });
    render(<AdminCommunityPanel />);
    const section = (await screen.findByText('Eventos publicados')).closest('div') as HTMLElement;
    await user.click(within(section).getByRole('button', { name: 'Editar' }));

    const titleInput = await screen.findByDisplayValue('Ice Bath');
    await user.clear(titleInput);
    await user.type(titleInput, 'Ice Bath actualizado');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(eventsClient.updateEvent).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Ice Bath actualizado' }))
    );
  });

  it('edits a therapy from the published list', async () => {
    const user = userEvent.setup();
    vi.mocked(therapiesClient.updateTherapy).mockResolvedValue({ ...sampleTherapy, title: 'Biodescodificación actualizada' });
    render(<AdminCommunityPanel />);
    const section = (await screen.findByText('Terapias publicadas')).closest('div') as HTMLElement;
    await user.click(within(section).getByRole('button', { name: 'Editar' }));

    const titleInput = await screen.findByDisplayValue('Biodescodificación');
    await user.clear(titleInput);
    await user.type(titleInput, 'Biodescodificación actualizada');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(therapiesClient.updateTherapy).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Biodescodificación actualizada' }))
    );
  });

  it('edits a retreat from the published list', async () => {
    const user = userEvent.setup();
    vi.mocked(retreatsClient.updateRetreat).mockResolvedValue({ ...sampleRetreat, title: 'Retiro de montaña actualizado' });
    render(<AdminCommunityPanel />);
    const section = (await screen.findByText('Retiros publicados')).closest('div') as HTMLElement;
    await user.click(within(section).getByRole('button', { name: 'Editar' }));

    const titleInput = await screen.findByDisplayValue('Retiro de montaña');
    await user.clear(titleInput);
    await user.type(titleInput, 'Retiro de montaña actualizado');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(retreatsClient.updateRetreat).toHaveBeenCalledWith('r1', expect.objectContaining({ title: 'Retiro de montaña actualizado' }))
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

  it('switches to the Reservas tab and shows grouped reservations in an accordion', async () => {
    const user = userEvent.setup();
    vi.mocked(reservationsClient.getConfirmedReservations).mockResolvedValue({
      eventReservations: [
        { id: 'r1', eventId: 'e1', eventTitle: 'Ice Bath', eventDate: '2026-07-21T16:30:00Z', eventLocation: 'Nordico - Calle 93', clientName: 'Ana Pérez', clientPhone: '3001234567' },
      ],
      therapyReservations: [],
      retreatReservations: [],
    });
    render(<AdminCommunityPanel />);
    await screen.findByRole('button', { name: 'Reservas' });
    await user.click(screen.getByRole('button', { name: 'Reservas' }));

    const heading = await screen.findByText(/Ice Bath/);
    await user.click(heading);
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('3001234567')).toBeInTheDocument();
  });

  it('groups retreat reservations in their own accordion section', async () => {
    const user = userEvent.setup();
    vi.mocked(reservationsClient.getConfirmedReservations).mockResolvedValue({
      eventReservations: [],
      therapyReservations: [],
      retreatReservations: [
        { id: 'rr1', retreatId: 'r1', retreatTitle: 'Retiro de montaña', retreatStartDate: '2026-09-01T00:00:00Z', retreatEndDate: '2026-09-05T00:00:00Z', retreatLocation: 'Sierra Nevada', clientName: 'Carlos Ruiz', clientPhone: '3009876543' },
      ],
    });
    render(<AdminCommunityPanel />);
    await screen.findByRole('button', { name: 'Reservas' });
    await user.click(screen.getByRole('button', { name: 'Reservas' }));

    expect(await screen.findByText('Reservas de Retiros')).toBeInTheDocument();
    const heading = await screen.findByText(/Retiro de montaña/);
    await user.click(heading);
    expect(await screen.findByText('Carlos Ruiz')).toBeInTheDocument();
    expect(screen.getByText('3009876543')).toBeInTheDocument();
  });
});
