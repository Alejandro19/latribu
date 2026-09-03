import { describe, it, expect, afterEach } from 'vitest';
import { getCurrentTrm, setTrmFetcherForTests, TrmUnavailableError } from '../src/services/trm.service.js';

function fakeFetch(body: unknown) {
  return async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
}

function failingFetch() {
  return async () => {
    throw new Error('network down');
  };
}

describe('trm.service', () => {
  afterEach(() => {
    setTrmFetcherForTests(null); // limpia el fetcher Y la caché en memoria
  });

  it('devuelve el valor de un fetch exitoso', async () => {
    setTrmFetcherForTests(fakeFetch([{ valor: '4100.5', vigenciadesde: '2026-08-20T00:00:00.000' }]));
    const trm = await getCurrentTrm();
    expect(trm.value).toBe(4100.5);
    expect(trm.date).toBe('2026-08-20');
  });

  it('usa la caché reciente si el fetch falla después de haber tenido una respuesta buena', async () => {
    setTrmFetcherForTests(fakeFetch([{ valor: '4200', vigenciadesde: '2026-08-20T00:00:00.000' }]));
    await getCurrentTrm(); // primes la caché
    setTrmFetcherForTests(failingFetch());
    const trm = await getCurrentTrm();
    expect(trm.value).toBe(4200);
  });

  it('tira TrmUnavailableError si el fetch falla y no hay ninguna caché', async () => {
    setTrmFetcherForTests(failingFetch());
    await expect(getCurrentTrm()).rejects.toThrow(TrmUnavailableError);
  });

  it('tira TrmUnavailableError (nunca inventa un valor) si la respuesta no trae el campo "valor"', async () => {
    setTrmFetcherForTests(fakeFetch([{}]));
    await expect(getCurrentTrm()).rejects.toThrow(TrmUnavailableError);
  });
});
