'use client';

import { PhrasesPanel } from '../../../components/admin/PhrasesPanel';
import { QuotesPanel } from '../../../components/admin/QuotesPanel';

export default function AdminPhrasesPage() {
  return (
    <div>
      <h1>Frases</h1>
      <QuotesPanel />
      <PhrasesPanel />
    </div>
  );
}
