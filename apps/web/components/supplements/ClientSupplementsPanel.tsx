'use client';

import useSWR from 'swr';
import { listSupplements, type Supplement } from '../../lib/supplements-client';

export function ClientSupplementsPanel({ clientId }: { clientId: string }) {
  const { data: supplements = [] as Supplement[], error, isLoading } = useSWR(
    ['supplements', clientId],
    () => listSupplements(clientId),
  );

  if (isLoading) return <p>Cargando tus suplementos...</p>;
  if (error) return <p role="alert">{(error as Error).message}</p>;
  if (supplements.length === 0) return <p>Todavía no tienes suplementos asignados.</p>;

  return (
    <ul>
      {supplements.map((supplement) => (
        <li key={supplement.id}>
          <strong>{supplement.name}</strong>
          {supplement.dose ? ` — ${supplement.dose}` : ''}
          {supplement.timing ? ` (${supplement.timing})` : ''}
        </li>
      ))}
    </ul>
  );
}
