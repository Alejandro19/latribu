import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetPasswordPage from '../app/(auth)/set-password/page';
import * as apiClient from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  getSessionToken: vi.fn(() => 'fake-token'),
  saveSession: vi.fn(),
  changePasswordRequest: vi.fn(),
}));

describe('SetPasswordPage', () => {
  let capturedHref: string | null;
  const realLocation = window.location;

  function setSearch(search: string) {
    // jsdom no deja redefinir location.href directamente (no configurable) —
    // se reemplaza todo el objeto por un stub que delega pathname/search al
    // valor fijado acá, y captura los intentos de navegación (href = ...)
    // sin que jsdom tire "Not implemented: navigation".
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/set-password', search, get href() { return capturedHref ?? '/set-password' + search; }, set href(v: string) { capturedHref = v; } },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getSessionToken).mockReturnValue('fake-token');
    capturedHref = null;
    setSearch('');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('redirects to /login when there is no session token', () => {
    vi.mocked(apiClient.getSessionToken).mockReturnValue(null);
    render(<SetPasswordPage />);
    expect(capturedHref).toBe('/login');
  });

  it('shows an error when the new password and confirmation do not match', async () => {
    const user = userEvent.setup();
    render(<SetPasswordPage />);
    await user.type(screen.getByLabelText('Contraseña temporal'), 'temporal123');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'nueva-buena-123');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'otra-cosa');
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.');
    expect(apiClient.changePasswordRequest).not.toHaveBeenCalled();
  });

  it('changes the password and redirects to the pending deep-link target on success', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.changePasswordRequest).mockResolvedValue({ success: true, message: 'ok' });
    setSearch('?from=%2Ftraining%3Fm%3Dentrenamiento%26a%3Dconfirmar');

    render(<SetPasswordPage />);
    await user.type(screen.getByLabelText('Contraseña temporal'), 'temporal123');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'nueva-buena-123');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'nueva-buena-123');
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));

    await waitFor(() => expect(apiClient.changePasswordRequest).toHaveBeenCalledWith('temporal123', 'nueva-buena-123'));
    await waitFor(() => expect(capturedHref).toBe('/training?m=entrenamiento&a=confirmar'));
  });

  it('shows the server error when changePasswordRequest fails', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.changePasswordRequest).mockResolvedValue({ success: false, error: 'Contraseña actual incorrecta.' });

    render(<SetPasswordPage />);
    await user.type(screen.getByLabelText('Contraseña temporal'), 'wrong-temp');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'nueva-buena-123');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'nueva-buena-123');
    await user.click(screen.getByRole('button', { name: 'Guardar y continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña actual incorrecta.');
  });
});
