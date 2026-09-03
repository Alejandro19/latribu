'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ClientNutritionPanel } from '@/components/nutrition/ClientNutritionPanel';
import { AdminNutritionPanel } from '@/components/nutrition/AdminNutritionPanel';
import ClientSwitcher from '@/components/admin/ClientSwitcher';
import IdentityHeader from '@/components/ui/IdentityHeader';

export default function NutritionPage() {
  // AppShell ya bloquea el render de esta página hasta que useAuth() termina
  // de cargar (ver components/layout/AppShell.tsx) — leer directo de acá evita
  // el doble-render que causaba decodificar el JWT de nuevo en cada page.tsx.
  const { role, user, clientType } = useAuth();
  const clientId = user?.id ?? null;
  const [adminClientId, setAdminClientId] = useState<string | null>(null);

  if (role === 'admin') {
    return (
      <div>
        <IdentityHeader title="Nutrition" subtitle="Arma el plan de alimentación y suplementación de cada cliente." />
        <div style={{ marginBottom: 18 }}>
          <Link
            href="/admin/nutrition-tips"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--eph-accent)', textDecoration: 'none' }}
          >
            Gestionar tips de nutrición →
          </Link>
        </div>
        <div
          style={{
            background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
            borderRadius: '0', padding: '22px 24px', marginBottom: 18,
          }}
        >
          <ClientSwitcher moduleKey="nutrition" selectedClientId={adminClientId} onSelect={setAdminClientId} />
        </div>
        {adminClientId ? (
          <AdminNutritionPanel clientId={adminClientId} />
        ) : (
          <p style={{ color: 'var(--eph-body)', fontSize: 13 }}>Selecciona un cliente para gestionar su plan de nutrición.</p>
        )}
      </div>
    );
  }

  return <div>{clientId && <ClientNutritionPanel clientId={clientId} clientType={clientType} />}</div>;
}
