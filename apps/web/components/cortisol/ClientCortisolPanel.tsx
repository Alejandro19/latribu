'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  listTechniques,
  listCompletions,
  markCompletion,
  getTodayCheckin,
  postCheckin,
  getTipOfTheDay,
  getTodayMorningCheckin,
  getCognitiveLoadOverview,
  type CortisolTechnique,
  type CortisolCompletion,
} from '../../lib/cortisol-client';
import { MorningCheckinSummary } from './MorningCheckinSummary';
import { CognitiveLoadSection } from './CognitiveLoadSection';
import { RoxRitualSection } from './RoxRitualSection';
import { youtubeEmbedUrl } from '../../lib/training-timer-logic';
import { CORTISOL_EMOTIONS, CORTISOL_RECOMMENDATIONS, calculateCortisolWeeklyStats } from '../../lib/cortisol-logic';
import { NEUROWELLNESS_TECHNIQUE_TYPES } from '@latribu/shared-types';
import { PermissionDeniedError } from '../../lib/api-client';
import { getModuleAccessState } from '../../lib/module-access';
import IdentityHeader from '../ui/IdentityHeader';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import RingProgress from '../ui/RingProgress';
import ProgressBar from '../ui/ProgressBar';
import LockedBenefit from '../ui/LockedBenefit';
import { ProtocolDisclaimerFooter } from '../ui/ProtocolDisclaimerFooter';
import { InsightsSection } from '../insights/InsightsSection';
import Button from '../ui/Button';

const TECHNIQUE_ICON_PATHS: Record<string, React.ReactNode> = {
  respiración: <path d="M3 10c2.5-3 4.5-3 7 0s4.5 3 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  breathwork: <path d="M3 10c2.5-3 4.5-3 7 0s4.5 3 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  meditación: <path d="M10 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-6 12c1-3.5 3.5-5.5 6-5.5s5 2 6 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  mindfulness: (
    <>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </>
  ),
  'respiración vagal': <path d="M3 10c2.5-3 4.5-3 7 0s4.5 3 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  'exposición controlada': (
    <path d="M10 3v14M4.5 6.5l11 7M4.5 13.5l11-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  ),
  'recuperación activa': (
    <path d="M4 12l3-6 2.5 9L12 6l1.5 6H16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  base: (
    <>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M10 6.5v4l2.6 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
};

function TechniqueIcon({ type }: { type: string | null }) {
  const key = (type || '').toLowerCase();
  const path = TECHNIQUE_ICON_PATHS[key] || TECHNIQUE_ICON_PATHS.base;
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--eph-surface-2)]" style={{ color: 'var(--eph-accent)' }}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        {path}
      </svg>
    </div>
  );
}

function CortisolPlayer({
  technique,
  doneToday,
  onComplete,
  onBack,
}: {
  technique: CortisolTechnique;
  doneToday: boolean;
  onComplete: () => void;
  onBack: () => void;
}) {
  const embedUrl = youtubeEmbedUrl(technique.youtubeUrl);
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 inline-block bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] hover:underline" style={{ color: 'var(--eph-muted)' }}>
        ← Stress
      </button>
      <h1 className="mb-1 font-display text-2xl" style={{ color: 'var(--eph-text)' }}>{technique.title}</h1>
      <p className="mb-5 font-body text-sm" style={{ color: 'var(--eph-muted)' }}>{[technique.type, technique.duration].filter(Boolean).join(' · ')}</p>

      <div className="border p-[26px]" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        {embedUrl ? (
          <div className="relative overflow-hidden bg-black pt-[56.25%]">
            <iframe
              src={embedUrl}
              title={technique.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : technique.audioUrl ? (
          <div className="border p-6 text-center" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
            <audio src={technique.audioUrl} controls className="w-full" />
          </div>
        ) : (
          <div className="py-10 text-center font-body" style={{ color: 'var(--eph-muted)' }}>Sin video ni audio asignado.</div>
        )}

        {technique.description && <p className="mt-4 font-body text-sm leading-relaxed" style={{ color: 'var(--eph-text)' }}>{technique.description}</p>}
        {technique.precautionNote && (
          <div className="mt-4 border px-4 py-3 font-body text-sm" style={{ borderColor: 'var(--eph-danger)', background: 'color-mix(in srgb, var(--eph-danger) 14%, transparent)', color: 'var(--eph-danger)' }}>
            <strong>Precaución:</strong> {technique.precautionNote}
          </div>
        )}

        <div className="mt-5 flex justify-center gap-2.5">
          {doneToday ? (
            <Button type="button" variant="secondary" disabled>
              Completado hoy ✓
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={onComplete}>
              Marcar completado
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onBack}>
            Finalizar
          </Button>
        </div>
      </div>
    </div>
  );
}

function TechniqueList({
  techniques,
  playingAudioId,
  setPlayingAudioId,
  setActiveId,
}: {
  techniques: CortisolTechnique[];
  playingAudioId: string | null;
  setPlayingAudioId: (updater: (prev: string | null) => string | null) => void;
  setActiveId: (id: string) => void;
}) {
  return (
    <div>
      {techniques.map((t, i) => {
        const hasVideo = !!(t.youtubeUrl || t.videoUrl);
        const hasAudio = !!t.audioUrl;
        const isPlayingAudio = playingAudioId === t.id;
        return (
          <div key={t.id} className={`py-3 ${i === 0 ? '' : 'border-t border-[var(--eph-line)]'}`}>
            <div className="flex items-center gap-3">
              <TechniqueIcon type={t.type} />
              <div className="flex-1">
                <div className="font-body text-sm font-medium" style={{ color: 'var(--eph-text)' }}>
                  {t.title} {t.type && <Badge label={t.type} />}
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--eph-muted)' }}>{t.duration}</div>
              </div>
              {hasVideo && (
                <Button type="button" variant="secondary" onClick={() => setActiveId(t.id)}>
                  Reproducir
                </Button>
              )}
              {!hasVideo && hasAudio && (
                <Button type="button" variant="secondary" onClick={() => setPlayingAudioId((prev) => (prev === t.id ? null : t.id))}>
                  {isPlayingAudio ? 'Ocultar' : 'Reproducir'}
                </Button>
              )}
            </div>
            {t.precautionNote && (
              <div className="mt-2 border px-3 py-2 font-body text-xs" style={{ borderColor: 'var(--eph-danger)', background: 'color-mix(in srgb, var(--eph-danger) 14%, transparent)', color: 'var(--eph-danger)' }}>
                <strong>Precaución:</strong> {t.precautionNote}
              </div>
            )}
            {isPlayingAudio && hasAudio && (
              <audio controls autoPlay src={t.audioUrl ?? undefined} className="mt-2.5 w-full" />
            )}
          </div>
        );
      })}
    </div>
  );
}

async function fetchCortisolBundle(clientId: string) {
  const [techniques, completions, tip, checkin, morningCheckin, cognitiveLoad] = await Promise.all([
    listTechniques(clientId),
    listCompletions(clientId).catch(() => [] as CortisolCompletion[]),
    getTipOfTheDay(clientId),
    getTodayCheckin(clientId),
    getTodayMorningCheckin(clientId),
    getCognitiveLoadOverview(clientId),
  ]);
  return { techniques, completions, tip, checkin, morningCheckin, cognitiveLoad };
}

export function ClientCortisolPanel({
  clientId,
  clientType,
  moduleAccess = {},
  planExpired = false,
}: {
  clientId: string;
  clientType?: string | null;
  moduleAccess?: Record<string, boolean>;
  planExpired?: boolean;
}) {
  const { data, error, isLoading, mutate } = useSWR(['cortisol-bundle', clientId], () =>
    fetchCortisolBundle(clientId),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  async function handleSelectEmotion(key: string) {
    try {
      const saved = await postCheckin(clientId, key);
      await mutate((current) => (current ? { ...current, checkin: saved } : current), { revalidate: false });
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function handleComplete(techniqueId: string) {
    try {
      await markCompletion(clientId);
      const completionList = await listCompletions(clientId).catch(() => data?.completions ?? []);
      await mutate((current) => (current ? { ...current, completions: completionList } : current), { revalidate: false });
    } catch (e) {
      setActionError((e as Error).message);
    }
    void techniqueId;
  }

  const header = <IdentityHeader title="Stress" subtitle="Es momento de bajar el ritmo." />;

  if (isLoading) {
    return (
      <div>
        {header}
        <p className="text-sm text-[var(--eph-muted)]">Cargando técnicas de cortisol…</p>
      </div>
    );
  }
  if (error && error instanceof PermissionDeniedError) {
    return (
      <div>
        {header}
        <LockedBenefit benefit="tu protocolo de Stress" />
      </div>
    );
  }
  const errorMessage = actionError || (error ? (error as Error).message : null);
  if (errorMessage) {
    return (
      <div>
        {header}
        <p role="alert" className="font-body" style={{ color: 'var(--eph-danger)' }}>{errorMessage}</p>
      </div>
    );
  }
  if (!data) return null;

  const { techniques, completions, tip, checkin, morningCheckin, cognitiveLoad } = data;
  const active = activeId ? techniques.find((t) => t.id === activeId) : null;
  if (active) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const doneToday = completions.some((c) => c.completedDate === todayStr);
    return (
      <div>
        {header}
        <CortisolPlayer
          technique={active}
          doneToday={doneToday}
          onBack={() => setActiveId(null)}
          onComplete={() => handleComplete(active.id)}
        />
      </div>
    );
  }

  const emotion = checkin ? checkin.emotion : null;
  // El admin asigna, por cliente, qué técnica corresponde a cada emoción
  // (CortisolTechnique.emotion) — esa asignación explícita manda sobre el
  // texto genérico de CORTISOL_RECOMMENDATIONS, que solo queda como
  // fallback para cuando ninguna técnica tiene esa emoción asignada.
  const matched = (emotion && techniques.find((t) => t.emotion === emotion)) || techniques[0] || null;
  const fallback = (emotion && CORTISOL_RECOMMENDATIONS[emotion]) || CORTISOL_RECOMMENDATIONS.cansado;
  const recommended = emotion && matched && matched.emotion === emotion
    ? { title: matched.title, desc: matched.description || fallback.desc }
    : fallback;
  const weeklyStats = calculateCortisolWeeklyStats(completions);
  const isNeurowellnessType = (type: string | null) => !!type && (NEUROWELLNESS_TECHNIQUE_TYPES as readonly string[]).includes(type);
  const neurowellnessTechniques = techniques.filter((t) => isNeurowellnessType(t.type));
  const generalTechniques = techniques.filter((t) => !isNeurowellnessType(t.type));
  const ritualTechniques = techniques.filter((t) => t.isRitual);

  return (
    <div>
      {header}

      <MorningCheckinSummary
        morningCheckin={morningCheckin}
        clientType={clientType}
        cortisolAccessState={getModuleAccessState('cortisol', { moduleAccess, planExpired })}
      />
      {clientType === 'mentoring' && <InsightsSection clientId={clientId} moduleKey="cortisol" />}

      <div className="mb-5 border p-6" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--eph-muted)' }}>¿Cómo te sientes ahora mismo?</p>
        <div className="grid grid-cols-3 gap-2">
          {CORTISOL_EMOTIONS.map((o) => {
            const selected = emotion === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => handleSelectEmotion(o.key)}
                className="border px-2.5 py-2.5 text-center transition-colors"
                style={selected
                  ? { borderColor: 'var(--eph-accent)', background: 'var(--eph-accent)' }
                  : { borderColor: 'var(--eph-line-2)', background: 'var(--eph-surface-2)' }}
              >
                <span
                  className="font-body block text-[11.5px] font-medium leading-tight"
                  style={{ color: selected ? 'var(--eph-ink)' : 'var(--eph-body)' }}
                >
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative mt-8 mb-5 overflow-hidden rounded-[0] p-7 text-center"
        style={{ background: 'var(--eph-surface)', color: 'var(--eph-text)' }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(217,183,126,.18) 0%, transparent 70%)' }}
        />
        <p className="relative z-10 mb-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--eph-accent)' }}>
          Recomendada para ti ahora
        </p>
        <h3 className="relative z-10 mb-1 font-display text-lg" style={{ color: 'var(--eph-text)' }}>{recommended.title}</h3>
        <p className="relative z-10 mb-3 font-body text-sm" style={{ color: 'var(--eph-muted)' }}>{recommended.desc}</p>
        {matched && (
          <span className="relative z-10 inline-block">
            <Button type="button" variant="primary" onClick={() => setActiveId(matched.id)}>
              Empezar técnica
            </Button>
          </span>
        )}
      </div>

      {clientType === 'mentoring' && (
        <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
          <h2 className="mb-1 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Regulación del Sistema Nervioso</h2>
          <p className="mb-4 font-body text-xs" style={{ color: 'var(--eph-muted)' }}>
            Entrenamiento proactivo de tu capacidad de regulación — no depende de cómo te sientas hoy.
          </p>
          {neurowellnessTechniques.length === 0 ? (
            <EmptyState message="Tu mentor aún no te ha asignado prácticas de regulación." />
          ) : (
            <TechniqueList
              techniques={neurowellnessTechniques}
              playingAudioId={playingAudioId}
              setPlayingAudioId={setPlayingAudioId}
              setActiveId={setActiveId}
            />
          )}
        </section>
      )}

      <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
        <h2 className="mb-4 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Tus técnicas</h2>
        {generalTechniques.length === 0 ? (
          <EmptyState message="Aún no tienes técnicas asignadas." />
        ) : (
          <TechniqueList
            techniques={generalTechniques}
            playingAudioId={playingAudioId}
            setPlayingAudioId={setPlayingAudioId}
            setActiveId={setActiveId}
          />
        )}
      </section>

      {techniques.length > 0 && (
        <section className="border p-6 mb-5" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface)' }}>
          <h2 className="mb-4 font-display text-lg" style={{ color: 'var(--eph-text)' }}>Momento de regulación</h2>
          <div className="flex items-center gap-4">
            <RingProgress value={weeklyStats.pct} size={48} />
            <div className="flex-1">
              <ProgressBar done={weeklyStats.count} total={7} label="Esta semana" />
            </div>
          </div>
        </section>
      )}

      {tip && (
        <div className="mb-5 border p-[18px_20px]" style={{ borderColor: 'var(--eph-line)', background: 'var(--eph-surface-2)' }}>
          <p className="m-0 font-body text-xs" style={{ color: 'var(--eph-muted)' }}>
            <strong style={{ color: 'var(--eph-text)' }}>Sabías que</strong> {tip.content}
          </p>
        </div>
      )}

      <CognitiveLoadSection overview={cognitiveLoad} />
      <RoxRitualSection rituals={ritualTechniques} onStart={setActiveId} />

      <ProtocolDisclaimerFooter />
    </div>
  );
}
