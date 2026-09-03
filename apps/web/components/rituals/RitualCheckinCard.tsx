'use client';

import type { ReactNode } from 'react';
import Badge from '@/components/ui/Badge';
import { IconLock } from '@/components/ui/icons';

// Componente base compartido de "Rituales" — generaliza el patrón de
// CheckpointCard (ClientLabCheckpoints.tsx): título + badge + formulario o
// resumen de solo lectura, agregándole reapertura para editar (Editar/
// Cancelar) y un estado "locked" (visible pero no interactuable hasta que
// se abra su ventana), que ese componente no tiene. Parametrizado por
// cadencia (diaria/semanal) en vez de duplicar esta lógica en cada Ritual.
// Mismo "shell" (border + p-6) que las cards de Workout (TrainingHome.tsx)
// para que ambos Rituales, en el grid de 2 columnas del Dashboard, se vean
// consistentes con el resto del sistema de diseño.
export type RitualCadence = 'daily' | 'weekly';

type RitualCheckinCardProps = {
  cadence: RitualCadence;
  title: string;
  completed: boolean;
  /** Visible siempre (nunca se oculta), pero sin formulario ni acción hasta que se abra su ventana — genera retentiva. */
  locked?: boolean;
  lockedMessage?: ReactNode;
  streakLabel?: string | null;
  summary?: ReactNode;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  saving?: boolean;
  children: ReactNode;
};

export function RitualCheckinCard({
  cadence,
  title,
  completed,
  locked,
  lockedMessage,
  streakLabel,
  summary,
  isEditing,
  onStartEdit,
  onCancelEdit,
  saving,
  children,
}: RitualCheckinCardProps) {
  const showForm = !locked && (!completed || isEditing);

  return (
    <div
      data-cadence={cadence}
      className="flex flex-col gap-4 rounded-none border p-6"
      style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-[15px]" style={{ color: 'var(--eph-text)' }}>{title}</span>
          {completed && !locked && <Badge label="Completado" variant="success" />}
        </div>
        {streakLabel && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-muted)' }}>
            {streakLabel}
          </span>
        )}
      </div>

      {locked && (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: 'var(--eph-steel)', color: 'var(--eph-steel)' }}>
            <IconLock size={15} />
          </div>
          <div className="flex-1 font-body text-xs" style={{ color: 'var(--eph-muted)' }}>{lockedMessage}</div>
        </div>
      )}

      {!locked && completed && !isEditing && (
        <div className="flex flex-col gap-3">
          {summary}
          <button
            type="button"
            onClick={onStartEdit}
            className="self-start font-mono text-[10px] uppercase tracking-[0.1em] underline-offset-2 hover:underline"
            style={{ color: 'var(--eph-accent)' }}
          >
            Editar
          </button>
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-4">
          {children}
          {completed && isEditing && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className="self-start font-mono text-[10px] uppercase tracking-[0.1em] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: 'var(--eph-muted)' }}
            >
              Cancelar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default RitualCheckinCard;
