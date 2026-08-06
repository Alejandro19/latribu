'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '@/lib/api-client';
import { ClientCommunityPanel } from '@/components/community/ClientCommunityPanel';
import { AdminCommunityPanel } from '@/components/community/AdminCommunityPanel';
import IdentityHeader from '@/components/ui/IdentityHeader';

function decodeClientIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.id === 'string' ? payload.id : null;
  } catch {
    return null;
  }
}

function decodeRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export default function CommunityPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    if (token) {
      setClientId(decodeClientIdFromToken(token));
      setRole(decodeRoleFromToken(token));
    }
  }, []);

  if (role === 'admin') {
    return (
      <div>
        <IdentityHeader title="Comunidad" subtitle="Publica eventos y terapias, y revisa quién ha reservado." />
        <AdminCommunityPanel />
      </div>
    );
  }

  return <div>{clientId && <ClientCommunityPanel clientId={clientId} />}</div>;
}
