import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommunityPage from '../app/(app)/community/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ role: 'cliente', user: { id: 'client-1', name: '', email: '' } }),
}));
vi.mock('../lib/events-client', () => ({
  listEvents: vi.fn().mockResolvedValue([]),
  reserveEvent: vi.fn(),
  cancelEventReservation: vi.fn(),
  listMyEventReservations: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/therapies-client', () => ({
  listTherapies: vi.fn().mockResolvedValue([]),
  reserveTherapy: vi.fn(),
  cancelTherapyReservation: vi.fn(),
  listMyTherapyReservations: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/clients-client', () => ({
  fetchClient: vi.fn().mockResolvedValue({ id: 'client-1', clientType: 'coaching_1_1' }),
}));

describe('CommunityPage', () => {
  it('renders the community heading for a client', async () => {
    render(<CommunityPage />);
    expect(await screen.findByRole('heading', { name: 'The Circle' })).toBeInTheDocument();
  });
});
