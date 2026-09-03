'use client';

import { useAuth } from '@/lib/auth-context';
import { ClientCommunityPanel } from '@/components/community/ClientCommunityPanel';
import { AdminCommunityPanel } from '@/components/community/AdminCommunityPanel';
import IdentityHeader from '@/components/ui/IdentityHeader';

export default function CommunityPage() {
  // AppShell ya bloquea el render de esta página hasta que useAuth() termina
  // de cargar (ver components/layout/AppShell.tsx) — leer directo de acá evita
  // el doble-render que causaba decodificar el JWT de nuevo en cada page.tsx.
  const { role, user } = useAuth();
  const clientId = user?.id ?? null;

  if (role === 'admin') {
    return (
      <div>
        <IdentityHeader title="The Circle" subtitle="Publica eventos y terapias, y revisa quién ha reservado." />
        <AdminCommunityPanel />
      </div>
    );
  }

  return <div>{clientId && <ClientCommunityPanel clientId={clientId} />}</div>;
}
