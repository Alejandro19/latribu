import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClientDetailPage from '../app/(app)/admin/clients/[id]/page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'client-1' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../lib/clients-client', () => ({
  fetchClient: vi.fn(async () => ({
    id: 'client-1', name: 'Ana Ruiz', email: 'ana@example.com', plan: 'coaching_1_1',
    status: 'active', clientType: 'coaching_1_1',
  })),
  fetchMembershipPayments: vi.fn(async () => []),
}));

vi.mock('../lib/personal-info-client', () => ({
  getPersonalInfo: vi.fn(async () => ({
    completedAt: '2026-01-01T00:00:00Z',
    country: 'México',
    city: 'CDMX',
    weight: 70,
    height: 175,
    onboardingReport: {},
  })),
}));

describe('ClientDetailPage', () => {
  it('renders personal info inside the onboarding summary once its module is expanded', async () => {
    render(<ClientDetailPage />);
    // El resumen de onboarding vive en un accordion colapsado por módulo —
    // el módulo 1 ("Perfil Personal") trae país/ciudad.
    fireEvent.click(await screen.findByText('Perfil Personal'));
    expect(await screen.findByText('México')).toBeInTheDocument();
    expect(screen.getByText('CDMX')).toBeInTheDocument();
  });
});
