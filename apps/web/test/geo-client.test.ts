import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCountries, getCities } from '../lib/geo-client';

describe('geo-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns the priority/rest country groups on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, data: { priority: [{ isoCode: 'CO', name: 'Colombia', flag: '🇨🇴', phonecode: '57' }], rest: [] } }),
    });
    const result = await getCountries();
    expect(result.priority[0].isoCode).toBe('CO');
  });

  it('throws when the countries request fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: false }) });
    await expect(getCountries()).rejects.toThrow();
  });

  it('returns the city list for a country', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ json: async () => ({ success: true, data: ['Bogotá', 'Medellín'] }) });
    const result = await getCities('CO');
    expect(result).toEqual(['Bogotá', 'Medellín']);
  });
});
