import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSWR as render } from './swr-test-utils';
import { ClientRestPanel } from '../components/rest/ClientRestPanel';
import * as wearableClient from '../lib/wearable-client';
import * as sleepClient from '../lib/sleep-client';
import * as clientsClient from '../lib/clients-client';
import * as restToolsClient from '../lib/rest-tools-client';
import { PermissionDeniedError } from '../lib/api-client';

vi.mock('../lib/wearable-client');
vi.mock('../lib/sleep-client');
vi.mock('../lib/clients-client');
vi.mock('../lib/rest-tools-client');

const sampleMetrics: wearableClient.WearableMetrica[] = [
  {
    id: 'm2', dispositivo: 'oura', fecha: '2026-08-05',
    fcReposo: 54, hrvNocturno: 62, suenoTotalMinutos: 462,
    suenoProfundoMinutos: 111, suenoRemMinutos: 212, suenoLigeroMinutos: 112, suenoDespiertoMinutos: 15,
    suenoScore: 86, tasaRespiratoria: 14.2, temperaturaPiel: 0.2,
    horaDormir: '2026-08-04T23:48:00Z', horaDespertar: '2026-08-05T07:30:00Z',
  },
  {
    id: 'm1', dispositivo: 'oura', fecha: '2026-08-04',
    fcReposo: 56, hrvNocturno: 57, suenoTotalMinutos: 420,
    suenoProfundoMinutos: 100, suenoRemMinutos: 190, suenoLigeroMinutos: 100, suenoDespiertoMinutos: 12,
    suenoScore: 78, tasaRespiratoria: 14.0, temperaturaPiel: 0.1,
    horaDormir: '2026-08-04T00:00:00Z', horaDespertar: '2026-08-04T07:00:00Z',
  },
];

function mockFetches({
  clientType = 'mentoring',
  metrics = sampleMetrics,
  protocol = null,
  ultimaSyncMinutesAgo = 12,
  dispositivosConectados = ['oura'] as wearableClient.Dispositivo[],
}: {
  clientType?: string;
  metrics?: wearableClient.WearableMetrica[];
  protocol?: sleepClient.SleepProtocol;
  ultimaSyncMinutesAgo?: number;
  dispositivosConectados?: wearableClient.Dispositivo[];
} = {}) {
  vi.mocked(wearableClient.getMetricas).mockResolvedValue({ total: metrics.length, promedios: {}, data: metrics });
  vi.mocked(wearableClient.getWearableEstado).mockResolvedValue(
    dispositivosConectados.map((dispositivo) => ({
      dispositivo, conectado: true, conectadoEn: '2026-07-01T00:00:00Z',
      ultimaSync: new Date(Date.now() - ultimaSyncMinutesAgo * 60000).toISOString(), tokenExpirado: false,
    }))
  );
  vi.mocked(wearableClient.syncWearable).mockResolvedValue({ success: true, sincronizados: 1 });
  vi.mocked(sleepClient.getProtocol).mockResolvedValue(protocol);
  vi.mocked(clientsClient.fetchClient).mockResolvedValue({
    id: 'client-1', name: 'Ana', email: 'a@x.com', plan: '', status: 'active', clientType,
  });
  vi.mocked(restToolsClient.listRestTools).mockResolvedValue([]);
}

describe('ClientRestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  it('shows the sleep score, duration and hypnogram for a mentoring client', async () => {
    mockFetches();
    render(<ClientRestPanel clientId="client-1" />);
    expect(await screen.findByText('86')).toBeInTheDocument();
    expect(screen.getByText(/puntaje de sueño · óptimo/)).toBeInTheDocument();
    // MetricValue separa cifra y unidad en spans distintos (spec de cifras).
    expect(screen.getByText('7:42')).toBeInTheDocument();
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText(/profundo 1:51/)).toBeInTheDocument();
    expect(screen.getByText(/REM 3:32/)).toBeInTheDocument();
    // Despierto usa el dato real del wearable (Oura: awake_time), nunca la
    // resta total-(profundo+rem+ligero) — ver bug reportado, siempre daba 0.
    expect(screen.getByText(/despierto 0:15/)).toBeInTheDocument();
  });

  it('shows recovery metric cards computed from the latest sync', async () => {
    mockFetches();
    render(<ClientRestPanel clientId="client-1" />);
    // MetricValue separa cifra y unidad en spans distintos (spec de cifras).
    expect(await screen.findByText('62')).toBeInTheDocument();
    expect(screen.getByText('MS')).toBeInTheDocument();
    expect(screen.getByText('54')).toBeInTheDocument();
    expect(screen.getByText('BPM')).toBeInTheDocument();
    expect(screen.getByText('14.2')).toBeInTheDocument();
    expect(screen.getByText('RPM')).toBeInTheDocument();
    expect(screen.getByText(/↑ \d+% vs\. prom\./)).toBeInTheDocument();
  });

  it('renders the trend chart with a point per synced day', async () => {
    mockFetches();
    render(<ClientRestPanel clientId="client-1" />);
    expect(await screen.findByText('Tendencia · últimos 7 días')).toBeInTheDocument();
  });

  it('renders the personalized protocol with bold action and italic context', async () => {
    mockFetches({ protocol: { protocolText: '**Prioriza tu hora de acostarte** incluso los viernes.', sleepWindow: null, supplement: 'Magnesio · 45 min antes' } });
    render(<ClientRestPanel clientId="client-1" />);
    expect(await screen.findByText('Prioriza tu hora de acostarte')).toBeInTheDocument();
    expect(screen.getByText(/incluso los viernes\./)).toBeInTheDocument();
    expect(screen.getByText('Suplemento sugerido')).toBeInTheDocument();
    expect(screen.getByText('Magnesio · 45 min antes')).toBeInTheDocument();
  });

  it('skips a same-day row that only has readiness (no sleep detail yet) and shows the last complete night instead', async () => {
    // Reproduce el bug reportado: Oura publica el readiness de hoy antes que
    // el detalle de sueño (llega después) — esa fila queda con todo en null
    // salvo temperaturaPiel, y nunca debe mostrarse como "Anoche".
    const partialToday: wearableClient.WearableMetrica = {
      id: 'm3', dispositivo: 'oura', fecha: '2026-08-06',
      fcReposo: null, hrvNocturno: null, suenoTotalMinutos: null,
      suenoProfundoMinutos: null, suenoRemMinutos: null, suenoLigeroMinutos: null, suenoDespiertoMinutos: null,
      suenoScore: null, tasaRespiratoria: null, temperaturaPiel: -0.2,
      horaDormir: null, horaDespertar: null,
    };
    mockFetches({ metrics: [partialToday, ...sampleMetrics] });
    render(<ClientRestPanel clientId="client-1" />);
    // El puntaje 86 y la duración 7:42 son de la última noche COMPLETA (m2),
    // no de la fila parcial de hoy.
    expect(await screen.findByText('86')).toBeInTheDocument();
    expect(screen.getByText('7:42')).toBeInTheDocument();
  });

  it('shows an empty state in the hero when no wearable data has synced yet', async () => {
    mockFetches({ metrics: [] });
    render(<ClientRestPanel clientId="client-1" />);
    expect(await screen.findByText('Aún no hay datos sincronizados desde tu Oura Ring.')).toBeInTheDocument();
  });

  it('locks the module behind an overlay for a non-mentoring client', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockFetches({ clientType: 'coaching_1_1' });
    render(<ClientRestPanel clientId="client-1" />);

    expect(await screen.findByText('Disponible en Premium')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hablar con tu coach' }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('wa.me'), '_blank');
  });

  it('shows the generic upgrade card (not "Módulo no disponible") when the module itself is not allowed for this client type', async () => {
    mockFetches();
    vi.mocked(sleepClient.getProtocol).mockRejectedValue(new PermissionDeniedError('Este módulo no está disponible para tu tipo de cuenta.'));
    render(<ClientRestPanel clientId="client-1" />);

    expect(await screen.findByText('Disponible en Premium')).toBeInTheDocument();
  });

  it('auto-syncs in the background on open when the last sync is stale, so the client never has to remember to sync', async () => {
    mockFetches({ ultimaSyncMinutesAgo: 12 });
    render(<ClientRestPanel clientId="client-1" />);
    await screen.findByText('86');
    await waitFor(() => expect(wearableClient.syncWearable).toHaveBeenCalledWith('client-1', 'oura'));
  });

  it('does not auto-sync again if the last sync was very recent (avoids hammering the provider)', async () => {
    mockFetches({ ultimaSyncMinutesAgo: 1 });
    render(<ClientRestPanel clientId="client-1" />);
    await screen.findByText('86');
    expect(wearableClient.syncWearable).not.toHaveBeenCalled();
  });

  it('lets the client force a sync with the "Sincronizar ahora" button', async () => {
    const user = userEvent.setup();
    mockFetches({ ultimaSyncMinutesAgo: 1 }); // sin auto-sync de fondo, para aislar el click manual
    render(<ClientRestPanel clientId="client-1" />);
    await screen.findByText('86');

    await user.click(screen.getByRole('button', { name: /Sincronizar ahora/ }));
    await waitFor(() => expect(wearableClient.syncWearable).toHaveBeenCalledWith('client-1', 'oura'));
  });

  it('shows an error message next to the button when a manual sync fails, without wiping the data already shown', async () => {
    const user = userEvent.setup();
    mockFetches({ ultimaSyncMinutesAgo: 1 });
    vi.mocked(wearableClient.syncWearable).mockResolvedValue({ success: false, error: 'Oura no conectado' });
    render(<ClientRestPanel clientId="client-1" />);
    await screen.findByText('86');

    await user.click(screen.getByRole('button', { name: /Sincronizar ahora/ }));
    expect(await screen.findByText('Oura no conectado')).toBeInTheDocument();
    // El puntaje de la última noche completa sigue visible — un fallo de sync no borra nada.
    expect(screen.getByText('86')).toBeInTheDocument();
  });

  describe('reintentos automáticos hasta que la noche de hoy esté completa', () => {
    const today = '2026-08-06';
    const partialToday: wearableClient.WearableMetrica = {
      id: 'm3', dispositivo: 'oura', fecha: today,
      fcReposo: null, hrvNocturno: null, suenoTotalMinutos: null,
      suenoProfundoMinutos: null, suenoRemMinutos: null, suenoLigeroMinutos: null, suenoDespiertoMinutos: null,
      suenoScore: null, tasaRespiratoria: null, temperaturaPiel: -0.1,
      horaDormir: null, horaDespertar: null,
    };
    const completeToday: wearableClient.WearableMetrica = { ...partialToday, suenoTotalMinutos: 400, suenoScore: 82 };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries in the background one minute later when the first sync still lacks a complete night for today, and stops once it does', async () => {
      mockFetches({ ultimaSyncMinutesAgo: 1, metrics: [partialToday, ...sampleMetrics] });
      vi.mocked(wearableClient.getMetricas)
        .mockResolvedValueOnce({ total: 3, promedios: {}, data: [partialToday, ...sampleMetrics] })
        .mockResolvedValueOnce({ total: 3, promedios: {}, data: [partialToday, ...sampleMetrics] })
        .mockResolvedValue({ total: 3, promedios: {}, data: [completeToday, ...sampleMetrics] });

      render(<ClientRestPanel clientId="client-1" />);
      await screen.findByText('86');

      // Solo se congela el reloj (setTimeout + Date) DESPUÉS de que cargó
      // todo lo inicial — con fake timers desde el montaje, el propio
      // `waitFor`/`findBy*` de Testing Library (que también usa timers para
      // reintentar) se queda esperando sin nunca poder avanzar.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(new Date(`${today}T10:00:00Z`));
      fireEvent.click(screen.getByRole('button', { name: /Sincronizar ahora/ }));
      // Con setTimeout ya congelado, `findByText`/`waitFor` no pueden
      // reintentar solos — se drena la cadena de promesas a mano antes de
      // hacer aserciones síncronas.
      await vi.advanceTimersByTimeAsync(0);
      expect(screen.getByText(/seguimos intentando en segundo plano/)).toBeInTheDocument();
      expect(wearableClient.syncWearable).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(wearableClient.syncWearable).toHaveBeenCalledTimes(2);
      // La noche de hoy ya está completa — el aviso desaparece sin más reintentos.
      expect(screen.queryByText(/seguimos intentando en segundo plano/)).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(wearableClient.syncWearable).toHaveBeenCalledTimes(2);
    });

    it('stops retrying after 4 background attempts even if the night never completes', async () => {
      mockFetches({ ultimaSyncMinutesAgo: 1, metrics: [partialToday, ...sampleMetrics] });
      vi.mocked(wearableClient.getMetricas).mockResolvedValue({ total: 3, promedios: {}, data: [partialToday, ...sampleMetrics] });

      render(<ClientRestPanel clientId="client-1" />);
      await screen.findByText('86');

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.setSystemTime(new Date(`${today}T10:00:00Z`));
      fireEvent.click(screen.getByRole('button', { name: /Sincronizar ahora/ }));
      await vi.advanceTimersByTimeAsync(0);
      expect(screen.getByText(/seguimos intentando en segundo plano/)).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(5 * 60_000);
      // 1 intento manual + 4 reintentos en segundo plano = 5, nunca más.
      expect(wearableClient.syncWearable).toHaveBeenCalledTimes(5);
    });
  });
});
