'use client';

import { RestToolsAdminPanel } from '../../../../components/rest/RestToolsAdminPanel';
import IdentityHeader from '../../../../components/ui/IdentityHeader';

export default function AdminRestToolsPage() {
  return (
    <div>
      <IdentityHeader title="Herramientas para dormir" subtitle="Banco global de herramientas disponible para todos los clientes." />
      <RestToolsAdminPanel />
    </div>
  );
}
