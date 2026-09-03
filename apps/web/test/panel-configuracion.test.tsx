import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import PanelConfiguracion from '../components/account/PanelConfiguracion';
import { useAuth } from '../lib/auth-context';
import * as clientsClient from '../lib/clients-client';
import * as accountClient from '../lib/account-client';
import * as wearableClient from '../lib/wearable-client';

vi.mock('../lib/auth-context', () => ({ useAuth: vi.fn() }));
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('../lib/clients-client');
vi.mock('../lib/account-client');
vi.mock('../lib/wearable-client');
// AceptacionRegistro ya tiene su propia cobertura — se mockea acá para
// aislar este test al comportamiento propio del panel.
vi.mock('../components/auth/AceptacionRegistro', () => ({ default: () => <div>AceptacionRegistro mock</div> }));

const CLIENT_ID = 'client-1';

function baseClient(overrides: Partial<clientsClient.ClientDetail> = {}): clientsClient.ClientDetail {
  return {
    id: CLIENT_ID,
    name: 'Ana Pérez',
    email: 'ana@example.com',
    plan: 'Miembro',
    status: 'active',
    clientType: 'coaching_1_1',
    memberNumber: 12,
    activatedAt: '2026-01-15T00:00:00Z',
    notificationPreferences: { streakReminders: true, events: true, news: false },
    deletionRequestedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient());
  vi.mocked(accountClient.getLegalAcceptance).mockResolvedValue({
    dataPolicyVersion: 'v1.0',
    termsVersion: 'v1.0',
    sensitiveDataConsent: true,
    acceptedAt: '2026-01-15T00:00:00Z',
  });
  vi.mocked(wearableClient.getWearableEstado).mockResolvedValue([]);
  vi.mocked(wearableClient.getWearableConnectUrl).mockReturnValue('http://localhost:3003/api/wearable/oura/connect');
});

describe('PanelConfiguracion', () => {
  it('renders the profile fields and membership from the real client data', async () => {
    render(<PanelConfiguracion clientId={CLIENT_ID} />);

    expect(await screen.findByDisplayValue('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('Miembro N.º 00012', { exact: false })).toBeInTheDocument();
  });

  it('shows "Gestionar membresía" even for a client already in the top tier (Elite also renews via Stripe)', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ clientType: 'mentoring' }));
    render(<PanelConfiguracion clientId={CLIENT_ID} />);

    await screen.findByDisplayValue('Ana Pérez');
    expect(screen.getByText('Gestionar membresía')).toBeInTheDocument();
  });

  it('shows the plan expiration date and navigates to /configuracion/membresias on "Gestionar membresía"', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ planEndDate: '2099-06-15' }));
    render(<PanelConfiguracion clientId={CLIENT_ID} />);

    await screen.findByDisplayValue('Ana Pérez');
    expect(screen.getByText(/Vence el/, { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Gestionar membresía'));
    expect(pushMock).toHaveBeenCalledWith('/configuracion/membresias');
  });

  it('toggling a notification preference saves only that field', async () => {
    vi.mocked(accountClient.updateNotificationPreferences).mockResolvedValue(baseClient({ notificationPreferences: { streakReminders: true, events: true, news: true } }));
    render(<PanelConfiguracion clientId={CLIENT_ID} />);

    await screen.findByDisplayValue('Ana Pérez');
    const newsRow = screen.getByText('Novedades de Ephirox').closest('div')!.parentElement!;
    const toggle = newsRow.querySelector('button')!;
    fireEvent.click(toggle);

    await waitFor(() => expect(accountClient.updateNotificationPreferences).toHaveBeenCalledWith({ news: true }));
  });

  it('sends a real deletion request and reflects the "sent" state from the backend afterwards', async () => {
    vi.mocked(accountClient.requestAccountDeletion).mockResolvedValue(undefined);
    render(<PanelConfiguracion clientId={CLIENT_ID} />);

    await screen.findByDisplayValue('Ana Pérez');
    fireEvent.click(screen.getByText('Solicitar eliminación de mi cuenta'));
    fireEvent.click(screen.getByText('Enviar solicitud'));

    await waitFor(() => expect(accountClient.requestAccountDeletion).toHaveBeenCalled());
    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument();
  });

  it('shows the deletion request as already sent when the backend already has one pending', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ deletionRequestedAt: '2026-02-01T00:00:00Z' }));
    render(<PanelConfiguracion clientId={CLIENT_ID} />);

    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument();
    expect(screen.queryByText('Solicitar eliminación de mi cuenta')).not.toBeInTheDocument();
  });

  it('shows the Oura connection state and disconnects it', async () => {
    vi.mocked(wearableClient.getWearableEstado).mockResolvedValue([
      { dispositivo: 'oura', conectado: true, conectadoEn: '2026-01-01T00:00:00Z', ultimaSync: null, tokenExpirado: false },
    ]);
    render(<PanelConfiguracion clientId={CLIENT_ID} />);

    expect(await screen.findByText('Conectado')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Desconectar'));
    await waitFor(() => expect(wearableClient.disconnectWearable).toHaveBeenCalledWith(CLIENT_ID, 'oura'));
  });
});
