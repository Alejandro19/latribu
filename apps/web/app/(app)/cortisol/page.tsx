'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ClientCortisolPanel } from '@/components/cortisol/ClientCortisolPanel';
import { AdminCortisolPanel } from '@/components/cortisol/AdminCortisolPanel';
import ClientSwitcher from '@/components/admin/ClientSwitcher';
import IdentityHeader from '@/components/ui/IdentityHeader';

export default function CortisolPage() {
  // AppShell ya bloquea el render de esta página hasta que useAuth() termina
  // de cargar (ver components/layout/AppShell.tsx) — leer directo de acá evita
  // el doble-render que causaba decodificar el JWT de nuevo en cada page.tsx.
  const { role, user, clientType, moduleAccess, planExpired } = useAuth();
  const clientId = user?.id ?? null;
  const [adminClientId, setAdminClientId] = useState<string | null>(null);

  if (role === 'admin') {
    return (
      <div>
        <IdentityHeader title="Stress" subtitle="Asigna técnicas de regulación y tips educativos por cliente." />
        <div
          style={{
            background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
            borderRadius: '0', padding: '22px 24px', marginBottom: 18,
          }}
        >
          <ClientSwitcher moduleKey="cortisol" selectedClientId={adminClientId} onSelect={setAdminClientId} />
        </div>
        {adminClientId ? (
          <AdminCortisolPanel clientId={adminClientId} />
        ) : (
          <p style={{ color: 'var(--eph-body)', fontSize: 13 }}>Selecciona un cliente para gestionar sus técnicas.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {clientId && (
        <ClientCortisolPanel clientId={clientId} clientType={clientType} moduleAccess={moduleAccess} planExpired={planExpired} />
      )}
    </div>
  );
}
