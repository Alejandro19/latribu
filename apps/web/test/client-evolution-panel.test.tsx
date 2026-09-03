import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSWR as render } from './swr-test-utils';
import { ClientEvolutionPanel } from '../components/evolution/ClientEvolutionPanel';
import * as evolutionClient from '../lib/evolution-client';
import * as cortisolClient from '../lib/cortisol-client';
import * as sleepClient from '../lib/sleep-client';
import * as trainingClient from '../lib/training-client';
import * as clientsClient from '../lib/clients-client';
import * as wellnessIndexClient from '../lib/wellness-index-client';
import { PermissionDeniedError } from '../lib/api-client';

vi.mock('../lib/evolution-client');
vi.mock('../lib/cortisol-client');
vi.mock('../lib/sleep-client');
vi.mock('../lib/training-client');
vi.mock('../lib/clients-client');
vi.mock('../lib/wellness-index-client');

const anthro: evolutionClient.AnthropometricRecord = {
  id: 'a1', clientId: 'client-1', fecha: '2026-07-01', semana: null, mesNum: 1,
  peso: 70, cintura: 80, brazos: 30, hombros: 100, piernas: 55, gluteo: 98, notas: null, createdAt: '2026-07-01T00:00:00Z',
};
const inbodyPrev: evolutionClient.InbodyRecord = {
  id: 'i1', clientId: 'client-1', fecha: '2026-06-01', version: null, pesoTotal: 72, smm: 30, grasaPct: 24,
  imc: null, pesoObjetivo: null, grasaVisceral: null, bmr: null, anguloFase: null, ecwTbw: null, masaOsea: null,
  altura: null, mesNum: 1, fileUrl: null, createdAt: '2026-06-01T00:00:00Z',
};
const inbodyLast: evolutionClient.InbodyRecord = {
  ...inbodyPrev, id: 'i2', fecha: '2026-07-01', pesoTotal: 70, smm: 31, grasaPct: 22, mesNum: 2,
};

function mockFetches({
  clientType = 'coaching_1_1',
  trainingDays = 4,
  anthropometrics = [anthro],
  inbody = [inbodyPrev, inbodyLast],
}: {
  clientType?: string;
  trainingDays?: number;
  anthropometrics?: evolutionClient.AnthropometricRecord[];
  inbody?: evolutionClient.InbodyRecord[];
} = {}) {
  vi.mocked(evolutionClient.getEvolutionData).mockResolvedValue({ checkins: [], anthropometrics, inbody });
  vi.mocked(cortisolClient.listCompletions).mockResolvedValue([]);
  vi.mocked(cortisolClient.listCheckins).mockResolvedValue([]);
  vi.mocked(sleepClient.listLogs).mockResolvedValue([]);
  vi.mocked(trainingClient.listTrainingCompletions).mockResolvedValue([]);
  vi.mocked(trainingClient.getStreak).mockResolvedValue({
    streakWeeks: 2, sessionsDoneThisWeek: 2, sessionsRequiredThisWeek: 4, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false,
  });
  vi.mocked(clientsClient.fetchClient).mockResolvedValue({
    id: 'client-1', name: 'Ana', email: 'a@x.com', plan: '', status: 'active', clientType,
    trainingDays, objetivos: { peso: 'bajar', grasa_corporal: 'bajar', masa_muscular: 'subir' }, nextCheckinDate: null, inbodyCadenceType: 'mensual',
  });
  vi.mocked(wellnessIndexClient.getWellnessIndex).mockResolvedValue({
    value: 72, previousValue: 64, delta: 8, trend: 'up', componentsUsed: { training: 60, sleep: 80, cortisol: 90, evolution: 70 },
  });
}

describe('ClientEvolutionPanel', () => {
  it('shows the wellness index hero and the general wellbeing summary', async () => {
    mockFetches();
    render(<ClientEvolutionPanel clientId="client-1" />);
    expect(await screen.findByText('Índice de rendimiento')).toBeInTheDocument();
    expect(screen.getByText('Panorama general')).toBeInTheDocument();
    expect(screen.getByText('Sleep')).toBeInTheDocument();
    expect(screen.getByText('Stress')).toBeInTheDocument();
  });

  it('shows the physical evolution KPIs computed from the latest measurement', async () => {
    mockFetches();
    render(<ClientEvolutionPanel clientId="client-1" />);
    expect(await screen.findByText('Tu evolución física')).toBeInTheDocument();
    expect(screen.getAllByText('70 kg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('22%').length).toBeGreaterThan(0);
  });

  it('submits a monthly check-in through the accordion form', async () => {
    const user = userEvent.setup();
    mockFetches();
    vi.mocked(evolutionClient.createCheckin).mockResolvedValue({
      id: 'chk1', clientId: 'client-1', fecha: '2026-08-05', strengthScore: null, moodScore: null,
      confidenceScore: null, securityScore: null, energyScore: null, notes: null, sleepHours: 7,
      adherencePct: 80, painFlag: null, painNotes: null, stressScore: 4, createdAt: '2026-08-05T00:00:00Z',
    });

    render(<ClientEvolutionPanel clientId="client-1" />);
    await user.click(await screen.findByText('Check-in rápido del mes'));
    await user.type(screen.getByLabelText('Horas de sueño promedio'), '7');
    await user.type(screen.getByLabelText('Adherencia al plan (%)'), '80');
    await user.click(screen.getByRole('button', { name: 'Guardar check-in' }));

    await waitFor(() =>
      expect(evolutionClient.createCheckin).toHaveBeenCalledWith(
        'client-1',
        expect.objectContaining({ sleep_hours: 7, adherence_pct: 80 })
      )
    );
  });

  it('shows the generic upgrade card when this client type has no access to Mi Evolución', async () => {
    mockFetches();
    vi.mocked(evolutionClient.getEvolutionData).mockRejectedValue(new PermissionDeniedError('Este módulo no está disponible para tu tipo de cuenta.'));
    render(<ClientEvolutionPanel clientId="client-1" />);
    expect(await screen.findByText('Disponible en Premium')).toBeInTheDocument();
  });
});
