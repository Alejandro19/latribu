'use client';

import MetricValue from '../ui/MetricValue';
import type { CognitiveLoadOverview } from '../../lib/cortisol-client';

function TrendStat({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--eph-steel)' }}>{label}</span>
      <MetricValue value={value != null ? value.toFixed(1) : '—'} unit={value != null ? unit : undefined} size="secondary" />
    </div>
  );
}

// Carga Cognitiva + Tendencia 14 días (Stress, Prompt 02 §5 parte 2). El
// umbral y la racha ya vienen calculados por el backend (cognitive-load.service.ts)
// a partir del historial real — acá solo se presentan.
export function CognitiveLoadSection({ overview }: { overview: CognitiveLoadOverview }) {
  return (
    <>
      <div
        className="mb-5 text-center"
        style={{ border: '1px solid var(--eph-accent-edge)', background: 'var(--eph-panel)', padding: 'clamp(28px, 3.4vw, 44px)', display: 'grid', gap: 12 }}
      >
        <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--eph-muted)' }}>
          Carga cognitiva
        </span>
        {overview.today != null ? (
          <span style={{ display: 'flex', justifyContent: 'center' }}>
            <MetricValue value={overview.today.toFixed(1)} size="hero" />
          </span>
        ) : (
          <p className="font-body text-sm" style={{ color: 'var(--eph-muted)' }}>Aún no hay suficientes datos de hoy para calcular tu carga cognitiva.</p>
        )}
        {overview.threshold == null ? (
          <p className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--eph-muted)' }}>
            Necesitas más días de datos para calibrar tu umbral.
          </p>
        ) : overview.alert ? (
          <p className="font-body text-sm" style={{ color: 'var(--eph-danger)' }}>
            Por encima de tu umbral sostenible tres días consecutivos. Recorta una reunión de decisión hoy.
          </p>
        ) : null}
      </div>

      <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <h2 className="mb-4 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Tendencia 14 días</h2>
        <div
          aria-hidden
          style={{ background: 'var(--eph-hatch)', border: '1px solid var(--eph-line)', aspectRatio: '16 / 7', marginBottom: 20 }}
        />
        <div className="grid grid-cols-3 gap-4">
          <TrendStat label="HRV" value={overview.latest.hrv} unit="MS" />
          <TrendStat label="Activación matutina (autorreporte)" value={overview.latest.activacionMatutina} />
          <TrendStat label="Recuperación" value={overview.latest.recuperacionPct} unit="%" />
        </div>
      </section>
    </>
  );
}
