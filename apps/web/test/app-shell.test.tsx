import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppShell from '../components/layout/AppShell';
import ThemeRoot from '../components/layout/ThemeRoot';
import { useAuth } from '../lib/auth-context';
import { getLegalAcceptance } from '../lib/account-client';

vi.mock('../lib/auth-context', () => ({
  useAuth: vi.fn(),
}));

// Un cliente con una aceptación ya registrada — el gate legal obligatorio de
// AppShell no debe interponerse en estos tests, que verifican otra cosa.
vi.mock('../lib/account-client', () => ({
  getLegalAcceptance: vi.fn(),
  submitLegalAcceptance: vi.fn(),
}));

// AceptacionRegistro ya tiene su propia cobertura — se mockea acá para
// aislar el test al gate de AppShell, no a su lógica interna de scroll.
vi.mock('../components/auth/AceptacionRegistro', () => ({ default: () => <div>AceptacionRegistro mock</div> }));

const pushMock = vi.fn();
const usePathnameMock = vi.fn(() => '/training');
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

function mockExpiredClient() {
  vi.mocked(useAuth).mockReturnValue({
    role: 'cliente',
    isLoading: false,
    planExpired: true,
    planEndDate: '2020-01-01',
    token: 'token-123',
    user: { id: 'client-1', name: 'Ana', email: 'ana@example.com' },
    clientType: 'coaching_1_1',
    onboardingComplete: true,
    moduleAccess: {},
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

describe('AppShell', () => {
  beforeEach(() => {
    pushMock.mockClear();
    usePathnameMock.mockReturnValue('/training');
    vi.mocked(getLegalAcceptance).mockClear();
    vi.mocked(getLegalAcceptance).mockResolvedValue({
      dataPolicyVersion: 'v0.2-borrador', termsVersion: 'v0.2-borrador', sensitiveDataConsent: true, acceptedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('redirects to /login when auth finished loading and there is no session token', () => {
    vi.mocked(useAuth).mockReturnValue({
      role: null,
      isLoading: false,
      planExpired: false,
      token: null,
    } as ReturnType<typeof useAuth>);

    render(
      <ThemeRoot>
        <AppShell>{null}</AppShell>
      </ThemeRoot>,
    );

    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  // Acceso no restrictivo (estilo Oura): un cliente vencido ya no ve una
  // pantalla de bloqueo total — sigue viendo el contenido real, con un
  // banner persistente encima (ver MembershipExpiredBanner.tsx).
  it('shows the membership-expired banner alongside the real content, on any route', async () => {
    usePathnameMock.mockReturnValue('/training');
    mockExpiredClient();

    render(
      <ThemeRoot>
        <AppShell><p>Contenido real</p></AppShell>
      </ThemeRoot>,
    );

    expect(await screen.findByText('Tu membresía está inactiva', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Contenido real')).toBeInTheDocument();
  });

  it('does not show the banner for a client whose plan is not expired', async () => {
    usePathnameMock.mockReturnValue('/training');
    vi.mocked(useAuth).mockReturnValue({
      role: 'cliente', isLoading: false, planExpired: false, planEndDate: '2099-01-01',
      token: 'token-123', user: { id: 'client-1', name: 'Ana', email: 'ana@example.com' },
      clientType: 'coaching_1_1', onboardingComplete: true, moduleAccess: {}, logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <ThemeRoot>
        <AppShell><p>Contenido real</p></AppShell>
      </ThemeRoot>,
    );

    expect(await screen.findByText('Contenido real', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('Tu membresía está inactiva')).not.toBeInTheDocument();
  });

  it('the banner\'s "Renovar" link navigates to /configuracion/membresias', async () => {
    usePathnameMock.mockReturnValue('/training');
    mockExpiredClient();

    render(
      <ThemeRoot>
        <AppShell><p>Contenido real</p></AppShell>
      </ThemeRoot>,
    );
    (await screen.findByText('Renovar', {}, { timeout: 3000 })).click();

    expect(pushMock).toHaveBeenCalledWith('/configuracion/membresias');
  });

  it('blocks the whole app behind the legal-acceptance gate when a client never accepted anything', async () => {
    vi.mocked(getLegalAcceptance).mockResolvedValue(null);
    vi.mocked(useAuth).mockReturnValue({
      role: 'cliente', isLoading: false, planExpired: false, planEndDate: '2099-01-01',
      token: 'token-123', user: { id: 'client-1', name: 'Ana', email: 'ana@example.com' },
      clientType: 'coaching_1_1', onboardingComplete: true, moduleAccess: {}, logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <ThemeRoot>
        <AppShell><p>Contenido real</p></AppShell>
      </ThemeRoot>,
    );

    expect(await screen.findByText('AceptacionRegistro mock', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('Contenido real')).not.toBeInTheDocument();
  });

  it('never calls getLegalAcceptance for an admin — the gate only applies to clients', async () => {
    vi.mocked(useAuth).mockReturnValue({
      role: 'admin', isLoading: false, planExpired: false, token: 'token-123',
      user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <ThemeRoot>
        <AppShell><p>Contenido real</p></AppShell>
      </ThemeRoot>,
    );

    expect(await screen.findByText('Contenido real', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(getLegalAcceptance).not.toHaveBeenCalled();
  });
});
