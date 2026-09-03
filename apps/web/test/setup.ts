import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { mutate } from 'swr';

// jsdom no implementa ResizeObserver — usado por el login para medir el alto
// real del botón de Google (SDK externo) y replicarlo en el de Apple.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(async () => {
  cleanup();
  // SWR usa una caché global por módulo — sin esto, un test que carga datos
  // bajo una key (ej. ['supplements', 'client-1']) deja esa data cacheada
  // para el siguiente test que use la misma key, aunque mockee una respuesta
  // distinta.
  await mutate(() => true, undefined, { revalidate: false });
});
