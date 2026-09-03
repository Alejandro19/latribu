import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSWR as render } from './swr-test-utils';
import { ClientBlindspotPanel } from '@/components/blindspot/ClientBlindspotPanel';
import * as blindspotClient from '@/lib/blindspot-client';
import * as insightsClient from '@/lib/insights-client';

vi.mock('@/lib/blindspot-client');
vi.mock('@/lib/insights-client');

describe('ClientBlindspotPanel', () => {
  beforeEach(() => {
    vi.mocked(blindspotClient.clientGetMyCase).mockResolvedValue({ case: null, tasks: [], sessionLogs: [] });
    vi.mocked(insightsClient.getInsights).mockResolvedValue({ applicable: false });
  });

  it('shows a locked state for a non-mentoring client, never calling the API', () => {
    render(<ClientBlindspotPanel clientType="coaching_1_1" clientId="client-1" />);
    expect(screen.getByText('Disponible en Premium')).toBeInTheDocument();
    // Regression: la versión anterior pasaba <BlindspotBody/> vivo como fondo
    // desenfocado del candado, que hacía su propio fetch y mostraba su
    // propio candado fantasma por debajo — ver ClientBlindspotPanel.tsx.
    expect(blindspotClient.clientGetMyCase).not.toHaveBeenCalled();
  });

  it('shows an empty state for a mentoring client with no case yet', async () => {
    render(<ClientBlindspotPanel clientType="mentoring" clientId="client-1" />);
    expect(await screen.findByText(/aún no ha iniciado tu evaluación/i)).toBeInTheDocument();
  });

  it('renders tasks and the clientNote from a session log, but never the internalSummary text', async () => {
    vi.mocked(blindspotClient.clientGetMyCase).mockResolvedValue({
      case: { id: 'case-1', caseNumber: 1, status: 'en_proceso', therapistName: 'Dra. Ríos' },
      tasks: [
        { id: 't1', caseId: 'case-1', title: 'Escribir 3 patrones', description: null, dueDate: null, status: 'pendiente', createdBy: 'th-1', completedAt: null, createdAt: '2026-08-01' },
      ],
      sessionLogs: [
        // El backend nunca debería mandar internalSummary al cliente, pero si por error
        // lo hiciera, el componente jamás debe pintarlo — defensa en profundidad.
        { id: 's1', sessionDate: '2026-08-05', progressMarker: 'avance', clientNote: 'Vamos muy bien, sigue así.', internalSummary: 'DETALLE_CLINICO_SENSIBLE_NUNCA_VISIBLE' } as blindspotClient.BlindspotSessionLog,
      ],
    });

    render(<ClientBlindspotPanel clientType="mentoring" clientId="client-1" />);

    expect(await screen.findByText('Escribir 3 patrones')).toBeInTheDocument();
    expect(screen.getByText('Dra. Ríos', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Vamos muy bien, sigue así.')).toBeInTheDocument();
    expect(screen.queryByText(/DETALLE_CLINICO_SENSIBLE_NUNCA_VISIBLE/)).not.toBeInTheDocument();
  });

  it('lets the client mark a task as completed', async () => {
    const user = userEvent.setup();
    vi.mocked(blindspotClient.clientGetMyCase).mockResolvedValue({
      case: { id: 'case-1', caseNumber: 1, status: 'en_proceso', therapistName: null },
      tasks: [{ id: 't1', caseId: 'case-1', title: 'Meditar 10 min', description: null, dueDate: null, status: 'pendiente', createdBy: 'th-1', completedAt: null, createdAt: '2026-08-01' }],
      sessionLogs: [],
    });
    vi.mocked(blindspotClient.clientCompleteTask).mockResolvedValue({ id: 't1', caseId: 'case-1', title: 'Meditar 10 min', description: null, dueDate: null, status: 'completada', createdBy: 'th-1', completedAt: '2026-08-06', createdAt: '2026-08-01' });

    render(<ClientBlindspotPanel clientType="mentoring" clientId="client-1" />);
    await user.click(await screen.findByRole('button', { name: 'Marcar hecha' }));

    await waitFor(() => expect(blindspotClient.clientCompleteTask).toHaveBeenCalledWith('t1'));
  });

  it('sends a help request and shows confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(blindspotClient.clientGetMyCase).mockResolvedValue({
      case: { id: 'case-1', caseNumber: 1, status: 'en_proceso', therapistName: null },
      tasks: [],
      sessionLogs: [],
    });
    vi.mocked(blindspotClient.clientRequestHelp).mockResolvedValue('Le avisamos a Alejandro.');

    render(<ClientBlindspotPanel clientType="mentoring" clientId="client-1" />);
    await user.click(await screen.findByRole('button', { name: 'Avisar a Alejandro ahora' }));

    expect(await screen.findByText(/le avisamos a alejandro/i)).toBeInTheDocument();
  });
});
