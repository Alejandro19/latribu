'use client';

import { useEffect, useState } from 'react';
import { getSessionToken } from '@/lib/api-client';
import { ClientNutritionPanel } from '@/components/nutrition/ClientNutritionPanel';
import { AdminNutritionPanel } from '@/components/nutrition/AdminNutritionPanel';
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

export default function NutritionPage() {
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
        <IdentityHeader title="Nutrición" subtitle="Arma el plan de alimentación y suplementación de cada cliente." />
        <div
          style={{
            background: 'var(--paper)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', padding: '22px 24px', marginBottom: 18,
          }}
        >
          <ClientSwitcher moduleKey="nutrition" selectedClientId={adminClientId} onSelect={setAdminClientId} />
        </div>
        {adminClientId ? (
          <AdminNutritionPanel clientId={adminClientId} />
        ) : (
          <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Selecciona un cliente para gestionar su plan de nutrición.</p>
        )}
      </div>
    );
  }

  return <div>{clientId && <ClientNutritionPanel clientId={clientId} />}</div>;
}
