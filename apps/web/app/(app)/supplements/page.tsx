'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '@/lib/api-client';
import { ClientSupplementsPanel } from '@/components/supplements/ClientSupplementsPanel';

function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

export default function SupplementsPage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (token) setClientId(decodeClientIdFromToken(token));
  }, []);

  return (
    <div>
      <h1>Suplementación</h1>
      {clientId && <ClientSupplementsPanel clientId={clientId} />}
    </div>
  );
}
