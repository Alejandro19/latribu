'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { getMetricas, getWearableEstado, syncWearable, type WearableMetrica, type WearableEstado, type Dispositivo } from '../../lib/wearable-client';
import { getProtocol, type SleepProtocol } from '../../lib/sleep-client';
import { fetchClient } from '../../lib/clients-client';
import { PermissionDeniedError } from '../../lib/api-client';
import {
  isMentoringClient,
  formatMinutesDuration,
  formatClockTime,
  formatRelativeSync,
  sleepScoreLabel,
  average,
} from '../../lib/rest-logic';
import IdentityHeader from '../ui/IdentityHeader';
import LockedBenefit from '../ui/LockedBenefit';
import EmptyState from '../ui/EmptyState';
import MetricValue from '../ui/MetricValue';
import { ProtocolDisclaimerFooter } from '../ui/ProtocolDisclaimerFooter';
import { RestToolsClientPanel } from './RestToolsClientPanel';
import { InsightsSection } from '../insights/InsightsSection';

// ─── Hipnograma ─────────────────────────────────────────────────
// Rampa tonal steel→bronce (en vez de la paleta lila anterior) — mantiene la
// diferenciación real entre fases de sueño sin salirse de los tokens
// Ephirox: --eph-steel está reservado justo para este tipo de dato clínico.

const PHASES = [
  { key: 'despierto', label: 'despierto', color: 'rgba(237,230,220,.18)' },
  { key: 'ligero', label: 'ligero', color: 'rgba(126,138,147,.45)' },
  { key: 'rem', label: 'REM', color: 'var(--eph-steel)' },
  { key: 'profundo', label: 'profundo', color: 'var(--eph-accent)' },
] as const;

function Hypnogram({ despierto, profundo, rem, ligero }: { despierto: number; profundo: number; rem: number; ligero: number }) {
  const total = despierto + profundo + rem + ligero || 1;
  const minutesByKey: Record<(typeof PHASES)[number]['key'], number> = { despierto, profundo, rem, ligero };

  return (
    <div>
      <div className="flex h-[3px] w-full overflow-hidden">
        {PHASES.map((p) => (
          <div key={p.key} style={{ width: `${(minutesByKey[p.key] / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.06em] opacity-80">
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

type SyncControlProps = {
  hasDevice: boolean;
  onSyncNow: () => void;
  syncing: boolean;
  syncMessage: { text: string; isError: boolean } | null;
};

function SyncNowButton({ hasDevice, onSyncNow, syncing, syncMessage }: SyncControlProps) {
  if (!hasDevice) return null;
  return (
    <div className="relative z-10 mb-3 flex items-center gap-3">
      <button
        type="button"
        onClick={onSyncNow}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-60"
        style={{ color: 'var(--eph-accent)' }}
      >
        <SyncIcon /> {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
      {syncMessage && (
        <span className="font-mono text-[10px]" style={{ color: syncMessage.isError ? 'var(--eph-danger)' : 'var(--eph-muted)' }}>
          {syncMessage.text}
        </span>
      )}
    </div>
  );
}

function SyncHero({ latest, ultimaSync, hasDevice, onSyncNow, syncing, syncMessage }: { latest: WearableMetrica | null; ultimaSync: string | null } & SyncControlProps) {
  if (!latest) {
    return (
      <div className="relative mt-8 mb-5 overflow-hidden rounded-[0] p-7" style={{ background: 'var(--eph-surface)', color: 'var(--eph-text)' }}>
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--eph-accent) 18%, transparent) 0%, transparent 70%)' }}
        />
        <SyncNowButton hasDevice={hasDevice} onSyncNow={onSyncNow} syncing={syncing} syncMessage={syncMessage} />
        <EmptyState message="Aún no hay datos sincronizados desde tu Oura Ring." />
      </div>
    );
  }

  const totalMin = latest.suenoTotalMinutos ?? 0;
  const profundo = latest.suenoProfundoMinutos ?? 0;
  const rem = latest.suenoRemMinutos ?? 0;
  const ligero = latest.suenoLigeroMinutos ?? 0;
  // Preferir el dato real del wearable (Oura: awake_time) — el fallback por
  // resta solo aplica a dispositivos que todavía no lo reportan (Whoop/Polar),
  // y casi siempre da 0 porque total_sleep_duration ya excluye el despierto.
  const despierto = latest.suenoDespiertoMinutos ?? Math.max(0, totalMin - (profundo + rem + ligero));

  return (
    <div className="relative mt-8 mb-5 overflow-hidden rounded-[0] p-7" style={{ background: 'var(--eph-surface)', color: 'var(--eph-text)' }}>
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--eph-accent) 18%, transparent) 0%, transparent 70%)' }}
      />
      <div className="relative z-10 mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-accent)' }}>
        <span className="inline-flex items-center gap-1.5">
          <SyncIcon /> Sincronizado con Oura {ultimaSync ? `· ${formatRelativeSync(ultimaSync)}` : ''}
        </span>
        <span className="normal-case tracking-normal" style={{ color: 'var(--eph-muted)' }}>Anoche</span>
      </div>
      <SyncNowButton hasDevice={hasDevice} onSyncNow={onSyncNow} syncing={syncing} syncMessage={syncMessage} />

      <div className="relative z-10 mb-1 flex items-start justify-between gap-3">
        <MetricValue value={latest.suenoScore ?? '—'} size="index" />
        <MetricValue value={formatMinutesDuration(totalMin)} unit="H" size="secondary" />
      </div>
      <div className="relative z-10 mb-5 flex items-start justify-between gap-3">
        <p className="font-body text-sm" style={{ color: 'var(--eph-muted)' }}>puntaje de sueño · {sleepScoreLabel(latest.suenoScore)}</p>
        {latest.horaDormir && <p className="text-right font-body text-xs" style={{ color: 'var(--eph-muted)' }}>te dormiste {formatClockTime(latest.horaDormir)}</p>}
      </div>

      <div className="relative z-10">
        <Hypnogram despierto={despierto} profundo={profundo} rem={rem} ligero={ligero} />
      </div>
    </div>
  );
}

// ─── Métricas de recuperación ───────────────────────────────────

function MetricCard({ label, value, unit, caption, captionColor }: { label: string; value: string; unit?: string; caption?: string; captionColor?: string }) {
  return (
    <div className="border p-4" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>{label}</p>
      <MetricValue value={value} unit={unit} />
      {caption && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: captionColor || 'var(--eph-muted)' }}>
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
        value={latest.hrvNocturno != null ? `${latest.hrvNocturno}` : '—'}
        unit={latest.hrvNocturno != null ? 'MS' : undefined}
        caption={hrvPct != null ? `${hrvPct >= 0 ? '↑' : '↓'} ${Math.abs(hrvPct)}% vs. prom.` : undefined}
        captionColor={hrvPct != null && hrvPct >= 0 ? 'var(--eph-accent)' : 'var(--eph-danger)'}
      />
      <MetricCard
        label="FC reposo"
        value={latest.fcReposo != null ? `${latest.fcReposo}` : '—'}
        unit={latest.fcReposo != null ? 'BPM' : undefined}
        caption="estable"
      />
      <MetricCard
        label="Temp. piel"
        value={tempDelta != null ? `${tempDelta >= 0 ? '+' : ''}${tempDelta.toFixed(1)}` : '—'}
        unit={tempDelta != null ? '°C' : undefined}
        caption="vs. tu base"
      />
      <MetricCard
        label="Resp."
        value={latest.tasaRespiratoria != null ? `${Number(latest.tasaRespiratoria).toFixed(1)}` : '—'}
        unit={latest.tasaRespiratoria != null ? 'RPM' : undefined}
        caption="normal"
      />
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
      <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <h2 className="mb-4 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Tendencia · últimos 7 días</h2>
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
    <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <h2 className="mb-4 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Tendencia · últimos 7 días</h2>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 180 }} role="img" aria-label="Tendencia del puntaje de sueño de los últimos 7 días">
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={padL} x2={w - padR} y1={yFor(v)} y2={yFor(v)} stroke="var(--eph-line)" strokeWidth={1} />
            <text x={0} y={yFor(v) + 3} fontSize={10} fill="var(--eph-muted)">
              {v}
            </text>
          </g>
        ))}
        <polyline points={linePoints} fill="none" stroke="var(--eph-accent)" strokeWidth={1.5} strokeLinecap="butt" strokeLinejoin="round" />
        {points.map((p, i) =>
          p.suenoScore != null ? <circle key={p.id} cx={xFor(i)} cy={yFor(p.suenoScore)} r={3} fill="var(--eph-accent)" /> : null
        )}
        {points.map((p, i) => (
          <text key={`${p.id}-label`} x={xFor(i)} y={h - 4} fontSize={10} fill="var(--eph-muted)" textAnchor="middle">
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
    <p key={key} className="font-display text-[14.5px] italic leading-relaxed" style={{ color: 'var(--eph-text)' }}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <span key={i} className="not-italic" style={{ color: 'var(--eph-accent)' }}>
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
    <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-muted)' }}>Actualizado con tu data</p>
      <h2 className="mb-3.5 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Tu protocolo de sueño personalizado</h2>
      {lines.length ? (
        <div className="space-y-2">{lines.map((line, i) => renderProtocolLine(line, i))}</div>
      ) : (
        <EmptyState message="Tu mentor está preparando tu protocolo personalizado." />
      )}
      {protocol?.supplement && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--eph-line)' }}>
          <p className="mb-0.5 font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--eph-muted)' }}>Suplemento sugerido</p>
          <p className="font-display text-sm" style={{ color: 'var(--eph-text)' }}>{protocol.supplement}</p>
        </div>
      )}
    </section>
  );
}

// ─── Panel principal ────────────────────────────────────────────

async function fetchRestBundle(clientId: string) {
  const [metricasRes, estados, sleepProtocol, client] = await Promise.all([
    getMetricas(clientId, 7).catch(() => ({ total: 0, promedios: {}, data: [] as WearableMetrica[] })),
    getWearableEstado(clientId).catch(() => [] as WearableEstado[]),
    // Un 403 acá sí debe propagar (a diferencia del resto de estos
    // fetches, que son "best effort") — es la señal de que este tipo de
    // cliente ya no tiene acceso al módulo, ver requirePermission('rest').
    getProtocol(clientId).catch((e) => {
      if (e instanceof PermissionDeniedError) throw e;
      return null;
    }),
    fetchClient(clientId).catch(() => null),
  ]);
  const oura = estados.find((w) => w.dispositivo === 'oura');
  return {
    metrics: metricasRes.data,
    ultimaSync: oura?.ultimaSync ?? null,
    dispositivosConectados: estados.map((w) => w.dispositivo),
    protocol: sleepProtocol,
    mentoring: isMentoringClient(client?.clientType),
  };
}

// Umbral para no re-sincronizar en cada montaje si ya hubo un sync muy
// reciente (cron, webhook, u otra pestaña) — evita llamadas redundantes al
// proveedor sin perder el objetivo real: que la data esté fresca cada vez
// que el cliente abre Sleep, sin que tenga que acordarse de sincronizar.
const AUTO_SYNC_SKIP_IF_RECENT_MS = 5 * 60_000;

// Reintentos automáticos tras un sync: Oura suele publicar el readiness de
// hoy antes que el detalle de sueño de esa misma noche (ver commit del fix
// de "Anoche" parcial) — un solo intento puede quedar sin la noche más
// reciente todavía. En vez de obligar al cliente a volver a hacer clic,
// reintentamos en segundo plano cada minuto hasta 4 veces más (~4 min en
// total) o hasta que la noche de hoy ya tenga sueño completo.
const RETRY_INTERVAL_MS = 60_000;
const MAX_RETRY_ATTEMPTS = 4;

function hasCompleteNightFor(dateStr: string, metrics: WearableMetrica[]): boolean {
  return metrics.some((m) => m.fecha === dateStr && m.suenoTotalMinutos != null);
}

export function ClientRestPanel({ clientId }: { clientId: string }) {
  const { data, error, isLoading, mutate } = useSWR(['rest-bundle', clientId], () => fetchRestBundle(clientId));
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const autoSyncedRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // Sincroniza y, si la noche de hoy todavía no tiene sueño completo (Oura
  // no ha terminado de procesarla), reintenta solo en segundo plano en vez
  // de dejar que el cliente tenga que volver a pedirlo. `onUpdate` se llama
  // en el primer intento (para que el botón manual muestre spinner/mensaje)
  // y de nuevo si un reintento posterior finalmente encuentra la noche
  // lista, para poder limpiar el aviso de "seguimos intentando".
  async function syncAndRetryUntilReady(
    dispositivos: Dispositivo[],
    attempt: number,
    onUpdate?: (info: { success: boolean; error?: string; ready: boolean }) => void
  ) {
    let result: { success: boolean; error?: string } = { success: true };
    try {
      const results = await Promise.all(dispositivos.map((d) => syncWearable(clientId, d)));
      const failed = results.find((r) => !r.success);
      if (failed) result = { success: false, error: failed.error };
    } catch (e) {
      result = { success: false, error: e instanceof Error ? e.message : 'No se pudo sincronizar.' };
    }
    const fresh = await mutate();
    const todayStr = new Date().toISOString().slice(0, 10);
    const ready = result.success && fresh ? hasCompleteNightFor(todayStr, fresh.metrics) : false;

    if (attempt === 0 || ready) onUpdate?.({ ...result, ready });
    if (!result.success || ready || attempt >= MAX_RETRY_ATTEMPTS) return;

    retryTimeoutRef.current = setTimeout(() => {
      syncAndRetryUntilReady(dispositivos, attempt + 1, onUpdate);
    }, RETRY_INTERVAL_MS);
  }

  function runSync(dispositivos: Dispositivo[]) {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    setSyncing(true);
    void syncAndRetryUntilReady(dispositivos, 0, ({ success, error, ready }) => {
      setSyncing(false);
      if (!success) {
        setSyncMessage({ text: error || 'No se pudo sincronizar.', isError: true });
      } else if (!ready) {
        setSyncMessage({ text: 'Oura todavía está procesando el detalle de esta noche — seguimos intentando en segundo plano.', isError: false });
      } else {
        setSyncMessage(null);
      }
    });
  }

  // Sincroniza en segundo plano apenas se abre Sleep — el objetivo es que la
  // data esté alineada con la app de Oura sin que el cliente tenga que
  // acordarse de sincronizar manualmente. Silencioso (sin mensaje de error
  // visible): si falla, el cron nocturno y el webhook siguen como respaldo,
  // y el cliente igual puede forzarlo con el botón "Sincronizar ahora".
  useEffect(() => {
    if (!data || autoSyncedRef.current || data.dispositivosConectados.length === 0) return;
    if (data.ultimaSync && Date.now() - new Date(data.ultimaSync).getTime() < AUTO_SYNC_SKIP_IF_RECENT_MS) return;
    autoSyncedRef.current = true;
    void syncAndRetryUntilReady(data.dispositivosConectados, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, clientId, mutate]);

  const header = <IdentityHeader title="Sleep" subtitle="Tu recuperación nocturna, medida por tu wearable." />;

  if (isLoading) {
    return (
      <div>
        {header}
        <p className="text-sm text-[var(--eph-muted)]">Cargando tu recuperación…</p>
      </div>
    );
  }
  if (error && error instanceof PermissionDeniedError) {
    return (
      <div>
        {header}
        <LockedBenefit benefit="tu protocolo de sueño y descanso" />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        {header}
        <p role="alert" className="font-body" style={{ color: 'var(--eph-danger)' }}>{(error as Error).message}</p>
      </div>
    );
  }
  if (!data) return null;

  const { metrics, ultimaSync, dispositivosConectados, protocol, mentoring } = data;
  // data llega ordenada desc por fecha (ver wearable.service.ts). La fecha
  // más reciente puede tener readiness pero todavía no el detalle de sueño
  // (Oura suele publicarlo más tarde que el puntaje de readiness) — nunca
  // mostrar esa fila parcial como "Anoche": se toma la más reciente que
  // realmente tenga sueño registrado, y el resto queda como línea base.
  const latestIndex = metrics.findIndex((m) => m.suenoTotalMinutos != null);
  const latest = latestIndex >= 0 ? metrics[latestIndex] : null;
  const previous = latestIndex >= 0 ? metrics.filter((_, i) => i !== latestIndex) : metrics;
  const trendPoints = [...metrics].reverse();

  const body = (
    <div>
      <SyncHero
        latest={latest}
        ultimaSync={ultimaSync}
        hasDevice={dispositivosConectados.length > 0}
        onSyncNow={() => runSync(dispositivosConectados)}
        syncing={syncing}
        syncMessage={syncMessage}
      />
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
        <>
          <InsightsSection clientId={clientId} moduleKey="sueno" />
          {body}
        </>
      ) : (
        <LockedBenefit benefit="tu protocolo de sueño personalizado y el seguimiento con wearable">
          {body}
        </LockedBenefit>
      )}
      <ProtocolDisclaimerFooter />
    </div>
  );
}
