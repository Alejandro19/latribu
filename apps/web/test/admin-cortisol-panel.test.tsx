import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminCortisolPanel } from '../components/cortisol/AdminCortisolPanel';
import * as cortisolClient from '../lib/cortisol-client';
import * as cortisolTipsClient from '../lib/cortisol-tips-client';

vi.mock('../lib/cortisol-client');
vi.mock('../lib/cortisol-tips-client');

const baseTechnique = {
  type: null, duration: null, durationMinutes: null, durationSeconds: null, description: null,
  videoUrl: null, videoName: null, youtubeUrl: null, audioUrl: null, audioName: null,
};

describe('AdminCortisolPanel', () => {
  beforeEach(() => {
    vi.mocked(cortisolClient.listTechniques).mockResolvedValue([]);
    vi.mocked(cortisolTipsClient.listTips).mockResolvedValue([]);
  });

  it('lists existing techniques', async () => {
    const user = userEvent.setup();
    vi.mocked(cortisolClient.listTechniques).mockResolvedValue([
      { ...baseTechnique, id: 't1', title: 'Respiración 4-7-8', type: 'Respiración' },
    ]);
    render(<AdminCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByText(/Técnicas asignadas/));
    await user.click(screen.getByText(/Técnicas asignadas/));
    expect(await screen.findByText('Respiración 4-7-8')).toBeInTheDocument();
  });

  it('assigns a new technique with duration and youtube url', async () => {
    const user = userEvent.setup();
    vi.mocked(cortisolClient.createTechnique).mockResolvedValue({ ...baseTechnique, id: 't2', title: 'Meditación' });
    render(<AdminCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByLabelText('Título'));

    await user.type(screen.getByLabelText('Título'), 'Meditación');
    await user.type(screen.getByLabelText('Minutos'), '5');
    await user.type(screen.getByLabelText('Segundos'), '30');
    await user.type(screen.getByLabelText('Video (YouTube)'), 'https://youtube.com/watch?v=abcdef');
    await user.click(screen.getByRole('button', { name: 'Asignar' }));

    await waitFor(() =>
      expect(cortisolClient.createTechnique).toHaveBeenCalledWith(
        'client-1',
        expect.objectContaining({
          title: 'Meditación',
          duration_minutes: 5,
          duration_seconds: 30,
          youtube_url: 'https://youtube.com/watch?v=abcdef',
        })
      )
    );
  });

  it('expands the techniques accordion and deletes a technique', async () => {
    const user = userEvent.setup();
    vi.mocked(cortisolClient.listTechniques).mockResolvedValue([
      { ...baseTechnique, id: 't1', title: 'Respiración' },
    ]);
    render(<AdminCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByText(/Técnicas asignadas/));

    await user.click(screen.getByText(/Técnicas asignadas/));
    const list = await screen.findByRole('list');
    await within(list).findByText('Respiración');

    await user.click(within(list).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(cortisolClient.deleteTechnique).toHaveBeenCalledWith('client-1', 't1'));
  });

  it('edits a technique inline', async () => {
    const user = userEvent.setup();
    vi.mocked(cortisolClient.listTechniques).mockResolvedValue([
      { ...baseTechnique, id: 't1', title: 'Respiración', durationMinutes: 5 },
    ]);
    vi.mocked(cortisolClient.updateTechnique).mockResolvedValue({ ...baseTechnique, id: 't1', title: 'Respiración editada' });
    render(<AdminCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByText(/Técnicas asignadas/));
    await user.click(screen.getByText(/Técnicas asignadas/));
    const list = await screen.findByRole('list');
    await within(list).findByText('Respiración');

    await user.click(within(list).getByRole('button', { name: 'Editar' }));
    const titleInput = within(list).getByLabelText('Título');
    await user.clear(titleInput);
    await user.type(titleInput, 'Respiración editada');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(cortisolClient.updateTechnique).toHaveBeenCalledWith('client-1', 't1', expect.objectContaining({ title: 'Respiración editada' }))
    );
  });

  it('expands the tips accordion and creates a tip', async () => {
    const user = userEvent.setup();
    vi.mocked(cortisolTipsClient.createTip).mockResolvedValue({ id: 'tip1', content: 'Duerme bien.', active: true });
    render(<AdminCortisolPanel clientId="client-1" />);
    await waitFor(() => screen.getByText(/Tips educativos/));

    await user.click(screen.getByText(/Tips educativos/));
    const textarea = await screen.findByLabelText('Nuevo tip');
    await user.type(textarea, 'Duerme bien.');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(cortisolTipsClient.createTip).toHaveBeenCalledWith('Duerme bien.'));
  });
});
