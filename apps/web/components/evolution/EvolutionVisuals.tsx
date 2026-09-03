'use client';

import type { AnthropometricRecord, InbodyRecord } from '../../lib/evolution-client';
import { getKpiStatus, comparisonLabelByCadence, type KpiStatus } from '../../lib/evolution-logic';
import EmptyState from '../ui/EmptyState';
import RingProgress from '../ui/RingProgress';
import MetricValue from '../ui/MetricValue';

// ─── Índice de bienestar general ─────────────────────────────────

export function WellnessIndexHero({ index }: { index: number | null }) {
  return (
    <div
      className="mt-8 mb-5 flex items-center gap-5 border p-6"
      style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)', color: 'var(--eph-text)' }}
    >
      <RingProgress value={index ?? 0} size={88} strokeWidth={2}>
        <div className="flex flex-col items-center justify-center">
          <MetricValue value={index != null ? index : '—'} size="index" />
          <span className="font-mono text-[9px]" style={{ color: 'var(--eph-muted)' }}>/ 100</span>
        </div>
      </RingProgress>
      <div>
        <p className="mb-1 font-display text-base font-normal">Índice de rendimiento</p>
        <p className="font-body text-[11.5px] leading-relaxed" style={{ color: 'var(--eph-muted)' }}>
          Promedio ponderado de tus módulos activos (entrenamiento, sueño, cortisol y tu evolución física). Los
          componentes sin datos aún se excluyen del cálculo, en vez de contar como cero.
        </p>
      </div>
    </div>
  );
}

// ─── Chip de tendencia (reutilizado por Bienestar general y KPIs) ─
// Paleta reducida a los tokens Ephirox: bronce = mejora, un tono cálido
// derivado del danger = revisar, gris tenue = sin cambios.

const TREND_STYLES: Record<KpiStatus, { color: string; text: string }> = {
  good: { color: 'var(--eph-accent)', text: 'Mejorando' },
  watch: { color: 'color-mix(in srgb, var(--eph-danger) 50%, var(--eph-accent) 50%)', text: 'Revisar' },
  neutral: { color: 'var(--eph-faint)', text: 'Sin cambios' },
};

export function TrendChip({
  delta,
  unit,
  status,
  comparisonLabel,
}: {
  delta: number | null;
  unit: string;
  status: KpiStatus | null;
  comparisonLabel: string;
}) {
  if (delta == null || status == null) {
    return <p className="mt-1.5 font-body text-[10.5px] italic" style={{ color: 'var(--eph-muted)' }}>Primera medición</p>;
  }
  const styles = TREND_STYLES[status];
  const arrow = status === 'neutral' && delta === 0 ? '→' : delta > 0 ? '↑' : '↓';
  return (
    <>
      <span
        className="mt-1.5 inline-flex items-center gap-1 rounded-[999px] border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em]"
        style={{ borderColor: styles.color, color: styles.color }}
      >
        {arrow} {styles.text}
      </span>
      <p className="mt-1 font-mono text-[10px]" style={{ color: 'var(--eph-muted)' }}>
        {delta > 0 ? '+' : ''}
        {delta.toFixed(1)}
        {unit} {comparisonLabel}
      </p>
    </>
  );
}

// ─── Bienestar general (Descanso + Cortisol, siempre visibles) ────

export function BienestarGeneral({
  sleepAvg,
  weeklyRegulation,
  sleepDelta,
  sleepStatus,
  cortisolDelta,
  cortisolStatus,
}: {
  sleepAvg: string | null;
  weeklyRegulation: number | null;
  sleepDelta: number | null;
  sleepStatus: KpiStatus | null;
  cortisolDelta: number | null;
  cortisolStatus: KpiStatus | null;
}) {
  return (
    <div className="mb-5 border p-6" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <p className="mb-0.5 font-display text-base font-normal" style={{ color: 'var(--eph-text)' }}>Panorama general</p>
      <p className="mb-3.5 font-body text-[11px]" style={{ color: 'var(--eph-muted)' }}>Un resumen rápido — el detalle completo vive en sus propios módulos.</p>
      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[150px] flex-1 border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--eph-steel)' }} />
            Sleep
          </p>
          <MetricValue value={sleepAvg ?? '—'} size="secondary" />
          <p className="mt-0.5 font-body text-[10.5px]" style={{ color: 'var(--eph-muted)' }}>Calidad de sueño promedio</p>
          <TrendChip delta={sleepDelta} unit="" status={sleepStatus} comparisonLabel="vs mes pasado" />
        </div>
        <div className="min-w-[150px] flex-1 border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--eph-accent)' }} />
            Stress
          </p>
          <MetricValue value={weeklyRegulation ?? '—'} size="secondary" />
          <p className="mt-0.5 font-body text-[10.5px]" style={{ color: 'var(--eph-muted)' }}>Momentos de regulación esta semana</p>
          <TrendChip delta={cortisolDelta} unit="" status={cortisolStatus} comparisonLabel="vs mes pasado" />
        </div>
      </div>
    </div>
  );
}

// ─── KPIs principales (peso, grasa corporal, masa muscular) ───────

type KpiMetrica = 'peso' | 'grasa_corporal' | 'masa_muscular';

const KPI_ICON_PATHS: Record<KpiMetrica, string> = {
  peso: 'M15 4v22M15 4l-8 4M15 4l8 4M4 22h8M18 22h8M7 8l-4 9a4 4 0 0 0 8 0zM23 8l-4 9a4 4 0 0 0 8 0z',
  grasa_corporal: 'M4 23l8-8 5 5 9-12M19 8h7v7',
  masa_muscular:
    'M9 21c-1-6 1-10 5-12 3-1.5 6-1 7 1 1 2-1 3.5-3 3.5h-1.5c2 1 2.5 3 1.5 5-1.5 3-5.5 3.5-8.5 2.5-2-.7-2.5-.2-2.5 2v1H5v-3c0-1.5 1-2 2-2z',
};

const KPI_COLORS: Record<KpiMetrica, string> = { peso: 'var(--eph-accent)', grasa_corporal: 'var(--eph-steel)', masa_muscular: 'var(--eph-muted)' };

function KpiIcon({ metrica }: { metrica: KpiMetrica }) {
  const color = KPI_COLORS[metrica];
  return (
    <div
      className="mx-auto mb-2.5 flex h-[52px] w-[52px] items-center justify-center rounded-full border-2"
      style={{ borderColor: color, color }}
    >
      <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
        <path d={KPI_ICON_PATHS[metrica]} stroke="currentColor" strokeWidth={metrica === 'masa_muscular' ? 1.6 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function EvolutionKpiCard({
  label,
  value,
  unit,
  delta,
  metrica,
  objetivos,
  comparisonLabel,
}: {
  label: string;
  value: number | string | null;
  unit: string;
  delta: number | null;
  metrica: KpiMetrica;
  objetivos: Record<string, string> | undefined;
  comparisonLabel: string;
}) {
  const status = getKpiStatus(delta, metrica, objetivos);
  return (
    <div className="border p-4 text-center" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
      <KpiIcon metrica={metrica} />
      <MetricValue value={value ?? '—'} unit={value != null ? unit.toUpperCase() : undefined} size="secondary" />
      <p className="my-1 font-mono text-[9.5px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>{label}</p>
      <TrendChip delta={delta} unit={unit} status={status} comparisonLabel={comparisonLabel} />
    </div>
  );
}

// ─── Adherencia de entrenamiento ───────────────────────────────────

// Reutiliza el mismo dato que ya alimenta el 40% del índice de bienestar
// general — expuesto también como su propia tarjeta para que el cliente vea
// de dónde sale ese componente. Más adherencia siempre es mejor, sin
// objetivo configurable.
export function AdherenciaKpiCard({
  doneDays,
  expected,
  streakWeeks,
}: {
  doneDays: number;
  expected: number;
  streakWeeks: number | null;
}) {
  const hasSessions = expected > 0;
  const pct = hasSessions ? Math.max(0, Math.min(100, Math.round((doneDays / expected) * 100))) : 0;

  return (
    <div className="mb-5 flex items-center gap-4 border p-6" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <RingProgress value={hasSessions ? pct : 0} size={64} strokeWidth={2}>
        <div className="flex flex-col items-center justify-center">
          <MetricValue value={hasSessions ? pct : '—'} unit={hasSessions ? '%' : undefined} size="secondary" />
          <span className="font-mono text-[7px]" style={{ color: 'var(--eph-muted)' }}>ESTE MES</span>
        </div>
      </RingProgress>
      <div>
        <p className="mb-1 font-display text-[16px] font-normal" style={{ color: 'var(--eph-text)' }}>Adherencia de entrenamiento</p>
        <p className="font-body text-[11px]" style={{ color: 'var(--eph-muted)' }}>
          {hasSessions
            ? `${doneDays} de ${expected} sesiones programadas completadas este mes${
                streakWeeks != null ? ` · racha actual: ${streakWeeks} semana${streakWeeks === 1 ? '' : 's'}` : ''
              }`
            : 'Aún no hay sesiones programadas este mes'}
        </p>
      </div>
    </div>
  );
}

// ─── Medidas corporales ────────────────────────────────────────────

export function MedidaTile({ label, value, firstValue }: { label: string; value: number | null; firstValue: number | null }) {
  const delta = value != null && firstValue != null ? Number(value) - Number(firstValue) : null;
  return (
    <div className="border p-3 text-center" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
      <MetricValue value={value ?? '—'} size="secondary" />
      <p className="my-0.5 font-mono text-[9px] uppercase tracking-[0.06em]" style={{ color: 'var(--eph-muted)' }}>{label}</p>
      {delta != null && (
        <span className="font-mono text-[10px]" style={{ color: 'var(--eph-muted)' }}>
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// ─── Composición corporal (dona) ───────────────────────────────────

export function CompositionDonut({
  pesoTotal,
  smm,
  grasaPct,
}: {
  pesoTotal: number | null;
  smm: number | null;
  grasaPct: number | null;
}) {
  if (pesoTotal == null) return <EmptyState message="Aún no hay datos de composición corporal." />;

  const peso = Number(pesoTotal);
  const grasaKg = grasaPct != null ? (peso * Number(grasaPct)) / 100 : 0;
  const muscularKg = smm != null ? Number(smm) : 0;
  const magraKg = Math.max(0, peso - grasaKg - muscularKg);
  const segments = [
    { label: 'Masa magra (estimada)', kg: magraKg, unit: '%', color: 'var(--eph-muted)' },
    { label: 'Masa muscular', kg: muscularKg, unit: 'kg', color: 'var(--eph-steel)' },
    { label: 'Grasa corporal', kg: grasaKg, unit: '%', color: 'var(--eph-accent)' },
  ];
  const size = 120;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {segments.map((s) => {
            const frac = peso > 0 ? s.kg / peso : 0;
            const dash = frac * circ;
            const arc = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
                strokeDashoffset={(-offset).toFixed(1)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += dash;
            return arc;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <MetricValue value={peso} unit="KG" size="secondary" />
          <span className="text-[8px] uppercase text-[var(--eph-muted)]">Total</span>
        </div>
      </div>
      <div className="min-w-[180px] flex-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between py-1 text-xs">
            <span className="flex items-center gap-1.5 text-[var(--eph-text)]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <strong className="text-[var(--eph-text)]">
              {s.unit === 'kg' ? `${s.kg.toFixed(1)}kg` : `${peso > 0 ? ((s.kg / peso) * 100).toFixed(1) : '0.0'}%`}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Evolución en el tiempo (gráfica de líneas) ────────────────────

export type EvolutionSeries = { name: string; color: string; unit: string; points: Array<{ month: number; value: number }> };

export function EvolutionLineChart({ series }: { series: EvolutionSeries[] }) {
  const allMonths = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.month))))
    .sort((a, b) => a - b)
    .slice(-6);

  if (!allMonths.length) return <EmptyState message="Sin datos suficientes." />;

  const w = 320;
  const h = 150;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 20;
  const xStep = allMonths.length > 1 ? (w - padL - padR) / (allMonths.length - 1) : 0;
  const xFor = (month: number) => padL + xStep * allMonths.indexOf(month);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ overflow: 'visible' }}>
        {series.map((s) => {
          const pts = allMonths.map((m) => s.points.find((p) => p.month === m)).filter((p): p is { month: number; value: number } => !!p);
          if (!pts.length) return null;
          const values = pts.map((p) => p.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          const yFor = (v: number) => h - padB - ((v - min) / range) * (h - padT - padB);
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.month).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(' ');
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p) => (
                <circle key={p.month} cx={xFor(p.month).toFixed(1)} cy={yFor(p.value).toFixed(1)} r={3} fill={s.color} />
              ))}
            </g>
          );
        })}
        {allMonths.map((m) => (
          <text key={m} x={xFor(m).toFixed(1)} y={h - 4} fontSize={8} textAnchor="middle" fill="var(--eph-muted)">
            M{m}
          </text>
        ))}
      </svg>
      <div className="mt-2.5 flex flex-wrap gap-4">
        {series.map((s) => {
          const pts = allMonths.map((m) => s.points.find((p) => p.month === m)).filter(Boolean);
          const latest = pts.length ? pts[pts.length - 1]!.value : null;
          return (
            <div key={s.name} className="flex items-center gap-1.5 text-[11px] text-[var(--eph-muted)]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}: <strong className="text-[var(--eph-text)]">{latest != null ? `${latest}${s.unit}` : '—'}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── "Tu evolución física" — sección completa ──────────────────────

export function EvolucionFisicaSection({
  anthropometrics,
  inbody,
  objetivos,
  inbodyCadenceType,
  disciplineStats,
  streakWeeks,
}: {
  anthropometrics: AnthropometricRecord[];
  inbody: InbodyRecord[];
  objetivos: Record<string, string> | undefined;
  inbodyCadenceType: string | undefined;
  disciplineStats: { doneDays: number; expected: number } | null;
  streakWeeks: number | null;
}) {
  const firstAnthro = anthropometrics[0] ?? null;
  const lastAnthro = anthropometrics[anthropometrics.length - 1] ?? null;
  const lastInbody = inbody[inbody.length - 1] ?? null;
  const prevInbody = inbody.length >= 2 ? inbody[inbody.length - 2] : null;
  const prevAnthro = anthropometrics.length >= 2 ? anthropometrics[anthropometrics.length - 2] : null;

  const pesoVal = lastInbody?.pesoTotal ?? lastAnthro?.peso ?? null;
  // La comparación es siempre contra la medición INMEDIATAMENTE anterior
  // (mes pasado / hace 2 meses / medición anterior, según cadencia) — nunca
  // contra la primera medición histórica.
  const pesoPrev = lastInbody?.pesoTotal != null ? prevInbody?.pesoTotal ?? null : prevAnthro?.peso ?? null;
  const pesoDelta = pesoVal != null && pesoPrev != null ? Number(pesoVal) - Number(pesoPrev) : null;
  const grasaDelta =
    lastInbody?.grasaPct != null && prevInbody?.grasaPct != null ? Number(lastInbody.grasaPct) - Number(prevInbody.grasaPct) : null;
  const smmDelta = lastInbody?.smm != null && prevInbody?.smm != null ? Number(lastInbody.smm) - Number(prevInbody.smm) : null;

  const lastMeasurementDate = [lastAnthro?.fecha, lastInbody?.fecha].filter(Boolean).sort().pop() as string | undefined;
  const comparisonLabel = comparisonLabelByCadence[inbodyCadenceType || 'mensual'];
  const hasEnoughForChart = inbody.length >= 2;

  return (
    <>
      <div className="mb-5 rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
        <p className="font-display text-base font-normal text-[var(--eph-text)]">Tu evolución física</p>
        <p className="mb-4 mt-6 font-display text-[16px] font-normal text-[var(--eph-text)]">KPIs principales</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <EvolutionKpiCard label="Peso" value={pesoVal} unit=" kg" delta={pesoDelta} metrica="peso" objetivos={objetivos} comparisonLabel={comparisonLabel} />
          <EvolutionKpiCard label="Grasa corporal" value={lastInbody?.grasaPct ?? null} unit="%" delta={grasaDelta} metrica="grasa_corporal" objetivos={objetivos} comparisonLabel={comparisonLabel} />
          <EvolutionKpiCard label="Masa muscular" value={lastInbody?.smm ?? null} unit=" kg" delta={smmDelta} metrica="masa_muscular" objetivos={objetivos} comparisonLabel={comparisonLabel} />
        </div>
        <p className="mt-3 text-center text-[10.5px] text-[var(--eph-muted)]">
          {lastMeasurementDate ? `Última medición: ${lastMeasurementDate}` : 'Sin mediciones aún'}
        </p>
      </div>
      <AdherenciaKpiCard doneDays={disciplineStats?.doneDays ?? 0} expected={disciplineStats?.expected ?? 0} streakWeeks={streakWeeks} />
      <div className="mb-5 rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
        <p className="mb-4 font-display text-[16px] font-normal text-[var(--eph-text)]">Composición corporal</p>
        <CompositionDonut pesoTotal={lastInbody?.pesoTotal ?? lastAnthro?.peso ?? null} smm={lastInbody?.smm ?? null} grasaPct={lastInbody?.grasaPct ?? null} />
      </div>
      <div className="mb-5 rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
        <p className="mb-1 font-display text-[16px] font-normal text-[var(--eph-text)]">Evolución en el tiempo</p>
        <p className="mb-3 text-[11px] text-[var(--eph-muted)]">Una gráfica por métrica, con fechas reales — aparece con tu segunda medición.</p>
        {hasEnoughForChart ? (
          <EvolutionLineChart
            series={[
              { name: 'Peso', color: 'var(--eph-muted)', unit: ' kg', points: inbody.filter((r) => r.mesNum != null && r.pesoTotal != null).map((r) => ({ month: r.mesNum!, value: Number(r.pesoTotal) })) },
              { name: 'Grasa', color: 'var(--eph-accent)', unit: '%', points: inbody.filter((r) => r.mesNum != null && r.grasaPct != null).map((r) => ({ month: r.mesNum!, value: Number(r.grasaPct) })) },
              { name: 'Masa muscular', color: 'var(--eph-steel)', unit: ' kg', points: inbody.filter((r) => r.mesNum != null && r.smm != null).map((r) => ({ month: r.mesNum!, value: Number(r.smm) })) },
            ]}
          />
        ) : (
          <div className="px-2.5 py-5 text-center">
            <p className="mb-2 font-display text-[16px] font-normal text-[var(--eph-text)]">Necesitas al menos 2 mediciones para ver tu evolución</p>
            <p className="mx-auto max-w-[320px] text-xs text-[var(--eph-muted)]">
              Tu mentor registrará tu próxima medición en tu siguiente sesión de seguimiento — ahí empezará a aparecer tu gráfica de tendencia.
            </p>
          </div>
        )}
      </div>
      <div className="mb-5 rounded-[0] border border-[var(--eph-line)] bg-[var(--eph-surface)] p-6">
        <p className="mb-4 font-display text-[16px] font-normal text-[var(--eph-text)]">Medidas corporales</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MedidaTile label="Cintura" value={lastAnthro?.cintura ?? null} firstValue={firstAnthro?.cintura ?? null} />
          <MedidaTile label="Cadera" value={lastAnthro?.gluteo ?? null} firstValue={firstAnthro?.gluteo ?? null} />
          <MedidaTile label="Brazo" value={lastAnthro?.brazos ?? null} firstValue={firstAnthro?.brazos ?? null} />
          <MedidaTile label="Pierna" value={lastAnthro?.piernas ?? null} firstValue={firstAnthro?.piernas ?? null} />
        </div>
      </div>
    </>
  );
}

