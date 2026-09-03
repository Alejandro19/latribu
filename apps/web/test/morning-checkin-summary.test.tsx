import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MorningCheckinSummary } from '../components/cortisol/MorningCheckinSummary';

describe('MorningCheckinSummary', () => {
  it('shows a neutral empty state for a non-mentoring client, without a way to submit', () => {
    render(<MorningCheckinSummary morningCheckin={null} clientType="coaching_1_1" cortisolAccessState="ok" />);
    expect(screen.getByText(/disponible para clientes Premium/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows a neutral empty state for a mentoring client whose Stress access is not_included', () => {
    render(<MorningCheckinSummary morningCheckin={null} clientType="mentoring" cortisolAccessState="not_included" />);
    expect(screen.getByText(/disponible para clientes Premium/)).toBeInTheDocument();
  });

  it('shows a neutral empty state for a mentoring client whose plan is expired', () => {
    render(<MorningCheckinSummary morningCheckin={null} clientType="mentoring" cortisolAccessState="expired" />);
    expect(screen.getByText(/disponible para clientes Premium/)).toBeInTheDocument();
  });

  it('points an eligible mentoring client to the Ritual Diario when there is no data yet today', () => {
    render(<MorningCheckinSummary morningCheckin={null} clientType="mentoring" cortisolAccessState="ok" />);
    expect(screen.getByText('Aún no respondiste tu check-in matutino de hoy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Responder en tu Ritual Diario/ })).toHaveAttribute('href', '/');
  });

  it('shows the read-only values when there is data for today', () => {
    render(
      <MorningCheckinSummary
        morningCheckin={{ id: 'mc1', fecha: '2026-09-02', energia: 4, tension: 2, claridad: 5, activacionMatutina: 7 }}
        clientType="mentoring"
        cortisolAccessState="ok"
      />
    );
    expect(screen.getByText('Energía 4/5 · Tensión 2/5 · Claridad 5/5')).toBeInTheDocument();
  });
});
