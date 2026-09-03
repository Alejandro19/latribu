import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { SWRConfig } from 'swr';

// SWR usa una caché global por módulo. Sin una caché nueva por render, un
// mutate() que queda "en vuelo" al desmontar un test (ej. handleCreate sin
// esperar la revalidación) puede deduparse contra el fetch del siguiente
// test para la misma key y servirle datos viejos — dedupingInterval:0 evita
// además que un remount inmediato dentro del mismo test se salte el fetch.
export function renderWithSWR(ui: ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>,
  );
}
