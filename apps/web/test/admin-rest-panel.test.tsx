import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminRestPanel } from '../components/rest/AdminRestPanel';
import * as sleepClient from '../lib/sleep-client';
import * as clientsClient from '../lib/clients-client';
import * as restToolsClient from '../lib/rest-tools-client';

vi.mock('../lib/sleep-client');
vi.mock('../lib/clients-client');
vi.mock('../lib/rest-tools-client');

describe('AdminRestPanel', () => {
  it('shows a note instead of the protocol form for a non-mentoring client', async () => {
    vi.mocked(sleepClient.getProtocol).mockResolvedValue(null);
    vi.mocked(clientsClient.fetchClient).mockResolvedValue({
      id: 'c1', name: 'Ana', email: 'a@x.com', plan: '', status: 'active', clientType: 'coaching_1_1',
    });
    vi.mocked(restToolsClient.listAllRestTools).mockResolvedValue([]);

    render(<AdminRestPanel clientId="c1" />);
    expect(await screen.findByText(/no tiene el plan Mentoring/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Protocolo — una línea/)).not.toBeInTheDocument();
  });

  it('saves the personalized protocol for a mentoring client', async () => {
    const user = userEvent.setup();
    vi.mocked(sleepClient.getProtocol).mockResolvedValue(null);
    vi.mocked(clientsClient.fetchClient).mockResolvedValue({
      id: 'c1', name: 'Ana', email: 'a@x.com', plan: '', status: 'active', clientType: 'mentoring',
    });
    vi.mocked(restToolsClient.listAllRestTools).mockResolvedValue([]);
    vi.mocked(sleepClient.saveProtocol).mockResolvedValue({ protocolText: '**Duerme temprano** todos los días.', sleepWindow: null, supplement: '' });

    render(<AdminRestPanel clientId="c1" />);
    const textarea = await screen.findByLabelText(/Protocolo — una línea/);
    await user.type(textarea, '**Duerme temprano** todos los días.');
    await user.click(screen.getByRole('button', { name: 'Guardar protocolo' }));

    await waitFor(() =>
      expect(sleepClient.saveProtocol).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ protocol_text: '**Duerme temprano** todos los días.' })
      )
    );
    expect(sleepClient.saveProtocol).toHaveBeenCalledWith('c1', expect.not.objectContaining({ sleep_window: expect.anything() }));
  });

  it('always renders the global rest tools bank below the protocol section', async () => {
    vi.mocked(sleepClient.getProtocol).mockResolvedValue(null);
    vi.mocked(clientsClient.fetchClient).mockResolvedValue({
      id: 'c1', name: 'Ana', email: 'a@x.com', plan: '', status: 'active', clientType: 'lead_wellness',
    });
    vi.mocked(restToolsClient.listAllRestTools).mockResolvedValue([
      { id: 't1', name: 'Sonidos para dormir', meta: null, action: 'play', minutes: 5, seconds: 0, audioUrl: null, audioName: null, active: true, sortOrder: 0 },
    ]);

    render(<AdminRestPanel clientId="c1" />);
    expect(await screen.findByText('Sonidos para dormir')).toBeInTheDocument();
  });
});
