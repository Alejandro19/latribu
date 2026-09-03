import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../app/(auth)/login/page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('redirects an admin to /admin/clients', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, token: 'abc.def.ghi', role: 'admin', user: { id: '1', name: 'Admin', email: 'a@a.com' } }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/clients'));
  });

  it('redirects a client with an incomplete onboarding to /onboarding', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        token: 'abc.def.ghi',
        role: 'cliente',
        user: { id: '2', name: 'Cliente', email: 'c@c.com' },
        onboardingComplete: false,
      }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c@c.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/onboarding'));
  });

  it('redirects a client who already completed onboarding to /training', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        token: 'abc.def.ghi',
        role: 'cliente',
        user: { id: '3', name: 'Cliente', email: 'c2@c.com' },
        onboardingComplete: true,
      }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c2@c.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/training'));
  });

  it('shows an error message on failed login', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: false, error: 'Credenciales incorrectas.' }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas.');
  });

  it('redirects to /training when a pending NFC confirm action exists, ahead of the onboarding check', async () => {
    window.localStorage.setItem('lt_pending_action', JSON.stringify({ m: 'entrenamiento', a: 'confirmar' }));
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        token: 'abc.def.ghi',
        role: 'cliente',
        user: { id: '5', name: 'Cliente', email: 'c5@c.com' },
        onboardingComplete: false,
      }),
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'c5@c.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/training'));
    expect(pushMock).not.toHaveBeenCalledWith('/onboarding');
  });
});
