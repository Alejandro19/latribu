import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvolutionPage from '../app/(app)/evolution/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ role: 'cliente', user: { id: 'client-1', name: '', email: '' } }),
}));
vi.mock('../lib/evolution-client', () => ({
  getEvolutionData: vi.fn().mockResolvedValue({ checkins: [], anthropometrics: [], inbody: [] }),
  createCheckin: vi.fn(),
  updateNextCheckinDate: vi.fn(),
}));
vi.mock('../lib/cortisol-client', () => ({
  listCompletions: vi.fn().mockResolvedValue([]),
  listCheckins: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/sleep-client', () => ({
  listLogs: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/training-client', () => ({
  listTrainingCompletions: vi.fn().mockResolvedValue([]),
  getStreak: vi.fn().mockResolvedValue(null),
}));
vi.mock('../lib/clients-client', () => ({
  fetchClient: vi.fn().mockResolvedValue({ id: 'client-1', clientType: 'coaching_1_1' }),
}));

describe('EvolutionPage', () => {
  it('renders the evolution heading for a client', async () => {
    render(<EvolutionPage />);
    expect(await screen.findByRole('heading', { name: 'Evolution' })).toBeInTheDocument();
  });
});
