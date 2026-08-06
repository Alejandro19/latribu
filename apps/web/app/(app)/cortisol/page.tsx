'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '@/lib/api-client';
import { ClientCortisolPanel } from '@/components/cortisol/ClientCortisolPanel';
import { AdminCortisolPanel } from '@/components/cortisol/AdminCortisolPanel';
import ClientSwitcher from '@/components/admin/ClientSwitcher';
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

export default function CortisolPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [adminClientId, setAdminClientId] = useState<string | null>(null);

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
        <IdentityHeader title="Gestión de Cortisol" subtitle="Asigna técnicas de regulación y tips educativos por cliente." />
        <div
          style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 18,
          }}
        >
          <ClientSwitcher moduleKey="cortisol" selectedClientId={adminClientId} onSelect={setAdminClientId} />
        </div>
        {adminClientId ? (
          <AdminCortisolPanel clientId={adminClientId} />
        ) : (
          <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Selecciona un cliente para gestionar sus técnicas.</p>
        )}
      </div>
    );
  }

  return <div>{clientId && <ClientCortisolPanel clientId={clientId} />}</div>;
}
