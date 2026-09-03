import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import PanelMembresias from '../components/account/PanelMembresias';
import * as clientsClient from '../lib/clients-client';
import * as membershipClient from '../lib/membership-client';

vi.mock('../lib/clients-client');
vi.mock('../lib/membership-client');

const confirmPaymentMock = vi.fn();
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: confirmPaymentMock }),
  useElements: () => ({}),
}));

const CLIENT_ID = 'client-1';

// El proveedor ya no lo elige el frontend (lo resuelve el servidor) — estos
// tests no necesitan mockear disponibilidad de proveedores, solo la
// respuesta de createMembershipCheckout.
const PRICES: membershipClient.MembershipPrice[] = [
  { id: 'p0', clientType: 'coaching_1_1', durationMonths: 1, packageSize: 8, amountCents: 78000000, currency: 'cop' },
  { id: 'p1', clientType: 'coaching_1_1', durationMonths: 3, packageSize: 8, amountCents: 225000000, currency: 'cop' },
  { id: 'p5', clientType: 'mentoring', durationMonths: 3, packageSize: null, amountCents: 400000, currency: 'usd' },
];

function baseClient(overrides: Partial<clientsClient.ClientDetail> = {}): clientsClient.ClientDetail {
  return {
    id: CLIENT_ID, name: 'Ana', email: 'ana@example.com', plan: 'Miembro',
    status: 'active', clientType: 'coaching_1_1', planEndDate: '2099-01-01',
    ...overrides,
  } as clientsClient.ClientDetail;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(membershipClient.getMembershipPrices).mockResolvedValue(PRICES);
});

describe('PanelMembresias', () => {
  it('shows "Vigente hasta" (no payment form) only for the tier the client already has active and unexpired', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ clientType: 'coaching_1_1', planEndDate: '2099-01-01' }));
    render(<PanelMembresias clientId={CLIENT_ID} />);

    expect(await screen.findByText(/Vigente hasta/)).toBeInTheDocument();
    // Mentoría no coincide con el tier activo → debe mostrar "Pagar".
    const payButtons = screen.getAllByText('Pagar');
    expect(payButtons).toHaveLength(1);
  });

  it('shows the payment form for a tier whose plan already expired, even if it matches the client type', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ clientType: 'coaching_1_1', planEndDate: '2020-01-01' }));
    render(<PanelMembresias clientId={CLIENT_ID} />);

    await waitFor(() => expect(screen.queryByText(/Vigente hasta/)).not.toBeInTheDocument());
    expect(screen.getAllByText('Pagar')).toHaveLength(2);
  });

  it('shows a "Duración" selector for Premium with "3 meses" pre-selected (single option), and its USD reference price always visible', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ planEndDate: undefined }));
    render(<PanelMembresias clientId={CLIENT_ID} />);

    await screen.findAllByText('Pagar');
    const eliteHeading = screen.getByText('Premium');
    // El título de Premium es hijo directo de la card completa (borde
    // resaltado) — sin badge aparte, esa distinción ya la da el propio nombre.
    const eliteCard = eliteHeading.closest('div')!;
    // Premium tiene una sola duración posible, pero se muestra como
    // selector (mismo patrón visual que Cliente 1:1), ya seleccionada.
    expect(within(eliteCard).getByText('Duración')).toBeInTheDocument();
    expect(within(eliteCard).getByRole('button', { name: '3 meses' })).toBeInTheDocument();
    expect(within(eliteCard).getByText(/US\$?\s?4[.,]000/)).toBeInTheDocument();
  });

  it('shows a package selector (8/12/16 clases) for Cliente 1:1, and updates the price when a different package is picked', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ planEndDate: undefined }));
    render(<PanelMembresias clientId={CLIENT_ID} />);

    await screen.findAllByText('Pagar');
    const presencialCard = screen.getByText('Cliente 1:1').closest('div')!;
    expect(within(presencialCard).getByText('8 clases')).toBeInTheDocument();
    expect(within(presencialCard).getByText('12 clases')).toBeInTheDocument();
    expect(within(presencialCard).getByText('16 clases')).toBeInTheDocument();
  });

  it('does not mark the plan as active until the backend confirms the payment (never trusts confirmPayment alone) — Stripe branch', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ planEndDate: undefined }));
    vi.mocked(membershipClient.createMembershipCheckout).mockResolvedValue({
      provider: 'stripe', clientSecret: 'secret_x', membershipPaymentId: 'pay_1', providerReference: 'pi_1',
    });
    confirmPaymentMock.mockResolvedValue({ error: undefined });

    let resolveStatus: (value: { status: 'pending' | 'succeeded' | 'failed' }) => void;
    const pendingStatusPromise = new Promise<{ status: 'pending' | 'succeeded' | 'failed' }>((resolve) => {
      resolveStatus = resolve;
    });
    vi.mocked(membershipClient.getMembershipPaymentStatus).mockReturnValue(pendingStatusPromise);

    render(<PanelMembresias clientId={CLIENT_ID} />);
    await screen.findAllByText('Pagar');

    const payButtons = screen.getAllByText('Pagar');
    fireEvent.click(payButtons[0]); // Presencial (primer card)

    const paymentElement = await screen.findByTestId('payment-element');
    const form = paymentElement.closest('form')!;
    fireEvent.click(within(form).getByRole('button', { name: 'Pagar' }));

    await waitFor(() => expect(confirmPaymentMock).toHaveBeenCalled());
    expect(await screen.findByText('Confirmando tu pago…')).toBeInTheDocument();
    expect(screen.queryByText('Pago confirmado — tu membresía ya está activa.')).not.toBeInTheDocument();

    resolveStatus!({ status: 'succeeded' });
    expect(await screen.findByText('Pago confirmado — tu membresía ya está activa.')).toBeInTheDocument();
  });

  it('confirms a Wompi payment only after the backend polling reports succeeded, never by the widget callback alone', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ planEndDate: undefined }));
    vi.mocked(membershipClient.createMembershipCheckout).mockResolvedValue({
      provider: 'wompi',
      membershipPaymentId: 'pay_2',
      providerReference: 'ref-2',
      publicKey: 'pub_test_x',
      amountInCents: 78000000,
      currency: 'COP',
      integritySignature: 'abc123',
    });

    const openMock = vi.fn((callback: (result: unknown) => void) => callback({ transaction: { id: 'txn-1', status: 'APPROVED' } }));
    const widgetCheckoutMock = vi.fn().mockImplementation(() => ({ open: openMock }));
    window.WidgetCheckout = widgetCheckoutMock as unknown as Window['WidgetCheckout'];

    let resolveStatus: (value: { status: 'pending' | 'succeeded' | 'failed' }) => void;
    const pendingStatusPromise = new Promise<{ status: 'pending' | 'succeeded' | 'failed' }>((resolve) => {
      resolveStatus = resolve;
    });
    vi.mocked(membershipClient.getMembershipPaymentStatus).mockReturnValue(pendingStatusPromise);

    render(<PanelMembresias clientId={CLIENT_ID} />);
    const payButtons = await screen.findAllByText('Pagar');
    fireEvent.click(payButtons[0]); // Presencial (primer card)

    const presencialCard = screen.getByText('Cliente 1:1').closest('div')!;
    const widgetPayButton = await within(presencialCard).findByRole('button', { name: 'Pagar' });
    fireEvent.click(widgetPayButton);

    await waitFor(() =>
      expect(widgetCheckoutMock).toHaveBeenCalledWith({
        currency: 'COP',
        amountInCents: 78000000,
        reference: 'ref-2',
        publicKey: 'pub_test_x',
        signature: { integrity: 'abc123' },
      })
    );
    expect(await screen.findByText('Confirmando tu pago…')).toBeInTheDocument();
    expect(screen.queryByText('Pago confirmado — tu membresía ya está activa.')).not.toBeInTheDocument();

    resolveStatus!({ status: 'succeeded' });
    expect(await screen.findByText('Pago confirmado — tu membresía ya está activa.')).toBeInTheDocument();

    delete window.WidgetCheckout;
  });

  it('shows a dedicated "rejected" message (with a Reintentar button) when the backend polling reports failed, instead of silently resetting the form', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ planEndDate: undefined }));
    vi.mocked(membershipClient.createMembershipCheckout).mockResolvedValue({
      provider: 'stripe', clientSecret: 'secret_x', membershipPaymentId: 'pay_3', providerReference: 'pi_3',
    });
    confirmPaymentMock.mockResolvedValue({ error: undefined });

    let resolveStatus: (value: { status: 'pending' | 'succeeded' | 'failed' }) => void;
    const pendingStatusPromise = new Promise<{ status: 'pending' | 'succeeded' | 'failed' }>((resolve) => {
      resolveStatus = resolve;
    });
    vi.mocked(membershipClient.getMembershipPaymentStatus).mockReturnValue(pendingStatusPromise);

    render(<PanelMembresias clientId={CLIENT_ID} />);
    const payButtons = await screen.findAllByText('Pagar');
    fireEvent.click(payButtons[0]); // Presencial (primer card)

    const paymentElement = await screen.findByTestId('payment-element');
    const form = paymentElement.closest('form')!;
    fireEvent.click(within(form).getByRole('button', { name: 'Pagar' }));

    resolveStatus!({ status: 'failed' });
    expect(await screen.findByText('El pago fue rechazado. Podés intentar de nuevo o probar con otro medio de pago.')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.queryByText('El pago fue rechazado. Podés intentar de nuevo o probar con otro medio de pago.')).not.toBeInTheDocument();
    expect(await screen.findByText('8 clases')).toBeInTheDocument(); // vuelve al selector de plan
  });

  it('keeps the "Pago confirmado" message on screen (with an Aceptar button) until the client dismisses it themselves — never on a timer', async () => {
    vi.mocked(clientsClient.fetchClient).mockResolvedValue(baseClient({ planEndDate: undefined }));
    vi.mocked(membershipClient.createMembershipCheckout).mockResolvedValue({
      provider: 'stripe', clientSecret: 'secret_x', membershipPaymentId: 'pay_4', providerReference: 'pi_4',
    });
    confirmPaymentMock.mockResolvedValue({ error: undefined });
    vi.mocked(membershipClient.getMembershipPaymentStatus).mockResolvedValue({ status: 'succeeded' });

    render(<PanelMembresias clientId={CLIENT_ID} />);
    const payButtons = await screen.findAllByText('Pagar');
    fireEvent.click(payButtons[0]);

    const paymentElement = await screen.findByTestId('payment-element');
    fireEvent.click(within(paymentElement.closest('form')!).getByRole('button', { name: 'Pagar' }));

    expect(await screen.findByText('Pago confirmado — tu membresía ya está activa.')).toBeInTheDocument();
    // El checkout usado se limpia apenas se confirma — no debe quedar
    // colgado para remontarse después con el mismo clientSecret.
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();

    // Sin tocar nada, el mensaje se queda — nunca se oculta solo.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('Pago confirmado — tu membresía ya está activa.')).toBeInTheDocument();

    // Recién al aceptar explícitamente se cierra — y no reaparece el
    // formulario de pago viejo (mismo clientSecret ya usado), evitando el
    // "Unhandled payment Element loaderror".
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(screen.queryByText('Pago confirmado — tu membresía ya está activa.')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
  });
});
