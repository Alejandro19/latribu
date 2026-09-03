'use client';

import useSWR from 'swr';
import Badge from '@/components/ui/Badge';
import { getInsights, type ModuleKey, type RuleResult, type InsightTipo, type FaseCicloResumen } from '@/lib/insights-client';

// MEV-05 — la fase de ciclo se muestra como nota informativa solo en estos 4
// módulos (nunca en Nutrición ni Punto Ciego), y nunca como alerta.
const FASE_MODULES: ModuleKey[] = ['cortisol', 'sueno', 'entrenamiento', 'miEvolucion'];

const BADGE_BY_TIPO: Partial<Record<InsightTipo, { label: string; variant: 'success' | 'warn' | 'danger' }>> = {
  optimizar: { label: 'Optimizar', variant: 'success' },
  vigilar: { label: 'Vigilar', variant: 'warn' },
  derivar_medico: { label: 'Derivar a médico', variant: 'danger' },
  // regla_sistema no lleva badge — es informativo puro (ej. SUE-09, MEV-01),
  // nunca una alerta ni una sugerencia accionable.
};

const PRIORITY: Record<InsightTipo, number> = { derivar_medico: 0, vigilar: 1, optimizar: 2, regla_sistema: 3 };

function sortByPriority(items: RuleResult[]): RuleResult[] {
  return [...items].sort((a, b) => PRIORITY[a.tipo] - PRIORITY[b.tipo]);
}

export function InsightsSection({ clientId, moduleKey }: { clientId: string; moduleKey: ModuleKey }) {
  // Esta sección es un complemento informativo sobre datos ya calculados —
  // si la carga falla (red, backend caído) simplemente no se muestra nada;
  // nunca debe romper ni ensuciar la pantalla del módulo que la contiene.
  const { data } = useSWR(['insights', clientId], () => getInsights(clientId));

  if (!data?.applicable) return null;

  if (data.excluded === 'embarazo_lactancia') {
    return (
      <div className="mb-5 border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
        <p className="m-0 font-body text-[13px]" style={{ color: 'var(--eph-body)' }}>{data.mensaje}</p>
      </div>
    );
  }

  const items = sortByPriority(data.modules[moduleKey]);
  const faseNote: FaseCicloResumen | null = FASE_MODULES.includes(moduleKey) ? data.fase : null;
  if (items.length === 0 && !faseNote) return null;

  return (
    <div className="mb-5 border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <p className="m-0 mb-3 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-accent)' }}>
        Insights de tu Premium
      </p>
      {faseNote && (
        <p className="m-0 mb-3 font-body text-[13px] italic" style={{ color: 'var(--eph-body)' }}>
          {faseNote.mensaje}{faseNote.confianza === 'estimado' ? ' (estimado)' : ''}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const badge = BADGE_BY_TIPO[item.tipo];
          return (
            <div key={item.id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {badge && <Badge label={badge.label} variant={badge.variant} />}
              </div>
              <p className="m-0 font-body text-[13px]" style={{ color: 'var(--eph-text)' }}>{item.mensaje}</p>
              {item.validoHastaProximoCheckpoint && (
                <p className="m-0 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-muted)' }}>Válido hasta tu próximo checkpoint.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
