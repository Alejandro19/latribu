'use client';

import Link from 'next/link';
import EmptyState from '@/components/ui/EmptyState';
import type { MorningCheckin } from '@/lib/cortisol-client';
import type { ModuleAccessState } from '@/lib/module-access';

// Reemplaza al viejo formulario de check-in matutino (MorningCheckinPrompt):
// el envío ahora vive únicamente en el Ritual Diario del Dashboard (exclusivo
// Mentoría) — Stress solo muestra un resumen de solo lectura de lo ya
// respondido, nunca un formulario que podría no funcionar para este cliente.
export function MorningCheckinSummary({
  morningCheckin,
  clientType,
  cortisolAccessState,
}: {
  morningCheckin: MorningCheckin;
  clientType?: string | null;
  cortisolAccessState: ModuleAccessState;
}) {
  const eligible = clientType === 'mentoring' && cortisolAccessState === 'ok';

  if (!eligible) {
    return (
      <div className="mb-5">
        <EmptyState message="El check-in matutino es parte del Ritual Diario, disponible para clientes Premium con Stress incluido." />
      </div>
    );
  }

  if (!morningCheckin) {
    return (
      <div className="mb-5 flex flex-col gap-2">
        <EmptyState message="Aún no respondiste tu check-in matutino de hoy." />
        <Link href="/" className="self-start font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-accent)' }}>
          Responder en tu Ritual Diario →
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-5 border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--eph-muted)' }}>
        Check-in matutino de hoy
      </p>
      <p className="font-body text-sm" style={{ color: 'var(--eph-body)' }}>
        Energía {morningCheckin.energia}/5 · Tensión {morningCheckin.tension}/5 · Claridad {morningCheckin.claridad}/5
      </p>
    </div>
  );
}

export default MorningCheckinSummary;
