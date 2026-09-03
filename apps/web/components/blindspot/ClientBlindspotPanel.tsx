'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  clientGetMyCase,
  clientCompleteTask,
  clientRequestHelp,
  type BlindspotSessionLog,
  type BlindspotCaseStatus,
} from '@/lib/blindspot-client';
import { PermissionDeniedError } from '@/lib/api-client';
import LockedOverlay from '@/components/ui/LockedOverlay';
import LockedBenefit from '@/components/ui/LockedBenefit';
import Button from '@/components/ui/Button';
import { InsightsSection } from '@/components/insights/InsightsSection';

const STATUS_LABEL: Record<BlindspotCaseStatus, string> = {
  evaluando: 'En evaluación con Alejandro',
  referido: 'Referido a tu terapeuta',
  en_proceso: 'En proceso',
  cerrado: 'Proceso cerrado',
};

const PROGRESS_LABEL: Record<BlindspotSessionLog['progressMarker'], string> = {
  avance: 'Avance',
  estable: 'Estable',
  retroceso: 'Retroceso',
  cerrado: 'Cerrado',
};

export function ClientBlindspotPanel({ clientType, clientId }: { clientType: string | null; clientId: string }) {
  if (clientType !== 'mentoring') {
    // Nunca montar <BlindspotBody/> acá: es un componente vivo que hace su
    // propio fetch, recibiría su propio 403, y renderizaría su propio
    // candado por debajo del de acá — un candado fantasma duplicado. Sin
    // `children`, LockedBenefit usa su placeholder estático por defecto.
    return (
      <LockedBenefit
        benefit="tu auditoría de punto ciego con un terapeuta especializado"
      />
    );
  }
  return <BlindspotBody clientId={clientId} />;
}

function BlindspotBody({ clientId }: { clientId: string }) {
  const { data, error: fetchError, isLoading, mutate } = useSWR('blindspot-my-case', clientGetMyCase);
  const [actionError, setActionError] = useState<string | null>(null);
  const [helpSent, setHelpSent] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);

  async function handleCompleteTask(taskId: string) {
    try {
      await clientCompleteTask(taskId);
      await mutate();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al actualizar la tarea.');
    }
  }

  async function handleHelp() {
    setHelpLoading(true);
    try {
      await clientRequestHelp();
      setHelpSent(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al enviar la solicitud.');
    } finally {
      setHelpLoading(false);
    }
  }

  if (isLoading) {
    return <p className="text-[13px] text-[var(--eph-muted)]">Cargando...</p>;
  }

  if (fetchError && fetchError instanceof PermissionDeniedError) {
    return (
      <LockedOverlay title="Módulo no disponible" subtitle="Este módulo ya no está disponible para tu tipo de cuenta.">
        <div style={{ minHeight: 200 }} />
      </LockedOverlay>
    );
  }

  const error = actionError || (fetchError ? (fetchError instanceof Error ? fetchError.message : 'Error al cargar tu Punto Ciego.') : null);
  if (error) {
    return <p className="font-body text-[13px]" style={{ color: 'var(--eph-danger)' }}>{error}</p>;
  }

  const caseData = data?.case ?? null;
  const tasks = data?.tasks ?? [];
  const sessionLogs = data?.sessionLogs ?? [];

  if (!caseData) {
    return (
      <div>
        <InsightsSection clientId={clientId} moduleKey="puntoCiego" />
        <section className="border p-6" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
          <h2 className="mb-2 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Punto Ciego</h2>
          <p className="font-body text-[13px]" style={{ color: 'var(--eph-muted)' }}>
            Alejandro aún no ha iniciado tu evaluación en este módulo. Cuando la agenden contigo, aparecerá aquí.
          </p>
        </section>
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === 'pendiente');
  const doneTasks = tasks.filter((t) => t.status !== 'pendiente');

  return (
    <div>
      <InsightsSection clientId={clientId} moduleKey="puntoCiego" />
      <section className="border p-6" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-steel)' }}>Punto Ciego · Caso #{caseData.caseNumber}</p>
        <h2 className="mb-2 font-display text-lg" style={{ color: 'var(--eph-text)' }}>{STATUS_LABEL[caseData.status]}</h2>
        {caseData.therapistName && (
          <p className="font-body text-[13px]" style={{ color: 'var(--eph-muted)' }}>
            Terapeuta asignado: <span className="font-medium" style={{ color: 'var(--eph-text)' }}>{caseData.therapistName}</span>
          </p>
        )}
      </section>

      {tasks.length > 0 && (
        <section className="border-t py-6" style={{ borderColor: 'var(--eph-line)' }}>
          <h3 className="mb-3.5 font-display text-base" style={{ color: 'var(--eph-text)' }}>Tus tareas</h3>
          <ul className="flex flex-col gap-2">
            {pendingTasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 border p-3.5" style={{ borderColor: 'var(--eph-line)' }}>
                <div>
                  <p className="font-body text-[13.5px] font-medium" style={{ color: 'var(--eph-text)' }}>{task.title}</p>
                  {task.description && <p className="mt-1 font-body text-[12px]" style={{ color: 'var(--eph-muted)' }}>{task.description}</p>}
                  {task.dueDate && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-muted)' }}>Antes de: {task.dueDate}</p>}
                </div>
                <Button type="button" variant="secondary" onClick={() => handleCompleteTask(task.id)} className="shrink-0">
                  Marcar hecha
                </Button>
              </li>
            ))}
            {doneTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 border p-3.5 opacity-60" style={{ borderColor: 'var(--eph-line)' }}>
                <p className="font-body text-[13.5px] font-medium line-through" style={{ color: 'var(--eph-text)' }}>{task.title}</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-muted)' }}>{task.status === 'completada' ? 'Completada' : 'Omitida'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sessionLogs.length > 0 && (
        <section className="border-t py-6" style={{ borderColor: 'var(--eph-line)' }}>
          <h3 className="mb-3.5 font-display text-base" style={{ color: 'var(--eph-text)' }}>Tu avance</h3>
          <ul className="flex flex-col gap-3">
            {sessionLogs.map((log) => (
              <li key={log.id} className="border-l-2 pl-3.5" style={{ borderColor: 'var(--eph-line)' }}>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>
                  {log.sessionDate} · {PROGRESS_LABEL[log.progressMarker]}
                </p>
                {log.clientNote && <p className="mt-1 font-body text-[13px]" style={{ color: 'var(--eph-text)' }}>{log.clientNote}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t py-6" style={{ borderColor: 'var(--eph-line)' }}>
        {helpSent ? (
          <p className="font-body text-[13px]" style={{ color: 'var(--eph-muted)' }}>Le avisamos a Alejandro. Te contactará lo antes posible.</p>
        ) : (
          <>
            <p className="mb-2 font-body text-[13px]" style={{ color: 'var(--eph-muted)' }}>¿Necesitas ayuda urgente?</p>
            <Button type="button" variant="secondary" onClick={handleHelp} disabled={helpLoading}>
              {helpLoading ? 'Enviando...' : 'Avisar a Alejandro ahora'}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
