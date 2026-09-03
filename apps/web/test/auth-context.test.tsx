import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../lib/auth-context';

vi.mock('../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/api-client')>('../lib/api-client');
  return {
    ...actual,
    getSessionToken: vi.fn(() => 'fake.token.value'),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthMe: vi.fn(),
  };
});

import { fetchAuthMe, clearSession, AuthInvalidError } from '../lib/api-client';

function Probe() {
  const { isLoading, token, role } = useAuth();
  return <div>{isLoading ? 'loading' : `ready:${token}:${role}`}</div>;
}

describe('AuthProvider.refreshAuth', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('retries after a transient failure (network/tunnel blip) instead of clearing a fresh session', async () => {
    vi.mocked(fetchAuthMe)
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ success: true, role: 'cliente', user: { id: '1', name: 'A', email: 'a@a.com' } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('ready:fake.token.value:cliente')).toBeInTheDocument(), { timeout: 3000 });
    expect(fetchAuthMe).toHaveBeenCalledTimes(2);
    expect(clearSession).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('clears the session immediately on an AuthInvalidError (401/403), without retrying', async () => {
    vi.mocked(fetchAuthMe).mockRejectedValue(new AuthInvalidError('invalid'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(clearSession).toHaveBeenCalled());
    expect(fetchAuthMe).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/login');
  });
});
