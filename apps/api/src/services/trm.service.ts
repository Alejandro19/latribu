// TRM oficial (USD/COP) de la Superintendencia Financiera de Colombia, vía
// la API pública de datos.gov.co — usada por el puente de conversión de
// Elite (ver account.service.ts). Formato de la respuesta verificado en
// vivo contra el endpoint real (no inventado): un array con los campos
// `valor` (tasa) y `vigenciadesde` (fecha de esa tasa).
//
// Nunca devuelve un valor inventado: si el fetch falla, usa la última
// respuesta buena cacheada en memoria SOLO si tiene ≤48h; si no hay ninguna
// caché reciente, tira TrmUnavailableError — el checkout de Elite debe
// mostrar un error claro en ese caso, nunca inventar una tasa.

const TRM_ENDPOINT = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC';
const MAX_CACHE_AGE_MS = 48 * 60 * 60 * 1000;

export class TrmUnavailableError extends Error {
  constructor() {
    super('No se pudo obtener la TRM del día y no hay una caché reciente disponible. Intenta de nuevo en unos minutos.');
    this.name = 'TrmUnavailableError';
  }
}

export type TrmValue = { value: number; date: string };
type CachedTrm = TrmValue & { fetchedAt: number };

let cache: CachedTrm | null = null;
let fetchImpl: typeof fetch = (...args) => fetch(...args);

// Únicamente para tests — evita pegarle a datos.gov.co real. Llamar con
// `null` (ej. en un afterEach) además limpia la caché en memoria, para que
// un test no contamine al siguiente; llamar con una función real durante un
// mismo test (ej. para simular que el fetch empieza a fallar) NO la limpia,
// para poder probar que sí usa la caché recién cargada.
export function setTrmFetcherForTests(fn: typeof fetch | null): void {
  fetchImpl = fn ?? ((...args) => fetch(...args));
  if (fn === null) cache = null;
}

async function fetchTrmFromApi(): Promise<TrmValue> {
  const res = await fetchImpl(TRM_ENDPOINT);
  if (!res.ok) throw new Error(`TRM API respondió ${res.status}`);
  const rows = (await res.json()) as Array<{ valor?: string; vigenciadesde?: string }>;
  const row = rows[0];
  const value = row?.valor ? Number(row.valor) : NaN;
  if (!row || !Number.isFinite(value)) throw new Error('Respuesta de la TRM sin el campo "valor" esperado.');
  return { value, date: (row.vigenciadesde ?? '').slice(0, 10) };
}

export async function getCurrentTrm(): Promise<TrmValue> {
  try {
    const fresh = await fetchTrmFromApi();
    cache = { ...fresh, fetchedAt: Date.now() };
    return fresh;
  } catch {
    if (cache && Date.now() - cache.fetchedAt <= MAX_CACHE_AGE_MS) {
      const { value, date } = cache;
      return { value, date };
    }
    throw new TrmUnavailableError();
  }
}
