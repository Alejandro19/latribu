import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  putPersonalInfo,
  createAnthropometric,
  createPhoto,
  updateClientObjetivos,
} from '../lib/onboarding-client';

describe('onboarding-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.setItem('latribu_token', 'fake-token');
  });

  it('sends a JSON PUT for putPersonalInfo and resolves on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    await putPersonalInfo('client-1', { onboarding_report: {}, complete: true });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/clients/client-1/personal-info');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('throws with the server error message when putPersonalInfo fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: false, error: 'Plan vencido.' }) });
    await expect(putPersonalInfo('client-1', { onboarding_report: {}, complete: true })).rejects.toThrow('Plan vencido.');
  });

  it('does not set a Content-Type header when sending FormData (createPhoto)', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    const file = new File(['x'], 'frente.jpg', { type: 'image/jpeg' });
    await createPhoto('client-1', file, 'frente', 1);
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('creates an anthropometric record with a JSON body', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    await createAnthropometric('client-1', { fecha: '2026-07-29', mes_num: 1, peso: 70 });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/clients/client-1/anthropometrics');
    expect(JSON.parse(init.body)).toEqual({ fecha: '2026-07-29', mes_num: 1, peso: 70 });
  });

  it('updates client objetivos via PUT /api/clients/:id', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true }) });
    await updateClientObjetivos('client-1', { peso: 'bajar' });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/clients/client-1');
    expect(JSON.parse(init.body)).toEqual({ objetivos: { peso: 'bajar' } });
  });
});
