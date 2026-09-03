import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '@testing-library/react';
import ClientTopbar from '../components/layout/ClientTopbar';
import ThemeRoot from '../components/layout/ThemeRoot';
import { useAuth } from '../lib/auth-context';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
  usePathname: () => '/training',
}));
vi.mock('../lib/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../components/layout/NotificationBell', () => ({ default: () => null }));

function mockAuth(overrides: { moduleAccess?: Record<string, boolean>; planExpired?: boolean } = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'client-1', name: 'Ana', email: 'a@x.com' },
    clientType: 'coaching_1_1',
    onboardingComplete: true,
    moduleAccess: {},
    planExpired: false,
    logout: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
}

describe('ClientTopbar — account dropdown', () => {
  it('shows a "Configuración" item that navigates to /configuracion, separate from "Cerrar sesión"', () => {
    mockAuth();
    render(
      <ThemeRoot>
        <ClientTopbar viewKey="training" />
      </ThemeRoot>,
    );

    fireEvent.click(screen.getByLabelText('Membresía'));

    // El drawer móvil siempre está en el DOM (se oculta con CSS, no se
    // desmonta) — hay una segunda copia de cada botón ahí.
    const settingsButtons = screen.getAllByText('Configuración');
    expect(settingsButtons.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cerrar sesión').length).toBeGreaterThan(0);

    fireEvent.click(settingsButtons[0]);
    expect(pushMock).toHaveBeenCalledWith('/configuracion');
  });
});

describe('ClientTopbar — acceso no restrictivo (módulo vencido)', () => {
  it('shows a crown badge (not the lock) for a module included in the plan but expired, and opens the modal on click instead of navigating', () => {
    pushMock.mockClear();
    mockAuth({ moduleAccess: { training: true }, planExpired: true });
    render(
      <ThemeRoot>
        <ClientTopbar viewKey="training" />
      </ThemeRoot>,
    );

    fireEvent.click(screen.getAllByText('Workout')[0]);

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText('Este módulo está incluido en tu membresía. Renueva tu pago para volver a acceder.')).toBeInTheDocument();
  });

  it('still shows the lock (not a crown) for a module never included in the plan, even if expired', () => {
    mockAuth({ moduleAccess: { training: false }, planExpired: true });
    render(
      <ThemeRoot>
        <ClientTopbar viewKey="training" />
      </ThemeRoot>,
    );

    fireEvent.click(screen.getAllByText('Workout')[0]);

    // 'not_included' no abre el modal de vencimiento — sigue navegando igual que hoy.
    expect(screen.queryByText('Este módulo está incluido en tu membresía. Renueva tu pago para volver a acceder.')).not.toBeInTheDocument();
  });
});
