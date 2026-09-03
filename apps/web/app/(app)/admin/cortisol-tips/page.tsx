'use client';

import { CortisolTipsPanel } from '../../../../components/cortisol/CortisolTipsPanel';
import IdentityHeader from '../../../../components/ui/IdentityHeader';

export default function AdminCortisolTipsPage() {
  return (
    <div>
      <IdentityHeader title="Tips de cortisol" subtitle="Banco global de tips educativos mostrados al azar en el módulo de Cortisol." />
      <div
        style={{
          background: 'var(--eph-surface)', border: '1px solid var(--eph-line)',
          borderRadius: '0', padding: '22px 24px',
        }}
      >
        <CortisolTipsPanel />
      </div>
    </div>
  );
}
