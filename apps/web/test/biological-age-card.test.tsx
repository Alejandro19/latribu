import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithSWR as render } from './swr-test-utils';
import { BiologicalAgeCard } from '../components/evolution/BiologicalAgeCard';
import * as labPanelsClient from '../lib/lab-panels-client';
import type { LabPanel } from '../lib/lab-panels-client';

vi.mock('../lib/lab-panels-client');

function panel(overrides: Partial<LabPanel>): LabPanel {
  return {
    id: 'p1', semanaNumero: 0, fecha: '2026-08-01', datos: {}, status: 'aprobado',
    fileUrl: null, fileName: null, approvedAt: '2026-08-02T00:00:00Z',
    edadBiologica: null, edadCronologicaCalculo: null, edadBiologicaCalculadaEn: null,
    ...overrides,
  };
}

describe('BiologicalAgeCard', () => {
  it('shows the biological and chronological age from the most recent approved checkpoint that has both', async () => {
    vi.mocked(labPanelsClient.listLabPanels).mockResolvedValue([
      panel({ semanaNumero: 0, edadBiologica: 34.2, edadCronologicaCalculo: 38, edadBiologicaCalculadaEn: '2026-08-02T00:00:00Z' }),
      panel({ id: 'p2', semanaNumero: 6, edadBiologica: 32.7, edadCronologicaCalculo: 38, edadBiologicaCalculadaEn: '2026-09-15T00:00:00Z' }),
    ]);
    render(<BiologicalAgeCard clientId="client-1" />);
    expect(await screen.findByText('32.7')).toBeInTheDocument();
    expect(screen.getByText('Edad cronológica: 38 años')).toBeInTheDocument();
  });

  it('shows the empty state — never a fake value — when no approved panel has a complete PhenoAge calculation', async () => {
    vi.mocked(labPanelsClient.listLabPanels).mockResolvedValue([
      panel({ semanaNumero: 0, status: 'en_revision' }),
      panel({ semanaNumero: 6, status: 'aprobado', edadBiologica: null, edadCronologicaCalculo: null }),
    ]);
    render(<BiologicalAgeCard clientId="client-1" />);
    expect(await screen.findByText(/Aún no tienes un laboratorio aprobado/)).toBeInTheDocument();
  });

  it('shows the empty state when the client has no lab panels at all', async () => {
    vi.mocked(labPanelsClient.listLabPanels).mockResolvedValue([]);
    render(<BiologicalAgeCard clientId="client-1" />);
    expect(await screen.findByText(/Aún no tienes un laboratorio aprobado/)).toBeInTheDocument();
  });
});
