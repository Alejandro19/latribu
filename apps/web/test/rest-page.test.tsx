import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RestPage from '../app/(app)/rest/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ role: 'cliente', user: { id: 'client-1', name: '', email: '' } }),
}));
vi.mock('../lib/wearable-client', () => ({
  getMetricas: vi.fn().mockResolvedValue({ total: 0, promedios: {}, data: [] }),
  getWearableEstado: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/sleep-client', () => ({
  getProtocol: vi.fn().mockResolvedValue(null),
  saveProtocol: vi.fn(),
}));
vi.mock('../lib/clients-client', () => ({
  fetchClient: vi.fn().mockResolvedValue({ id: 'client-1', clientType: 'mentoring' }),
}));
vi.mock('../lib/rest-tools-client', () => ({
  listRestTools: vi.fn().mockResolvedValue([]),
}));

describe('RestPage', () => {
  it('renders the client panel', async () => {
    render(<RestPage />);
    expect(await screen.findByRole('heading', { name: 'Sleep' })).toBeInTheDocument();
  });
});
