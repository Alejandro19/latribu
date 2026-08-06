import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../app/(app)/onboarding/page';
import * as apiClient from '../lib/api-client';
import * as onboardingClient from '../lib/onboarding-client';
import * as geoClient from '../lib/geo-client';

vi.mock('../lib/onboarding-client');
vi.mock('../lib/geo-client');

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function fillModule1() {
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1990-01-01' } });
  fireEvent.change(screen.getByLabelText('Género'), { target: { value: 'Masculino' } });
  fireEvent.change(screen.getByLabelText('Ocupación'), { target: { value: 'Ingeniero' } });
  fireEvent.change(screen.getByLabelText('Estado civil'), { target: { value: 'Soltero/a' } });
  fireEvent.change(screen.getByLabelText('País de residencia'), { target: { value: 'CO' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Bogotá' } });
  fireEvent.change(screen.getByLabelText('Celular (WhatsApp)'), { target: { value: '3001234567' } });
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.spyOn(apiClient, 'getSessionToken').mockReturnValue('fake-token');
    vi.mocked(geoClient.getCountries).mockResolvedValue({
      priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }],
      rest: [],
    });
    vi.mocked(geoClient.getCities).mockResolvedValue(['Bogotá']);
  });

  it('redirects to /login when there is no session token', () => {
    vi.spyOn(apiClient, 'getSessionToken').mockReturnValue(null);
    render(<OnboardingPage />);
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('blocks advancing from module 1 when a required field is missing and shows an alert', async () => {
    render(<OnboardingPage />);
    await screen.findByLabelText('País de residencia');
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(screen.queryByLabelText('¿Horas de trabajo al día?')).not.toBeInTheDocument();
  });

  it('advances from module 1 to module 2 once all required fields are filled', async () => {
    render(<OnboardingPage />);
    await screen.findByLabelText('País de residencia');
    fillModule1();
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findByLabelText('¿Horas de trabajo al día?')).toBeInTheDocument();
  });
});
