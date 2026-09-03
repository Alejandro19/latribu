import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotificationBell from '../components/layout/NotificationBell';
import { useAuth } from '../lib/auth-context';

vi.mock('../lib/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/api-client', () => ({ getSessionToken: () => 'token' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function mockNotifications(notifications: Array<{ id: string; message: string; createdAt: string; read: boolean }>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ notifications }),
  }));
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ role: 'cliente', user: { id: 'client-1', name: 'Ana', email: 'a@x.com' } } as ReturnType<typeof useAuth>);
  });

  it('renders an icon-only ghost button, never a numeric count', async () => {
    mockNotifications([
      { id: 'n1', message: 'Uno', createdAt: '2026-08-01T00:00:00Z', read: false },
      { id: 'n2', message: 'Dos', createdAt: '2026-08-01T00:00:00Z', read: false },
      { id: 'n3', message: 'Tres', createdAt: '2026-08-01T00:00:00Z', read: false },
    ]);
    render(<NotificationBell />);
    const button = await screen.findByRole('button', { name: 'Notificaciones' });
    expect(button).not.toHaveTextContent('3');
    expect(button).not.toHaveTextContent(/\d/);
  });

  it('shows the unread dot when there are unread notifications', async () => {
    mockNotifications([{ id: 'n1', message: 'Hola', createdAt: '2026-08-01T00:00:00Z', read: false }]);
    const { container } = render(<NotificationBell />);
    await screen.findByRole('button', { name: 'Notificaciones' });
    expect(container.querySelector('span[style*="border-radius: 50%"]')).toBeTruthy();
  });

  it('shows no unread dot when everything is read', async () => {
    mockNotifications([{ id: 'n1', message: 'Hola', createdAt: '2026-08-01T00:00:00Z', read: true }]);
    render(<NotificationBell />);
    const button = await screen.findByRole('button', { name: 'Notificaciones' });
    // El único hijo posicionado absolute dentro del botón sería el punto —
    // sin no leídas, no debe existir ningún span extra.
    expect(button.querySelectorAll('span').length).toBe(0);
  });
});
