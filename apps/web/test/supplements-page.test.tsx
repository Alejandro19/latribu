import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupplementsPage from '../app/(app)/supplements/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/supplements-client', () => ({
  listSupplements: vi.fn().mockResolvedValue([]),
}));

describe('SupplementsPage', () => {
  it('renders the supplements heading', () => {
    render(<SupplementsPage />);
    expect(screen.getByRole('heading', { name: 'Suplementación' })).toBeInTheDocument();
  });
});
