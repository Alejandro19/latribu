'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ClientEvolutionPanel } from '@/components/evolution/ClientEvolutionPanel';
import { AdminEvolutionPanel } from '@/components/evolution/AdminEvolutionPanel';
import ClientSwitcher from '@/components/admin/ClientSwitcher';
import IdentityHeader from '@/components/ui/IdentityHeader';

export default function EvolutionPage() {
  // AppShell ya bloquea el render de esta página hasta que useAuth() termina
  // de cargar (ver components/layout/AppShell.tsx) — leer directo de acá evita
  // el doble-render que causaba decodificar el JWT de nuevo en cada page.tsx.
  const { role, user } = useAuth();
  const clientId = user?.id ?? null;
  const [adminClientId, setAdminClientId] = useState<string | null>(null);

  if (role === 'admin') {
    return (
      <div>
        <IdentityHeader title="Evolution" subtitle="Revisa el progreso e índice de rendimiento de cada cliente." />
        <div
          style={{
            background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
            borderRadius: 0, padding: '22px 24px', marginBottom: 18,
          }}
        >
          <ClientSwitcher moduleKey="evolution" selectedClientId={adminClientId} onSelect={setAdminClientId} />
        </div>
        {adminClientId ? (
          <AdminEvolutionPanel clientId={adminClientId} />
        ) : (
          <p className="font-body" style={{ color: 'var(--eph-body)', fontSize: 13 }}>Selecciona un cliente para ver su evolución.</p>
        )}
      </div>
    );
  }

  return <div>{clientId && <ClientEvolutionPanel clientId={clientId} />}</div>;
}
