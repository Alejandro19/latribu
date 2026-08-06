import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientDetailPage from '../app/(app)/admin/clients/[id]/page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'client-1' }),
}));

vi.mock('../lib/personal-info-client', () => ({
  getPersonalInfo: vi.fn(async () => ({ country: 'México', city: 'CDMX', weight: 70, height: 175 })),
  getAnthropometrics: vi.fn(async () => [{ id: 'a1', fecha: '2026-01-01', peso: 70, cintura: 80 }]),
  getPhotos: vi.fn(async () => []),
  getInbodyRecords: vi.fn(async () => [{ id: 'i1', fecha: '2026-01-02', pesoTotal: 70, grasaPct: 15 }]),
}));

vi.mock('../lib/training-client', () => ({
  getAchievements: vi.fn(async () => [{ id: 'ach1', clientId: 'client-1', type: 'medalla', weekNumber: 202531, earnedAt: '2026-08-01T00:00:00Z' }]),
}));

describe('ClientDetailPage', () => {
  it('renders personal info, anthropometric history, and InBody records', async () => {
    render(<ClientDetailPage />);
    expect(await screen.findByText('México')).toBeInTheDocument();
    expect(screen.getByText('CDMX')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01')).toBeInTheDocument();
  });

  it('renders the achievements section with each logro\'s type and week number', async () => {
    render(<ClientDetailPage />);
    expect(await screen.findByText('🎖️ Medalla')).toBeInTheDocument();
    expect(screen.getByText('Semana 202531')).toBeInTheDocument();
  });
});
