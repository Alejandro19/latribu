'use client';

import { useEffect, useState } from 'react';
import { listSupplements, type Supplement } from '../../lib/supplements-client';

export function ClientSupplementsPanel({ clientId }: { clientId: string }) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSupplements(clientId)
      .then(setSupplements)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <p>Cargando tus suplementos...</p>;
  if (error) return <p role="alert">{error}</p>;
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
