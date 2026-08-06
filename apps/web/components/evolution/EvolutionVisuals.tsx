'use client';

import type { AnthropometricRecord, InbodyRecord } from '../../lib/evolution-client';
import { getKpiStatus, comparisonLabelByCadence, type KpiStatus } from '../../lib/evolution-logic';
import LockedOverlay from '../ui/LockedOverlay';
import EmptyState from '../ui/EmptyState';

// ─── Índice de bienestar general ─────────────────────────────────

export function WellnessIndexHero({ index }: { index: number | null }) {
  const size = 88;
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = index != null ? index / 100 : 0;

  return (
    <div
      className="mb-5 flex items-center gap-5 rounded-2xl p-6 text-[#F3EFE6]"
      style={{ background: 'linear-gradient(135deg, #2B2621, #3A322A)' }}
    >
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#D9A441"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${(pct * circ).toFixed(1)} ${circ.toFixed(1)}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-[26px] font-bold leading-none">{index != null ? index : '—'}</span>
          <span className="text-[9px] text-[#B0A597]">/ 100</span>
        </div>
      </div>
      <div>
        <p className="mb-1 font-serif text-base font-bold">Índice de bienestar general</p>
        <p className="text-[11.5px] leading-relaxed text-[#D9CDBF]">
          Promedio ponderado de constancia de entrenamiento (40%), calidad de sueño (30%) y regulación de cortisol
          (30%). Los componentes sin datos aún se excluyen del cálculo, en vez de contar como cero.
        </p>
      </div>
    </div>
  );
}

// ─── Chip de tendencia (reutilizado por Bienestar general y KPIs) ─

const TREND_STYLES: Record<KpiStatus, { bg: string; color: string; text: string }> = {
  good: { bg: '#EFF5E8', color: '#5B7A4E', text: 'Mejorando' },
  watch: { bg: '#FBEFE4', color: '#B8794A', text: 'Revisar' },
  neutral: { bg: '#FBF3E4', color: '#B8935A', text: 'Sin cambios' },
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
    return <p className="mt-1.5 text-[10.5px] italic text-[#8A8377]">Primera medición</p>;
  }
  const styles = TREND_STYLES[status];
  const arrow = status === 'neutral' && delta === 0 ? '→' : delta > 0 ? '↑' : '↓';
  return (
    <>
      <span
        className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
        style={{ background: styles.bg, color: styles.color }}
      >
        {arrow} {styles.text}
      </span>
      <p className="mt-1 text-[10px] text-[#8A8377]">
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
    <div className="mb-5">
      <p className="mb-0.5 font-serif text-base font-bold text-[var(--ink)]">Bienestar general</p>
      <p className="mb-3.5 text-[11px] text-[#8A8377]">Un resumen rápido — el detalle completo vive en sus propios módulos.</p>
      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-[150px] flex-1 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-bold uppercase text-[#8A8377]">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#8A5FA0' }} />
            Descanso
          </p>
          <p className="font-serif text-2xl font-bold text-[var(--ink)]">{sleepAvg ?? '—'}</p>
          <p className="mt-0.5 text-[10.5px] text-[#8A8377]">Calidad de sueño promedio</p>
          <TrendChip delta={sleepDelta} unit="" status={sleepStatus} comparisonLabel="vs mes pasado" />
        </div>
        <div className="min-w-[150px] flex-1 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-bold uppercase text-[#8A8377]">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#5B7A4E' }} />
            Gestión de Cortisol
          </p>
          <p className="font-serif text-2xl font-bold text-[var(--ink)]">{weeklyRegulation ?? '—'}</p>
          <p className="mt-0.5 text-[10.5px] text-[#8A8377]">Momentos de regulación esta semana</p>
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

const KPI_COLORS: Record<KpiMetrica, string> = { peso: '#D9A441', grasa_corporal: '#5B7A4E', masa_muscular: '#8A5FA0' };

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
    <div className="rounded-2xl border border-[var(--line)] bg-[#FBF7EC] p-4 text-center">
      <KpiIcon metrica={metrica} />
      <p className="font-serif text-[22px] font-bold text-[var(--ink)]">{value != null ? `${value}${unit}` : '—'}</p>
      <p className="my-1 text-[9.5px] font-bold uppercase tracking-wide text-[#8A8377]">{label}</p>
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
  const size = 64;
  const strokeWidth = 7;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const hasSessions = expected > 0;
  const pct = hasSessions ? Math.max(0, Math.min(100, Math.round((doneDays / expected) * 100))) : 0;
  const frac = pct / 100;

  return (
    <div className="mb-4 flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFE7D4" strokeWidth={strokeWidth} />
          {hasSessions && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#D9A441"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${(frac * circ).toFixed(1)} ${circ.toFixed(1)}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-base font-bold leading-none">{hasSessions ? `${pct}%` : '—'}</span>
          <span className="text-[7px] text-[#8A8377]">ESTE MES</span>
        </div>
      </div>
      <div>
        <p className="mb-1 font-serif text-[14.5px] font-bold text-[var(--ink)]">Adherencia de entrenamiento</p>
        <p className="text-[11px] text-[#8A8377]">
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
    <div className="rounded-xl border border-[var(--line)] bg-[#FBF7EC] p-3 text-center">
      <p className="font-serif text-base font-bold text-[var(--ink)]">{value ?? '—'}</p>
      <p className="my-0.5 text-[9px] font-bold uppercase text-[#8A8377]">{label}</p>
      {delta != null && (
        <span className="text-[10px] text-[#8A8377]">
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
    { label: 'Masa magra (estimada)', kg: magraKg, unit: '%', color: '#B8935A' },
    { label: 'Masa muscular', kg: muscularKg, unit: 'kg', color: '#5B7A4E' },
    { label: 'Grasa corporal', kg: grasaKg, unit: '%', color: '#8A5FA0' },
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
          <span className="font-serif text-[17px] font-bold text-[var(--ink)]">{peso}kg</span>
          <span className="text-[8px] uppercase text-[#8A8377]">Total</span>
        </div>
      </div>
      <div className="min-w-[180px] flex-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between py-1 text-xs">
            <span className="flex items-center gap-1.5 text-[var(--ink)]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <strong className="text-[var(--ink)]">
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
          <text key={m} x={xFor(m).toFixed(1)} y={h - 4} fontSize={8} textAnchor="middle" fill="#8A8377">
            M{m}
          </text>
        ))}
      </svg>
      <div className="mt-2.5 flex flex-wrap gap-4">
        {series.map((s) => {
          const pts = allMonths.map((m) => s.points.find((p) => p.month === m)).filter(Boolean);
          const latest = pts.length ? pts[pts.length - 1]!.value : null;
          return (
            <div key={s.name} className="flex items-center gap-1.5 text-[11px] text-[#8A8377]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}: <strong className="text-[var(--ink)]">{latest != null ? `${latest}${s.unit}` : '—'}</strong>
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
      <div className="mb-1 mt-5">
        <p className="font-serif text-base font-bold text-[var(--ink)]">Tu evolución física</p>
      </div>
      <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <p className="mb-4 font-serif text-[15px] font-bold text-[var(--ink)]">KPIs principales</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <EvolutionKpiCard label="Peso" value={pesoVal} unit=" kg" delta={pesoDelta} metrica="peso" objetivos={objetivos} comparisonLabel={comparisonLabel} />
          <EvolutionKpiCard label="Grasa corporal" value={lastInbody?.grasaPct ?? null} unit="%" delta={grasaDelta} metrica="grasa_corporal" objetivos={objetivos} comparisonLabel={comparisonLabel} />
          <EvolutionKpiCard label="Masa muscular" value={lastInbody?.smm ?? null} unit=" kg" delta={smmDelta} metrica="masa_muscular" objetivos={objetivos} comparisonLabel={comparisonLabel} />
        </div>
        <p className="mt-3 text-center text-[10.5px] text-[#8A8377]">
          {lastMeasurementDate ? `Última medición: ${lastMeasurementDate}` : 'Sin mediciones aún'}
        </p>
      </div>
      <AdherenciaKpiCard doneDays={disciplineStats?.doneDays ?? 0} expected={disciplineStats?.expected ?? 0} streakWeeks={streakWeeks} />
      <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <p className="mb-4 font-serif text-[15px] font-bold text-[var(--ink)]">Composición corporal</p>
        <CompositionDonut pesoTotal={lastInbody?.pesoTotal ?? lastAnthro?.peso ?? null} smm={lastInbody?.smm ?? null} grasaPct={lastInbody?.grasaPct ?? null} />
      </div>
      <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <p className="mb-1 font-serif text-[15px] font-bold text-[var(--ink)]">Evolución en el tiempo</p>
        <p className="mb-3 text-[11px] text-[#8A8377]">Una gráfica por métrica, con fechas reales — aparece con tu segunda medición.</p>
        {hasEnoughForChart ? (
          <EvolutionLineChart
            series={[
              { name: 'Peso', color: '#2B2621', unit: ' kg', points: inbody.filter((r) => r.mesNum != null && r.pesoTotal != null).map((r) => ({ month: r.mesNum!, value: Number(r.pesoTotal) })) },
              { name: 'Grasa', color: '#5B7A4E', unit: '%', points: inbody.filter((r) => r.mesNum != null && r.grasaPct != null).map((r) => ({ month: r.mesNum!, value: Number(r.grasaPct) })) },
              { name: 'Masa muscular', color: '#B8935A', unit: ' kg', points: inbody.filter((r) => r.mesNum != null && r.smm != null).map((r) => ({ month: r.mesNum!, value: Number(r.smm) })) },
            ]}
          />
        ) : (
          <div className="px-2.5 py-5 text-center">
            <p className="mb-2 font-serif text-[15px] font-bold text-[var(--ink)]">Necesitas al menos 2 mediciones para ver tu evolución</p>
            <p className="mx-auto max-w-[320px] text-xs text-[#8A8377]">
              Tu mentor registrará tu próxima medición en tu siguiente sesión de seguimiento — ahí empezará a aparecer tu gráfica de tendencia.
            </p>
          </div>
        )}
      </div>
      <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <p className="mb-4 font-serif text-[15px] font-bold text-[var(--ink)]">Medidas corporales</p>
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

// ─── "Tu evolución física" bloqueada (lead_wellness) ───────────────

const DEMO_OBJETIVOS = { peso: 'bajar', grasa_corporal: 'bajar', masa_muscular: 'subir' };

export function EvolucionFisicaLocked({ onCta }: { onCta?: () => void }) {
  return (
    <>
      <div className="mb-1 mt-5">
        <p className="font-serif text-base font-bold text-[var(--ink)]">Tu evolución física</p>
      </div>
      <LockedOverlay
        title="Tu evolución física se mide en sesión"
        subtitle="Peso, medidas, % de grasa y masa muscular los registra tu mentor en cada seguimiento — actívate con un coach para empezar a verlos aquí."
        ctaLabel="Ver planes"
        onCta={onCta}
      >
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <p className="mb-4 font-serif text-[15px] font-bold text-[var(--ink)]">KPIs principales</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <EvolutionKpiCard label="Peso" value={68} unit=" kg" delta={-1.2} metrica="peso" objetivos={DEMO_OBJETIVOS} comparisonLabel="vs mes pasado" />
            <EvolutionKpiCard label="Grasa corporal" value={22} unit="%" delta={-2.1} metrica="grasa_corporal" objetivos={DEMO_OBJETIVOS} comparisonLabel="vs mes pasado" />
            <EvolutionKpiCard label="Masa muscular" value={28} unit=" kg" delta={0.8} metrica="masa_muscular" objetivos={DEMO_OBJETIVOS} comparisonLabel="vs mes pasado" />
          </div>
        </div>
        <AdherenciaKpiCard doneDays={9} expected={12} streakWeeks={3} />
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <p className="mb-4 font-serif text-[15px] font-bold text-[var(--ink)]">Medidas corporales</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MedidaTile label="Cintura" value={78} firstValue={80} />
            <MedidaTile label="Cadera" value={96} firstValue={98} />
            <MedidaTile label="Brazo" value={32} firstValue={31} />
            <MedidaTile label="Pierna" value={54} firstValue={53} />
          </div>
        </div>
      </LockedOverlay>
    </>
  );
}
