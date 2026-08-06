'use client';

import { useEffect, useState } from 'react';
import { getMetricas, getWearableEstado, type WearableMetrica, type WearableEstado } from '../../lib/wearable-client';
import { getProtocol, type SleepProtocol } from '../../lib/sleep-client';
import { fetchClient } from '../../lib/clients-client';
import { pickMantra } from '../../lib/mantra-bank';
import { COACH_WHATSAPP_NUMBER } from '../../lib/constants';
import {
  isMentoringClient,
  formatMinutesDuration,
  formatClockTime,
  formatRelativeSync,
  sleepScoreLabel,
  average,
} from '../../lib/rest-logic';
import IdentityHeader from '../ui/IdentityHeader';
import MantraCard from '../ui/MantraCard';
import LockedOverlay from '../ui/LockedOverlay';
import EmptyState from '../ui/EmptyState';
import { RestToolsClientPanel } from './RestToolsClientPanel';

// ─── Hipnograma ─────────────────────────────────────────────────

const PHASES = [
  { key: 'despierto', label: 'despierto', color: 'rgba(255,255,255,.35)' },
  { key: 'profundo', label: 'profundo', color: '#5B3F82' },
  { key: 'rem', label: 'REM', color: '#8A5FA0' },
  { key: 'ligero', label: 'ligero', color: '#C6B4E0' },
] as const;

function Hypnogram({ despierto, profundo, rem, ligero }: { despierto: number; profundo: number; rem: number; ligero: number }) {
  const total = despierto + profundo + rem + ligero || 1;
  const minutesByKey: Record<(typeof PHASES)[number]['key'], number> = { despierto, profundo, rem, ligero };

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {PHASES.map((p) => (
          <div key={p.key} style={{ width: `${(minutesByKey[p.key] / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-80">
        {PHASES.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} {formatMinutesDuration(minutesByKey[p.key])}
          </span>
        ))}
      </div>
    </div>
  );
}

function SyncIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 11A8 8 0 1 0 18.5 15.5M20 11V5M20 11h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Hero de sincronización ─────────────────────────────────────

function SyncHero({ latest, ultimaSync }: { latest: WearableMetrica | null; ultimaSync: string | null }) {
  if (!latest) {
    return (
      <div className="relative mb-5 overflow-hidden rounded-[20px] p-7 text-white" style={{ background: 'linear-gradient(135deg, #241C30, #332740)' }}>
        <EmptyState message="Aún no hay datos sincronizados desde tu Oura Ring." />
      </div>
    );
  }

  const totalMin = latest.suenoTotalMinutos ?? 0;
  const profundo = latest.suenoProfundoMinutos ?? 0;
  const rem = latest.suenoRemMinutos ?? 0;
  const ligero = latest.suenoLigeroMinutos ?? 0;
  const despierto = Math.max(0, totalMin - (profundo + rem + ligero));

  return (
    <div className="relative mb-5 overflow-hidden rounded-[20px] p-7 text-white" style={{ background: 'linear-gradient(135deg, #241C30, #332740)' }}>
      <div className="mb-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[#C6B4E0]">
        <span className="inline-flex items-center gap-1.5">
          <SyncIcon /> Sincronizado con Oura {ultimaSync ? `· ${formatRelativeSync(ultimaSync)}` : ''}
        </span>
        <span className="normal-case tracking-normal opacity-70">Anoche</span>
      </div>

      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="font-serif text-4xl font-bold leading-none">{latest.suenoScore ?? '—'}</p>
        <p className="text-right font-serif text-lg font-semibold">{formatMinutesDuration(totalMin)}</p>
      </div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="text-sm opacity-80">puntaje de sueño · {sleepScoreLabel(latest.suenoScore)}</p>
        {latest.horaDormir && <p className="text-right text-xs opacity-70">te dormiste {formatClockTime(latest.horaDormir)}</p>}
      </div>

      <Hypnogram despierto={despierto} profundo={profundo} rem={rem} ligero={ligero} />
    </div>
  );
}

// ─── Métricas de recuperación ───────────────────────────────────

function MetricCard({ label, value, caption, captionColor }: { label: string; value: string; caption?: string; captionColor?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <p className="mb-1 text-[11px] font-semibold text-[var(--ink-soft)]">{label}</p>
      <p className="font-serif text-xl font-bold text-[var(--ink)]">{value}</p>
      {caption && (
        <p className="mt-1 text-[11px]" style={{ color: captionColor || 'var(--ink-soft)' }}>
          {caption}
        </p>
      )}
    </div>
  );
}

function RecoveryMetricsRow({ latest, previous }: { latest: WearableMetrica; previous: WearableMetrica[] }) {
  const hrvBaseline = average(previous.map((m) => m.hrvNocturno));
  const hrvPct = latest.hrvNocturno != null && hrvBaseline ? Math.round(((latest.hrvNocturno - hrvBaseline) / hrvBaseline) * 100) : null;

  const tempBaseline = average(previous.map((m) => m.temperaturaPiel));
  const tempDelta = latest.temperaturaPiel != null && tempBaseline != null ? Number(latest.temperaturaPiel) - tempBaseline : null;

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="HRV"
        value={latest.hrvNocturno != null ? `${latest.hrvNocturno} ms` : '—'}
        caption={hrvPct != null ? `${hrvPct >= 0 ? '↑' : '↓'} ${Math.abs(hrvPct)}% vs. prom.` : undefined}
        captionColor={hrvPct != null && hrvPct >= 0 ? 'var(--sage)' : 'var(--danger)'}
      />
      <MetricCard label="FC reposo" value={latest.fcReposo != null ? `${latest.fcReposo} bpm` : '—'} caption="estable" />
      <MetricCard label="Temp. piel" value={tempDelta != null ? `${tempDelta >= 0 ? '+' : ''}${tempDelta.toFixed(1)}°` : '—'} caption="vs. tu base" />
      <MetricCard label="Resp." value={latest.tasaRespiratoria != null ? `${Number(latest.tasaRespiratoria).toFixed(1)} rpm` : '—'} caption="normal" />
    </div>
  );
}

// ─── Tendencia de 7 días ────────────────────────────────────────

function shortWeekday(fecha: string): string {
  const label = new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CO', { weekday: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
}

function TrendChart({ points }: { points: WearableMetrica[] }) {
  const scores = points.map((p) => p.suenoScore).filter((s): s is number => s != null);
  if (!scores.length) {
    return (
      <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
        <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Tendencia · últimos 7 días</h2>
        <EmptyState message="Aún no hay suficientes días sincronizados para ver la tendencia." />
      </section>
    );
  }

  const yMin = Math.max(0, Math.min(60, ...scores.map((s) => Math.floor(s / 10) * 10)));
  const yMax = 100;
  const w = 700;
  const h = 160;
  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xFor = (i: number) => padL + i * stepX;
  const yFor = (score: number) => padT + plotH - ((score - yMin) / (yMax - yMin || 1)) * plotH;
  const linePoints = points.map((p, i) => (p.suenoScore != null ? `${xFor(i)},${yFor(p.suenoScore)}` : null)).filter(Boolean).join(' ');
  const gridValues: number[] = [];
  for (let v = yMin; v <= yMax; v += 10) gridValues.push(v);

  return (
    <section className="mb-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--paper)] p-[26px]">
      <h2 className="mb-4 font-serif text-lg font-bold text-[var(--ink)]">Tendencia · últimos 7 días</h2>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 180 }} role="img" aria-label="Tendencia del puntaje de sueño de los últimos 7 días">
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={0} y={yFor(v) + 3} fontSize={10} fill="var(--ink-soft)">
              {v}
            </text>
          </g>
        ))}
        <polyline points={linePoints} fill="none" stroke="#8A5FA0" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) =>
          p.suenoScore != null ? <circle key={p.id} cx={xFor(i)} cy={yFor(p.suenoScore)} r={3.5} fill="#8A5FA0" /> : null
        )}
        {points.map((p, i) => (
          <text key={`${p.id}-label`} x={xFor(i)} y={h - 4} fontSize={10} fill="var(--ink-soft)" textAnchor="middle">
            {shortWeekday(p.fecha)}
          </text>
        ))}
      </svg>
    </section>
  );
}

// ─── Protocolo personalizado ────────────────────────────────────

// Convención liviana de autoría para el mentor: **texto** resalta la acción
// concreta (bold, morado oscuro); el resto de la línea queda en cursiva lila
// (el contexto/condición). Sin este marcador, la línea completa es cursiva.
function renderProtocolLine(line: string, key: number) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <p key={key} className="font-serif text-[13.5px] italic leading-relaxed text-[#7C5EA3]">
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <span key={i} className="font-semibold not-italic text-[#3F2A63]">
            {part.slice(2, -2)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

function ProtocolCard({ protocol }: { protocol: SleepProtocol }) {
  const lines = (protocol?.protocolText || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <section className="mb-5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A5FA0]">Actualizado con tu data</p>
      <h2 className="mb-3.5 font-serif text-lg font-bold text-[var(--ink)]">Tu protocolo de sueño personalizado</h2>
      <div className="rounded-2xl border border-[#E1D5EE] bg-[#F1EAF7] p-[22px_24px]">
        {lines.length ? (
          <div className="space-y-2">{lines.map((line, i) => renderProtocolLine(line, i))}</div>
        ) : (
          <EmptyState message="Tu mentor está preparando tu protocolo personalizado." />
        )}
        {protocol?.supplement && (
          <div className="mt-4 border-t border-[#E1D5EE] pt-4">
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A5FA0]">Suplemento sugerido</p>
            <p className="font-serif text-sm font-semibold text-[#3F2A63]">{protocol.supplement}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Panel principal ────────────────────────────────────────────

export function ClientRestPanel({ clientId }: { clientId: string }) {
  const [metrics, setMetrics] = useState<WearableMetrica[]>([]);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<SleepProtocol>(null);
  const [mentoring, setMentoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mantra] = useState(() => pickMantra('rest'));

  useEffect(() => {
    Promise.all([
      getMetricas(clientId, 7).catch(() => ({ total: 0, promedios: {}, data: [] as WearableMetrica[] })),
      getWearableEstado(clientId).catch(() => [] as WearableEstado[]),
      getProtocol(clientId).catch(() => null),
      fetchClient(clientId).catch(() => null),
    ])
      .then(([metricasRes, estados, sleepProtocol, client]) => {
        setMetrics(metricasRes.data);
        const oura = estados.find((w) => w.dispositivo === 'oura');
        setUltimaSync(oura?.ultimaSync ?? null);
        setProtocol(sleepProtocol);
        setMentoring(isMentoringClient(client?.clientType));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  const header = (
    <>
      <IdentityHeader title="Descanso" subtitle="Tu recuperación nocturna, medida por tu wearable." />
      {mantra && <MantraCard mantra={mantra} />}
    </>
  );

  if (loading) {
    return (
      <div>
        {header}
        <p className="text-sm text-[var(--ink-soft)]">Cargando tu recuperación…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        {header}
        <p role="alert" className="text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  // data llega ordenada desc por fecha (ver wearable.service.ts) — el primer
  // elemento es la noche más reciente; el resto es la línea base de comparación.
  const latest = metrics[0] ?? null;
  const previous = metrics.slice(1);
  const trendPoints = [...metrics].reverse();

  const body = (
    <div>
      <SyncHero latest={latest} ultimaSync={ultimaSync} />
      {latest && <RecoveryMetricsRow latest={latest} previous={previous} />}
      <TrendChart points={trendPoints} />
      <ProtocolCard protocol={protocol} />
      <RestToolsClientPanel />
    </div>
  );

  return (
    <div>
      {header}
      {mentoring ? (
        body
      ) : (
        <LockedOverlay
          title="Solo disponible para Mentoría"
          subtitle="El seguimiento de sueño con wearable y tu protocolo personalizado son parte del plan Mentoring."
          ctaLabel="Conocer planes"
          onCta={() => window.open(`https://wa.me/${COACH_WHATSAPP_NUMBER}`, '_blank')}
        >
          {body}
        </LockedOverlay>
      )}
    </div>
  );
}
