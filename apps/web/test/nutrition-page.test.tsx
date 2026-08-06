import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NutritionPage from '../app/(app)/nutrition/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/nutrition-client', () => ({
  getNutrition: vi.fn().mockResolvedValue({ plan: {}, meals: [] }),
}));
vi.mock('../lib/supplements-client', () => ({
  listSupplements: vi.fn().mockResolvedValue([]),
}));

describe('NutritionPage', () => {
  it('renders the nutrition heading', async () => {
    render(<NutritionPage />);
    expect(await screen.findByRole('heading', { name: 'Nutrición' })).toBeInTheDocument();
  });
});
