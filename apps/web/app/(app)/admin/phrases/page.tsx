'use client';

import { PhrasesPanel } from '@/components/admin/PhrasesPanel';
import { QuotesPanel } from '@/components/admin/QuotesPanel';
import IdentityHeader from '@/components/ui/IdentityHeader';

export default function AdminPhrasesPage() {
  return (
    <div>
      <IdentityHeader title="Frases" subtitle="Frases de mentalidad y tarjetas para redes sociales." />
      <QuotesPanel />
      <PhrasesPanel />
    </div>
  );
}
