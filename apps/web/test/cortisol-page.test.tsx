import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CortisolPage from '../app/(app)/cortisol/page';

vi.mock('../lib/api-client', () => ({
  getSessionToken: () => 'header.eyJpZCI6ImNsaWVudC0xIn0.signature',
}));
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({ role: 'cliente', user: { id: 'client-1', name: '', email: '' } }),
}));
vi.mock('../lib/cortisol-client', () => ({
  listTechniques: vi.fn().mockResolvedValue([]),
  listCompletions: vi.fn().mockResolvedValue([]),
  getTipOfTheDay: vi.fn().mockResolvedValue(null),
  getTodayCheckin: vi.fn().mockResolvedValue(null),
  getTodayMorningCheckin: vi.fn().mockResolvedValue({ id: 'mc1', fecha: '2026-08-02', energia: 3, tension: 3, claridad: 3, activacionMatutina: 6 }),
  getCognitiveLoadOverview: vi.fn().mockResolvedValue({
    today: null,
    trend: [],
    threshold: null,
    consecutiveDaysOverThreshold: 0,
    alert: false,
    alertStreakThreshold: 3,
    latest: { hrv: null, activacionMatutina: null, recuperacionPct: null },
  }),
}));

describe('CortisolPage', () => {
  it('renders the cortisol heading', async () => {
    render(<CortisolPage />);
    expect(await screen.findByRole('heading', { name: 'Stress' })).toBeInTheDocument();
  });
});
