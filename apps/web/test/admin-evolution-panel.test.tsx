import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminEvolutionPanel } from '../components/evolution/AdminEvolutionPanel';
import * as evolutionClient from '../lib/evolution-client';
import * as cortisolClient from '../lib/cortisol-client';
import * as sleepClient from '../lib/sleep-client';
import * as trainingClient from '../lib/training-client';
import * as clientsClient from '../lib/clients-client';

vi.mock('../lib/evolution-client');
vi.mock('../lib/cortisol-client');
vi.mock('../lib/sleep-client');
vi.mock('../lib/training-client');
vi.mock('../lib/clients-client');

function mockFetches({ clientType = 'coaching_1_1', nextCheckinDate = null as string | null } = {}) {
  vi.mocked(evolutionClient.getEvolutionData).mockResolvedValue({ checkins: [], anthropometrics: [], inbody: [] });
  vi.mocked(cortisolClient.listCompletions).mockResolvedValue([]);
  vi.mocked(cortisolClient.listCheckins).mockResolvedValue([]);
  vi.mocked(sleepClient.listLogs).mockResolvedValue([]);
  vi.mocked(trainingClient.listTrainingCompletions).mockResolvedValue([]);
  vi.mocked(clientsClient.fetchClient).mockResolvedValue({
    id: 'c1', name: 'Ana', email: 'a@x.com', plan: '', status: 'active', clientType,
    trainingDays: 4, objetivos: {}, nextCheckinDate, inbodyCadenceType: 'mensual',
  });
}

describe('AdminEvolutionPanel', () => {
  it('shows the wellness dashboard and the next-checkin-date admin field', async () => {
    mockFetches({ nextCheckinDate: '2026-09-01' });
    render(<AdminEvolutionPanel clientId="c1" />);
    expect(await screen.findByText('Índice de bienestar general')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de la próxima medición')).toHaveValue('2026-09-01');
  });

  it('saves the next checkin date', async () => {
    const user = userEvent.setup();
    mockFetches();
    vi.mocked(evolutionClient.updateNextCheckinDate).mockResolvedValue(undefined);

    render(<AdminEvolutionPanel clientId="c1" />);
    const input = await screen.findByLabelText('Fecha de la próxima medición');
    await user.type(input, '2026-10-15');
    await user.click(screen.getByRole('button', { name: 'Guardar fecha' }));

    await waitFor(() => expect(evolutionClient.updateNextCheckinDate).toHaveBeenCalledWith('c1', '2026-10-15'));
  });

  it('shows a locked note instead of the physical evolution section for a lead_wellness client', async () => {
    mockFetches({ clientType: 'lead_wellness' });
    render(<AdminEvolutionPanel clientId="c1" />);
    expect(await screen.findByText(/la evolución física se le muestra bloqueada/)).toBeInTheDocument();
  });
});
